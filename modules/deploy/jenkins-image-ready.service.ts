import * as jsYaml from "js-yaml"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  resolveClusterIntegration,
  type GitOpsClusterConfig,
} from "@/modules/deploy/cluster-integration.service"
import { buildHelmValues } from "./helm-values.builder"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"
import { recordDeployEventOnce, recordDeployLog } from "./deploy-event.service"

export type PrismaTransactionClient = Prisma.TransactionClient

export type PersistedEdgePolicy = {
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

export async function loadPersistedEdgePolicy(
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

export type JenkinsEnvVar = {
  key: string
  value: string
  type?: string
  scope?: string
  source?: string
  vaultPath?: string
  vaultKey?: string
}

const parseEnvVarsJson = (raw: unknown): JenkinsEnvVar[] => {
  let parsed: unknown = raw
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      console.error(
        "[jenkins-image-ready] Failed to parse envVarsJson string:",
        error
      )
      return []
    }
  }

  if (!Array.isArray(parsed)) {
    if (raw !== null && raw !== undefined) {
      console.warn(
        "[jenkins-image-ready] envVarsJson is not an array:",
        typeof parsed
      )
    }
    return []
  }

  return parsed.flatMap((item) => {
    if (typeof item !== "object" || item === null) return []
    const row = item as Record<string, unknown>
    if (typeof row.key !== "string" || typeof row.value !== "string") {
      return []
    }

    return [
      {
        key: row.key,
        value: row.value,
        ...(typeof row.type === "string" ? { type: row.type } : {}),
        ...(typeof row.scope === "string" ? { scope: row.scope } : {}),
        ...(typeof row.source === "string" ? { source: row.source } : {}),
        ...(typeof row.vaultPath === "string"
          ? { vaultPath: row.vaultPath }
          : {}),
        ...(typeof row.vaultKey === "string" ? { vaultKey: row.vaultKey } : {}),
      },
    ]
  })
}

const getExternalSecretVaultPath = (
  envVars: JenkinsEnvVar[]
): string | undefined => {
  const vaultEntry = envVars.find(
    (entry) =>
      (entry.source === "vault" ||
        entry.type === "secret_ref" ||
        entry.type === "secret_shared_ref") &&
      Boolean(entry.vaultPath)
  )
  if (!vaultEntry?.vaultPath) return undefined

  const canonicalPath = vaultEntry.vaultPath.match(
    /^(tenants\/[^/]+\/stacks\/[^/]+\/[^/]+\/app-env)(?:\/.*)?$/
  )
  return canonicalPath?.[1]
}

export function resolveHelmEnvInputs(envVarsJson: unknown): {
  envVars: JenkinsEnvVar[]
  externalSecretVaultPath: string | undefined
} {
  const parsedEnvVars = parseEnvVarsJson(envVarsJson)
  const envVars = parsedEnvVars.filter(
    (entry) =>
      entry.source !== "vault" &&
      entry.type !== "secret_ref" &&
      entry.type !== "secret_shared_ref"
  )
  const externalSecretVaultPath = getExternalSecretVaultPath(parsedEnvVars)
  return { envVars, externalSecretVaultPath }
}

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

  const { envVars, externalSecretVaultPath } = resolveHelmEnvInputs(
    stack.envVarsJson
  )

  const edge = await loadPersistedEdgePolicy(stack.id, stack.slug)

  let values: Record<string, unknown>
  try {
    values = buildHelmValues({
      slug: stack.slug,
      imageRepository,
      imageTag: input.imageTag,
      env: envVars,
      replicas: 1,
      cpu: stack.cpu,
      memory: stack.memory,
      domain: stack.customDomain ?? null,
      edge,
      externalSecretVaultPath,
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error"

    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "FAILED",
        failureReason: reason,
        completedAt: new Date(),
      },
    })
    await prisma.applicationStack.update({
      where: { id: stack.id },
      data: { lastDeployStatus: "FAILED" },
    })
    await recordDeployEventOnce({
      deploymentId: deployment.id,
      type: "DEPLOY_FAILED" as any,
      message: `Deployment failed: ${reason}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "deploy",
      status: "FAILED",
      message: reason,
    })

    return {
      ok: true,
      deploymentId: deployment.id,
      gitopsCommitSha: null,
      idempotent: false,
    }
  }

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

    const { gitopsCommitSha } = await commitHelmValuesAndAdvanceToDeploying({
      deployment: { id: deployment.id, commitSha: input.commitSha ?? null },
      stack: { slug: stack.slug },
      values,
      gitopsConfig,
      imageTag: input.imageTag,
      buildNumber: input.buildNumber,
      tx,
    })

    return {
      ok: true,
      deploymentId: deployment.id,
      gitopsCommitSha,
      idempotent: false,
    }
  })
}

export async function commitHelmValuesAndAdvanceToDeploying(params: {
  deployment: { id: string; commitSha?: string | null }
  stack: { slug: string }
  values: Record<string, unknown>
  gitopsConfig: GitOpsClusterConfig
  imageTag: string
  buildNumber?: number
  tx: PrismaTransactionClient
}): Promise<{ gitopsCommitSha: string }> {
  const { deployment, stack, values, gitopsConfig, imageTag, buildNumber, tx } =
    params

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

  const result = await gitops.commitFiles(
    gitopsConfig.repo,
    `Deploy ${stack.slug} image ${imageTag}`,
    [{ path: filePath, content: valuesYaml }]
  )

  await tx.applicationDeployment.update({
    where: { id: deployment.id },
    data: {
      status: "DEPLOYING",
      ...(deployment.commitSha ? { commitSha: deployment.commitSha } : {}),
      manifestPushed: true,
      manifestPushedAt: new Date(),
    },
  })

  await recordDeployEventOnce(
    {
      deploymentId: deployment.id,
      type: "IMAGE_TAG_RECEIVED" as any,
      message: `Image tag ${imageTag} received for ${stack.slug}`,
      metadata: {
        imageTag,
        commitSha: deployment.commitSha ?? null,
        buildNumber: buildNumber ?? null,
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
        imageTag,
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
        imageTag,
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
      metadata: { imageTag },
    },
    tx
  )

  return { gitopsCommitSha: result.sha }
}
