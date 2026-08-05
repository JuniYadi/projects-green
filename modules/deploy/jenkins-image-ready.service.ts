import * as jsYaml from "js-yaml"
import { prisma } from "@/lib/prisma"
import { resolveClusterIntegration } from "@/modules/deploy/cluster-integration.service"
import { buildHelmValues } from "./helm-values.builder"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"
import { recordDeployEventOnce } from "./deploy-event.service"

type PersistedEdgePolicy = {
  domain: string
  certificateSource: "MANAGED" | "UPLOADED"
  certificateStatus?: string
  certificateSecretName?: string
  allowlistMode?: "OPEN" | "ALLOWLIST_ONLY"
  enabledCidrs: string[]
}

type EdgeDomainDelegate = {
  findFirst(args: unknown): Promise<{
    id: string
    hostname: string
    certificate: {
      source: "MANAGED" | "UPLOADED"
      status: string
      tlsSecretName: string | null
    } | null
    allowlistMode: "OPEN" | "ALLOWLIST_ONLY"
    allowlistEntries: Array<{ cidr: string }>
  } | null>
}

async function loadPersistedEdgePolicy(
  stackId: string,
  stackSlug: string
): Promise<PersistedEdgePolicy | null> {
  const edgePrisma = prisma as unknown as {
    applicationDomain?: EdgeDomainDelegate
  }
  if (!edgePrisma.applicationDomain) return null

  const domain = await edgePrisma.applicationDomain.findFirst({
    where: { stackId, isPrimary: true },
    include: {
      certificate: {
        select: { source: true, status: true, tlsSecretName: true },
      },
      allowlistEntries: {
        where: { enabled: true },
        orderBy: { position: "asc" },
        select: { cidr: true },
      },
    },
  })
  if (!domain) return null

  return {
    domain: domain.hostname,
    certificateSource: domain.certificate?.source ?? "MANAGED",
    certificateStatus: domain.certificate?.status,
    // Uploaded cert material is materialized under this deterministic name by
    // the edge deployment flow; never include encrypted certificate fields.
    certificateSecretName:
      domain.certificate?.source === "UPLOADED" &&
      domain.certificate.status === "ACTIVE"
        ? (domain.certificate.tlsSecretName ?? `app-domain-${domain.id}-tls`)
        : undefined,
    allowlistMode: domain.allowlistMode,
    enabledCidrs: domain.allowlistEntries.map((entry) => entry.cidr),
  }
}

export type JenkinsImageReadyInput = {
  slug: string
  deploymentId?: string
  imageTag: string
  commitSha?: string
  buildNumber?: number
}

export type JenkinsImageReadyResult = {
  ok: true
  deploymentId: string | null
  gitopsCommitSha: string | null
  idempotent: boolean
}

const ACTIVE_DEPLOYMENT_STATUSES = [
  "QUEUED",
  "BUILDING",
  "DEPLOYING",
  "RUNNING",
] as const

const findActiveDeployment = async (
  stackId: string,
  input: JenkinsImageReadyInput
) => {
  if (input.deploymentId) {
    return prisma.applicationDeployment.findFirst({
      where: {
        id: input.deploymentId,
        stackId,
        status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
      },
    })
  }
  return prisma.applicationDeployment.findFirst({
    where: {
      stackId,
      status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] },
      ...(input.commitSha ? { commitSha: input.commitSha } : {}),
    },
    orderBy: { createdAt: "desc" },
  })
}
export async function handleJenkinsImageReady(
  input: JenkinsImageReadyInput
): Promise<JenkinsImageReadyResult> {
  const empty: JenkinsImageReadyResult = {
    ok: true,
    deploymentId: null,
    gitopsCommitSha: null,
    idempotent: false,
  }

  const stack = await prisma.applicationStack.findFirst({
    where: { slug: input.slug },
  })
  if (!stack) return empty

  const deployment = await findActiveDeployment(stack.id, input)
  if (!deployment) return empty

  const gitopsConfig = await resolveClusterIntegration(
    deployment.stackId,
    "GITOPS"
  )
  const registryConfig = await resolveClusterIntegration(
    deployment.stackId,
    "REGISTRY"
  )

  const imageRepository = registryConfig.namespace
    ? `${registryConfig.host}/${registryConfig.namespace}/${stack.slug}`
    : `${registryConfig.host}/${stack.slug}`

  const envVars =
    (stack.envVarsJson as Array<{
      key: string
      value: string
      type?: string
    }>) ?? []

  const edge = await loadPersistedEdgePolicy(stack.id, stack.slug)

  const values = buildHelmValues({
    slug: stack.slug,
    imageRepository,
    imageTag: input.imageTag,
    env: envVars,
    replicas: 1,
    cpu: stack.cpu,
    memory: stack.memory,
    domain: stack.customDomain ?? null,
    edge,
  })

  const valuesYaml = jsYaml.dump(values, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  })

  const basePath = gitopsConfig.basePath
    .replace("{slug}", stack.slug)
    .replace(/\/$/, "")
  const filePath = `${basePath}/value.yml`

  const gitops = new GitOpsRepositoryService({
    pat: gitopsConfig.pat,
    branch: gitopsConfig.branch,
  })

  return prisma.$transaction(async (tx) => {
    const lockKey = `jenkins-image-ready:${deployment.id}`
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

    const locked = await tx.applicationDeployment.findUnique({
      where: { id: deployment.id },
    })
    if (!locked) return empty

    const existingImageTagEvent = await tx.applicationDeployEvent.findUnique({
      where: {
        deploymentId_type: {
          deploymentId: deployment.id,
          type: "IMAGE_TAG_RECEIVED" as any,
        },
      },
    })

    const previousTag =
      existingImageTagEvent &&
      typeof existingImageTagEvent.metadataJson === "object" &&
      existingImageTagEvent.metadataJson &&
      "imageTag" in
        (existingImageTagEvent.metadataJson as Record<string, unknown>)
        ? String(
            (existingImageTagEvent.metadataJson as Record<string, unknown>)
              .imageTag
          )
        : null

    if (previousTag === input.imageTag && locked.manifestPushed) {
      const priorShaEvent = await tx.applicationDeployEvent.findUnique({
        where: {
          deploymentId_type: {
            deploymentId: deployment.id,
            type: "GITOPS_COMMIT_CREATED" as any,
          },
        },
      })
      const priorSha =
        priorShaEvent &&
        typeof priorShaEvent.metadataJson === "object" &&
        priorShaEvent.metadataJson &&
        "gitopsCommitSha" in
          (priorShaEvent.metadataJson as Record<string, unknown>)
          ? String(
              (priorShaEvent.metadataJson as Record<string, unknown>)
                .gitopsCommitSha
            )
          : null
      return {
        ok: true,
        deploymentId: deployment.id,
        gitopsCommitSha: priorSha,
        idempotent: true,
      }
    }

    const result = await gitops.commitFiles(
      gitopsConfig.repo,
      `Deploy ${stack.slug} image ${input.imageTag}`,
      [{ path: filePath, content: valuesYaml }]
    )

    await tx.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "DEPLOYING",
        ...(input.commitSha ? { commitSha: input.commitSha } : {}),
        manifestPushed: true,
        manifestPushedAt: new Date(),
      },
    })

    await recordDeployEventOnce(
      {
        deploymentId: deployment.id,
        type: "IMAGE_TAG_RECEIVED" as any,
        message: `Image tag ${input.imageTag} received for ${stack.slug}`,
        metadata: {
          imageTag: input.imageTag,
          commitSha: input.commitSha ?? null,
          buildNumber: input.buildNumber ?? null,
        },
      },
      tx
    )

    await recordDeployEventOnce(
      {
        deploymentId: deployment.id,
        type: "GITOPS_COMMIT_CREATED" as any,
        message: `Helm values committed for ${stack.slug}`,
        metadata: {
          gitopsCommitSha: result.sha,
          imageTag: input.imageTag,
        },
      },
      tx
    )

    await recordDeployEventOnce(
      {
        deploymentId: deployment.id,
        type: "MANIFEST_PUSHED" as any,
        message: `Manifest pushed for ${stack.slug}`,
        metadata: {
          imageTag: input.imageTag,
          gitopsCommitSha: result.sha,
        },
      },
      tx
    )

    await recordDeployEventOnce(
      {
        deploymentId: deployment.id,
        type: "ARGOCD_SYNC_STARTED" as any,
        message: `ArgoCD sync started for ${stack.slug}`,
        metadata: { imageTag: input.imageTag },
      },
      tx
    )

    return {
      ok: true,
      deploymentId: deployment.id,
      gitopsCommitSha: result.sha,
      idempotent: false,
    }
  })
}
