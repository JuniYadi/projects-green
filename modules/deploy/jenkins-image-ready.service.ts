import * as jsYaml from "js-yaml"
import { prisma } from "@/lib/prisma"
import { resolveClusterIntegration } from "@/modules/deploy/cluster-integration.service"
import { buildHelmValues } from "./helm-values.builder"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"

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

  const existingImageTagEvent = await prisma.applicationDeployEvent.findFirst({
    where: {
      deploymentId: deployment.id,
      type: "IMAGE_TAG_RECEIVED",
    },
    orderBy: { createdAt: "desc" },
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

  if (previousTag === input.imageTag && deployment.manifestPushed) {
    return {
      ok: true,
      deploymentId: deployment.id,
      gitopsCommitSha: null,
      idempotent: true,
    }
  }

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

  const values = buildHelmValues({
    slug: stack.slug,
    imageRepository,
    imageTag: input.imageTag,
    env: envVars,
    replicas: stack.cpu ? 1 : 1,
    cpu: stack.cpu,
    memory: stack.memory,
    domain: stack.customDomain ?? null,
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

  const result = await gitops.commitFiles(
    gitopsConfig.repo,
    `Deploy ${stack.slug} image ${input.imageTag}`,
    [{ path: filePath, content: valuesYaml }]
  )

  await prisma.$transaction(async (tx) => {
    await tx.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "DEPLOYING",
        ...(input.commitSha ? { commitSha: input.commitSha } : {}),
        manifestPushed: true,
        manifestPushedAt: new Date(),
      },
    })

    await tx.applicationDeployEvent.create({
      data: {
        deploymentId: deployment.id,
        type: "IMAGE_TAG_RECEIVED",
        message: `Image tag ${input.imageTag} received for ${stack.slug}`,
        metadataJson: {
          imageTag: input.imageTag,
          commitSha: input.commitSha ?? null,
          buildNumber: input.buildNumber ?? null,
        },
      },
    })

    await tx.applicationDeployEvent.create({
      data: {
        deploymentId: deployment.id,
        type: "GITOPS_COMMIT_CREATED",
        message: `Helm values committed for ${stack.slug}`,
        metadataJson: {
          gitopsCommitSha: result.sha,
          imageTag: input.imageTag,
        },
      },
    })

    await tx.applicationDeployEvent.create({
      data: {
        deploymentId: deployment.id,
        type: "MANIFEST_PUSHED",
        message: `Manifest pushed for ${stack.slug}`,
        metadataJson: {
          imageTag: input.imageTag,
          gitopsCommitSha: result.sha,
        },
      },
    })

    const existingSyncStarted = await tx.applicationDeployEvent.findFirst({
      where: {
        deploymentId: deployment.id,
        type: "ARGOCD_SYNC_STARTED",
      },
    })
    if (!existingSyncStarted) {
      await tx.applicationDeployEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "ARGOCD_SYNC_STARTED",
          message: `ArgoCD sync started for ${stack.slug}`,
          metadataJson: { imageTag: input.imageTag },
        },
      })
    }
  })

  return {
    ok: true,
    deploymentId: deployment.id,
    gitopsCommitSha: result.sha,
    idempotent: false,
  }
}
