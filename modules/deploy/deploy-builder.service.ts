import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { recordDeployEventOnce, recordDeployLog } from "./deploy-event.service"
import { syncJenkinsPipeline } from "@/modules/jenkins/jenkins-sync.service"
import {
  triggerJenkinsJob,
  type JenkinsApiConfig,
} from "@/modules/jenkins/jenkins.service"
import {
  resolveAppHostingClusterForStack,
  resolveClusterIntegration,
  type ArgoCdClusterConfig,
  type GitOpsClusterConfig,
  type JenkinsClusterConfig,
  type RegistryClusterConfig,
} from "./cluster-integration.service"
import { AppManifestBuilder } from "@/modules/gitops/builders"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"
import * as jsYaml from "js-yaml"
import {
  buildHelmValues,
  type HelmValuesProbe,
  type HelmValuesStorageMount,
} from "./helm-values.builder"
import {
  commitHelmValuesAndAdvanceToDeploying,
  loadPersistedEdgePolicy,
  resolveHelmEnvInputs,
} from "./jenkins-image-ready.service"

/**
 * Processes a QUEUED deployment through the build/deploy pipeline.
 * Called by the deploy-monitor interval.
 *
 * Jenkins/registry credentials come from the cluster integration resolver
 * (AppHostingClusterIntegration) when a cluster is configured; otherwise
 * the legacy env-based fallback is used. The eager BUILDING -> RUNNING
 * transition is gated on APP_HOSTING_EAGER_DEPLOY_FALLBACK so the new
 * Jenkins image-ready + ArgoCD polling flow can drive completion honestly.
 */
export async function processQueuedDeployment(deploymentId: string) {
  const deployment = await prisma.applicationDeployment.findUnique({
    where: { id: deploymentId },
    include: { stack: { include: { template: true } } },
  })

  if (!deployment || deployment.status !== "QUEUED") {
    return { processed: false, reason: "not_queued" }
  }

  const stack = deployment.stack

  if (stack.sourceType === "TEMPLATE") {
    return processTemplateDeployment(deployment)
  }

  let jenkinsConfig: JenkinsClusterConfig | null = null
  let registryConfig: RegistryClusterConfig | null = null
  try {
    jenkinsConfig = await resolveClusterIntegration(stack.id, "JENKINS")
  } catch {
    jenkinsConfig = null
  }
  try {
    registryConfig = await resolveClusterIntegration(stack.id, "REGISTRY")
  } catch {
    registryConfig = null
  }
  let gitopsConfig: GitOpsClusterConfig | null = null
  try {
    gitopsConfig = await resolveClusterIntegration(stack.id, "GITOPS")
  } catch {
    gitopsConfig = null
  }

  const jenkinsApiConfig: JenkinsApiConfig | undefined = jenkinsConfig
    ? {
        baseUrl: jenkinsConfig.baseUrl,
        username: jenkinsConfig.username,
        apiToken: jenkinsConfig.apiToken,
      }
    : undefined

  const eagerFallback = process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK === "true"

  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Mark as BUILDING
      await tx.applicationDeployment.update({
        where: { id: deployment.id },
        data: { status: "BUILDING" },
      })
      await tx.applicationStack.update({
        where: { id: stack.id },
        data: { status: "BUILDING" },
      })
      await recordDeployEventOnce(
        {
          deploymentId: deployment.id,
          type: "BUILD_STARTED",
          message: `Build started for ${stack.name}`,
        },
        tx
      )
      await recordDeployLog(
        {
          deploymentId: deployment.id,
          scope: "build",
          status: "BUILDING",
          message: "Build worker picked up deployment.",
        },
        tx
      )

      // Step 2: Sync Jenkins pipeline if stack has a repo connection
      if (stack.repositoryConnectionId) {
        const connection = await prisma.githubRepositoryConnection.findUnique({
          where: { id: stack.repositoryConnectionId },
          include: { installation: true },
        })

        if (connection) {
          try {
            const jenkinsOwner =
              jenkinsConfig?.dslOwner ?? connection.ownerLogin
            const jenkinsRepo = jenkinsConfig?.dslRepo ?? connection.repoName
            const gitCredentialId =
              jenkinsConfig?.gitCredentialId ?? "github-token"

            await syncJenkinsPipeline({
              installationId: Number(
                connection.installation.githubInstallationId
              ),
              owner: jenkinsOwner,
              repo: jenkinsRepo,
              slug: stack.slug,
              branch: stack.branchName,
              framework: stack.framework ?? "docker",
              env: "dev",
              gitCredentialId,
            })

            // Trigger Jenkins build
            const jobName = `deploy-${connection.repoName}`
            await triggerJenkinsJob(
              jobName,
              {
                GIT_REF: stack.branchName,
                GIT_COMMIT: deployment.commitSha ?? "",
                STACK_ID: stack.id,
                ...(jenkinsConfig?.webhookToken
                  ? { PFNAPP_WEBHOOK_TOKEN: jenkinsConfig.webhookToken }
                  : {}),
              },
              jenkinsApiConfig
            )

            await recordDeployEventOnce(
              {
                deploymentId: deployment.id,
                type: "JENKINS_JOB_TRIGGERED",
                message: `Jenkins job triggered for ${stack.slug}`,
                metadata: {
                  jobName,
                  commitSha: deployment.commitSha ?? null,
                  clusterCode: jenkinsConfig ? "sgp" : "env-fallback",
                },
              },
              tx
            )
            await recordDeployLog(
              {
                deploymentId: deployment.id,
                scope: "build",
                status: "BUILD_TRIGGERED",
                message: `Jenkins build triggered for ${stack.slug}`,
              },
              tx
            )
          } catch (err) {
            console.error(
              `[deploy-builder] Jenkins sync failed for ${stack.slug}:`,
              err
            )
            // Non-fatal — continue; Jenkins webhook will update status
          }
        }
      } else if (stack.sourceType === "PUBLIC" && stack.publicSourceUrl) {
        try {
          const jobName = `deploy-${stack.slug}`
          await triggerJenkinsJob(
            jobName,
            {
              PUBLIC_SOURCE_URL: stack.publicSourceUrl,
              GIT_REF: stack.publicSourceRef ?? stack.branchName,
              STACK_ID: stack.id,
              ...(jenkinsConfig?.webhookToken
                ? { PFNAPP_WEBHOOK_TOKEN: jenkinsConfig.webhookToken }
                : {}),
            },
            jenkinsApiConfig
          )
          await recordDeployEventOnce(
            {
              deploymentId: deployment.id,
              type: "JENKINS_JOB_TRIGGERED",
              message: `Jenkins public-source job triggered for ${stack.slug}`,
              metadata: { jobName, sourceUrl: stack.publicSourceUrl },
            },
            tx
          )
        } catch (error) {
          console.error(
            `[deploy-builder] Public Jenkins trigger failed for ${stack.slug}:`,
            error
          )
        }
      }

      // Step 3: Generate and push Helm manifests. With the image-ready webhook
      // in place, the GitOps commit is owned by /jenkins-image-ready. Keep this
      // path only as a fallback for environments that have not migrated yet.
      if (eagerFallback) {
        const envVars =
          (stack.envVarsJson as Array<{
            key: string
            value: string
            type?: string
            scope?: string
          }>) ?? []

        const plainEnv: Record<string, string> = {}
        const secretEnv: Record<string, string> = {}

        for (const e of envVars) {
          if (e.type === "secret") {
            secretEnv[e.key] = e.value
          } else {
            plainEnv[e.key] = e.value
          }
        }

        const registryHost = registryConfig?.host ?? "registry-apac.pfnapp.com"
        const imageRepository = registryConfig?.namespace
          ? `${registryHost}/${registryConfig.namespace}/${stack.slug}`
          : `${registryHost}/${stack.slug}`

        const builder = new AppManifestBuilder()
          .setAppName(`app-${stack.slug}`)
          .setNamespace(`app-${stack.slug}`)
          .setImage(`${imageRepository}:latest`)

        if (Object.keys(plainEnv).length > 0) {
          builder.addConfigMapData(plainEnv)
        }
        if (Object.keys(secretEnv).length > 0) {
          builder.addSecretData(secretEnv)
        }

        const manifest = builder.build()
        const manifestYaml = manifest.resources
          .map((r) =>
            jsYaml.dump(r as Record<string, unknown>, {
              indent: 2,
              lineWidth: -1,
              noRefs: true,
            })
          )
          .join("---\n")

        try {
          if (!gitopsConfig) {
            throw new Error(
              "GitOps cluster integration not configured for stack"
            )
          }
          const gitops = new GitOpsRepositoryService({
            pat: gitopsConfig.pat,
            branch: gitopsConfig.branch,
          })
          await gitops.commitFiles(gitopsConfig.repo, `Deploy ${stack.slug}`, [
            {
              path: `services-yaml/${stack.slug}/deployment.yml`,
              content: manifestYaml,
            },
          ])

          await tx.applicationDeployment.update({
            where: { id: deployment.id },
            data: {
              manifestPushed: true,
              manifestPushedAt: new Date(),
            },
          })
          await recordDeployEventOnce(
            {
              deploymentId: deployment.id,
              type: "MANIFEST_PUSHED",
              message: `Manifests pushed for ${stack.name}`,
            },
            tx
          )
          await recordDeployLog(
            {
              deploymentId: deployment.id,
              scope: "deploy",
              status: "MANIFEST_PUSHED",
              message: "Helm manifests pushed to GitOps repo.",
            },
            tx
          )
        } catch (err) {
          console.error(
            `[deploy-builder] Manifest push failed for ${stack.slug}:`,
            err
          )
          // Non-fatal; manifest push may fail if GitOps repo isn't configured
          await recordDeployLog(
            {
              deploymentId: deployment.id,
              scope: "deploy",
              status: "MANIFEST_PUSH_FAILED",
              message: `Failed to push manifests: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
            tx
          )
        }

        // Step 4: Mark as ARGOCD_SYNCED (ArgoCD auto-syncs from GitOps repo)
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "ARGOCD_SYNC_STARTED",
            message: `Deploying ${stack.name} to cloud`,
          },
          tx
        )
        await recordDeployLog(
          {
            deploymentId: deployment.id,
            scope: "argocd",
            status: "ARGOCD_SYNC_STARTED",
            message: "Applying configuration to cloud cluster.",
          },
          tx
        )

        // Mark as synced (ArgoCD auto-syncs; polling would happen in a future iteration)
        await tx.applicationDeployment.update({
          where: { id: deployment.id },
          data: {
            argocdSynced: true,
            argocdSyncedAt: new Date(),
          },
        })
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "ARGOCD_SYNCED",
            message: `Deployment verified for ${stack.name}`,
          },
          tx
        )

        // Step 5: Mark as RUNNING (only in eager fallback mode)
        await tx.applicationDeployment.update({
          where: { id: deployment.id },
          data: {
            status: "RUNNING",
            completedAt: new Date(),
          },
        })
        await tx.applicationStack.update({
          where: { id: stack.id },
          data: {
            status: "RUNNING",
            lastDeployStatus: "RUNNING",
            lastDeployedAt: new Date(),
          },
        })
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "DEPLOY_COMPLETED",
            message: `Deployment completed for ${stack.name}`,
          },
          tx
        )
        await recordDeployLog(
          {
            deploymentId: deployment.id,
            scope: "deploy",
            status: "RUNNING",
            message: "Application is running.",
          },
          tx
        )
      } else {
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "ARGOCD_SYNC_STARTED",
            message: `Waiting for Jenkins image-ready webhook for ${stack.name}`,
          },
          tx
        )
        await recordDeployLog(
          {
            deploymentId: deployment.id,
            scope: "deploy",
            status: "AWAITING_IMAGE",
            message: "Build triggered. Packaging application.",
          },
          tx
        )
      }
    })

    return { processed: true, status: eagerFallback ? "RUNNING" : "BUILDING" }
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
      type: "DEPLOY_FAILED",
      message: `Deployment failed: ${reason}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "build",
      status: "FAILED",
      message: reason,
    })

    return { processed: true, status: "FAILED", error: reason }
  }
}

type QueuedTemplateDeployment = Prisma.ApplicationDeploymentGetPayload<{
  include: { stack: { include: { template: true } } }
}>

const parseTemplateImageReference = (
  imageReference: string
): { imageRepository: string; imageTag: string } => {
  const lastSlashIndex = imageReference.lastIndexOf("/")
  const lastColonIndex = imageReference.lastIndexOf(":")
  if (lastColonIndex > lastSlashIndex) {
    return {
      imageRepository: imageReference.slice(0, lastColonIndex),
      imageTag: imageReference.slice(lastColonIndex + 1),
    }
  }
  return { imageRepository: imageReference, imageTag: "latest" }
}

const getStackImageRepository = (
  metadataJson: Prisma.JsonValue | null
): string | null => {
  if (!metadataJson || typeof metadataJson !== "object") return null
  const value = (metadataJson as Record<string, unknown>).imageRepository
  return typeof value === "string" && value.length > 0 ? value : null
}

export const getStackDeploymentType = (
  metadataJson: Prisma.JsonValue | null
): "deployment" | "statefulset" | undefined => {
  if (!metadataJson || typeof metadataJson !== "object") return undefined
  const value = (metadataJson as Record<string, unknown>).deploymentType
  return value === "deployment" || value === "statefulset" ? value : undefined
}

export const getStackAdditionalPorts = (
  metadataJson: Prisma.JsonValue | null
): Array<{ port: number; name: string }> | undefined => {
  if (!metadataJson || typeof metadataJson !== "object") return undefined
  const value = (metadataJson as Record<string, unknown>).additionalPorts
  if (!Array.isArray(value)) return undefined
  return value.filter(
    (entry): entry is { port: number; name: string } =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).port === "number" &&
      typeof (entry as Record<string, unknown>).name === "string"
  )
}

export interface ResolvedStackProbes {
  livenessProbe: HelmValuesProbe | null
  readinessProbe: HelmValuesProbe | null
  startupProbe: HelmValuesProbe | null
}

export function resolveStackProbes(params: {
  stackMeta: Record<string, unknown> | null
  blueprintRuntime: Record<string, unknown> | null
  runtimePort: number
}): ResolvedStackProbes {
  const userHealthCheck = params.stackMeta?.healthCheckPath
  const healthCheckPath =
    typeof userHealthCheck === "string"
      ? userHealthCheck.trim() || null
      : userHealthCheck === null
        ? null
        : typeof params.blueprintRuntime?.healthCheckPath === "string"
          ? params.blueprintRuntime.healthCheckPath.trim() || null
          : null

  const rawLiveness =
    params.blueprintRuntime?.livenessProbe &&
    typeof params.blueprintRuntime.livenessProbe === "object"
      ? (params.blueprintRuntime.livenessProbe as Record<string, unknown>)
      : null
  const rawReadiness =
    params.blueprintRuntime?.readinessProbe &&
    typeof params.blueprintRuntime.readinessProbe === "object"
      ? (params.blueprintRuntime.readinessProbe as Record<string, unknown>)
      : null
  const rawStartup =
    params.blueprintRuntime?.startupProbe &&
    typeof params.blueprintRuntime.startupProbe === "object"
      ? (params.blueprintRuntime.startupProbe as Record<string, unknown>)
      : null

  const livenessProbe: HelmValuesProbe | null = rawLiveness?.path
    ? {
        path: String(rawLiveness.path),
        port:
          typeof rawLiveness.port === "number"
            ? rawLiveness.port
            : params.runtimePort,
        initialDelaySeconds:
          typeof rawLiveness.initialDelaySeconds === "number"
            ? rawLiveness.initialDelaySeconds
            : 30,
        periodSeconds:
          typeof rawLiveness.periodSeconds === "number"
            ? rawLiveness.periodSeconds
            : 10,
        timeoutSeconds:
          typeof rawLiveness.timeoutSeconds === "number"
            ? rawLiveness.timeoutSeconds
            : 5,
        failureThreshold:
          typeof rawLiveness.failureThreshold === "number"
            ? rawLiveness.failureThreshold
            : 3,
      }
    : healthCheckPath
      ? {
          path: healthCheckPath,
          port: params.runtimePort,
        }
      : null

  const readinessProbe: HelmValuesProbe | null = rawReadiness?.path
    ? {
        path: String(rawReadiness.path),
        port:
          typeof rawReadiness.port === "number"
            ? rawReadiness.port
            : params.runtimePort,
        initialDelaySeconds:
          typeof rawReadiness.initialDelaySeconds === "number"
            ? rawReadiness.initialDelaySeconds
            : 10,
        periodSeconds:
          typeof rawReadiness.periodSeconds === "number"
            ? rawReadiness.periodSeconds
            : 5,
        timeoutSeconds:
          typeof rawReadiness.timeoutSeconds === "number"
            ? rawReadiness.timeoutSeconds
            : 3,
        failureThreshold:
          typeof rawReadiness.failureThreshold === "number"
            ? rawReadiness.failureThreshold
            : 3,
      }
    : null

  const startupProbe: HelmValuesProbe | null = rawStartup?.path
    ? {
        path: String(rawStartup.path),
        port:
          typeof rawStartup.port === "number"
            ? rawStartup.port
            : params.runtimePort,
        initialDelaySeconds:
          typeof rawStartup.initialDelaySeconds === "number"
            ? rawStartup.initialDelaySeconds
            : 10,
        periodSeconds:
          typeof rawStartup.periodSeconds === "number"
            ? rawStartup.periodSeconds
            : 5,
        timeoutSeconds:
          typeof rawStartup.timeoutSeconds === "number"
            ? rawStartup.timeoutSeconds
            : 3,
        failureThreshold:
          typeof rawStartup.failureThreshold === "number"
            ? rawStartup.failureThreshold
            : 30,
      }
    : null

  return { livenessProbe, readinessProbe, startupProbe }
}

export function resolveStorageMounts(
  rawMounts: unknown
): HelmValuesStorageMount[] | undefined {
  if (!Array.isArray(rawMounts)) return undefined
  const parsed: HelmValuesStorageMount[] = []
  for (const m of rawMounts) {
    if (
      typeof m === "object" &&
      m !== null &&
      typeof (m as Record<string, unknown>).name === "string" &&
      typeof (m as Record<string, unknown>).mountPath === "string"
    ) {
      const rec = m as Record<string, unknown>
      parsed.push({
        name: rec.name as string,
        mountPath: rec.mountPath as string,
        type:
          rec.type === "configmap" ||
          rec.type === "secret" ||
          rec.type === "pvc" ||
          rec.type === "emptyDir"
            ? rec.type
            : undefined,
        subPath: typeof rec.subPath === "string" ? rec.subPath : undefined,
        readOnly: typeof rec.readOnly === "boolean" ? rec.readOnly : undefined,
        sizeGb: typeof rec.sizeGb === "number" ? rec.sizeGb : undefined,
        sourceName:
          typeof rec.sourceName === "string" ? rec.sourceName : undefined,
        defaultMode:
          typeof rec.defaultMode === "number" ? rec.defaultMode : undefined,
      })
    }
  }
  return parsed.length > 0 ? parsed : undefined
}
export async function resolveTemplateImageReference(stack: {
  id: string
  slug: string
  metadataJson: Prisma.JsonValue | null
  template?: { blueprintJson: Prisma.JsonValue } | null
}): Promise<{ imageRepository: string; imageTag: string }> {
  const storedImageRepository = getStackImageRepository(stack.metadataJson)
  if (storedImageRepository) {
    return parseTemplateImageReference(storedImageRepository)
  }

  let templateBlueprint =
    (stack.template?.blueprintJson as Record<string, unknown> | null) ?? null
  if (!templateBlueprint) {
    const templateSlug =
      (stack.metadataJson as Record<string, unknown> | null)?.templateId ?? null
    if (typeof templateSlug === "string") {
      const appTemplate = await prisma.appTemplate.findFirst({
        where: { OR: [{ slug: templateSlug }, { id: templateSlug }] },
        select: { blueprintJson: true },
      })
      if (appTemplate?.blueprintJson) {
        templateBlueprint = appTemplate.blueprintJson as Record<string, unknown>
      }
    }
  }
  const runtimeImage =
    templateBlueprint &&
    typeof templateBlueprint.runtime === "object" &&
    templateBlueprint.runtime !== null &&
    typeof (templateBlueprint.runtime as Record<string, unknown>).image ===
      "string"
      ? ((templateBlueprint.runtime as Record<string, unknown>).image as string)
      : null

  if (runtimeImage) {
    return parseTemplateImageReference(runtimeImage)
  }

  throw new Error(
    `Template deployment ${stack.id} has no image: no blueprint image, no stored imageRepository, and no REGISTRY integration`
  )
}

/**
 * TEMPLATE deploys reference a prebuilt image (e.g. docker.io/n8nio/n8n)
 * instead of source code to build, so there is no Jenkins job to run and
 * the deployment must never pass through BUILDING. This resolves the
 * image straight to the Helm-generate-and-commit step that the Jenkins
 * image-ready webhook normally drives for GIT/PUBLIC deploys.
 */
async function processTemplateDeployment(deployment: QueuedTemplateDeployment) {
  const stack = deployment.stack

  try {
    const cluster = await resolveAppHostingClusterForStack(stack.id)
    const gitopsConfig = await resolveClusterIntegration(stack.id, "GITOPS")
    let argocdConfig: ArgoCdClusterConfig | null = null
    try {
      argocdConfig = await resolveClusterIntegration(stack.id, "ARGOCD")
    } catch {
      argocdConfig = null
    }
    const { imageRepository, imageTag } =
      await resolveTemplateImageReference(stack)

    const { envVars, externalSecretVaultPath } = resolveHelmEnvInputs(
      stack.envVarsJson
    )
    const edge = await loadPersistedEdgePolicy(stack.id, stack.slug)

    // Dynamic domain fallback: customDomain -> slug.managedBaseDomain -> null
    const resolvedDomain =
      stack.customDomain ??
      (cluster.managedBaseDomain
        ? `${stack.slug}.${cluster.managedBaseDomain}`
        : null)

    // Template Blueprint Storage and Runtime
    const templateBlueprint =
      (stack.template?.blueprintJson as Record<string, unknown> | null) ?? null
    const blueprintStorage =
      templateBlueprint && typeof templateBlueprint.storage === "object"
        ? (templateBlueprint.storage as Record<string, unknown>)
        : null
    const blueprintRuntime =
      templateBlueprint && typeof templateBlueprint.runtime === "object"
        ? (templateBlueprint.runtime as Record<string, unknown>)
        : null
    const stackMeta =
      stack.metadataJson && typeof stack.metadataJson === "object"
        ? (stack.metadataJson as Record<string, unknown>)
        : null

    const resolvedFsGroup =
      typeof stackMeta?.fsGroup === "number"
        ? (stackMeta.fsGroup as number)
        : typeof blueprintStorage?.fsGroup === "number"
          ? (blueprintStorage.fsGroup as number)
          : typeof blueprintRuntime?.fsGroup === "number"
            ? (blueprintRuntime.fsGroup as number)
            : undefined

    const storagePath =
      typeof blueprintStorage?.path === "string"
        ? (blueprintStorage.path as string)
        : typeof blueprintStorage?.mountPath === "string"
          ? (blueprintStorage.mountPath as string)
          : "/data"

    const storageConfig =
      blueprintStorage && blueprintStorage.enabled === true
        ? {
            enabled: true,
            path: storagePath,
            mountPath: storagePath,
            size:
              typeof blueprintStorage.sizeGbDefault === "number"
                ? `${blueprintStorage.sizeGbDefault}Gi`
                : "5Gi",
            storageClass: cluster.storageClass,
            accessMode: "ReadWriteOnce",
            fsGroup: resolvedFsGroup,
            mounts: resolveStorageMounts(blueprintStorage.mounts),
          }
        : null
    const runtimePort =
      (typeof stackMeta?.defaultPort === "number"
        ? (stackMeta.defaultPort as number)
        : null) ??
      (typeof blueprintRuntime?.defaultPort === "number"
        ? blueprintRuntime.defaultPort
        : 80)

    const { livenessProbe, readinessProbe, startupProbe } = resolveStackProbes({
      stackMeta,
      blueprintRuntime,
      runtimePort,
    })
    const command = Array.isArray(blueprintRuntime?.command)
      ? (blueprintRuntime.command as string[])
      : undefined

    const values = buildHelmValues({
      slug: stack.slug,
      imageRepository,
      imageTag,
      command,
      containerPort: runtimePort,
      servicePort: runtimePort,
      env: envVars,
      replicas: 1,
      cpu: stack.cpu,
      memory: stack.memory,
      domain: resolvedDomain,
      edge,
      externalSecretVaultPath,
      storage: storageConfig,
      nodeSelector: cluster.nodeSelector,
      tolerations: cluster.tolerations,
      deploymentType: getStackDeploymentType(stack.metadataJson),
      additionalContainerPorts: getStackAdditionalPorts(stack.metadataJson),
      reloader: true,
      logging: true,
      runAsNonRoot: blueprintRuntime?.runAsNonRoot !== false,
      fsGroup: resolvedFsGroup,
      livenessProbe,
      readinessProbe,
      startupProbe,
    })
    const { gitopsCommitSha } = await prisma.$transaction(
      (tx) =>
        commitHelmValuesAndAdvanceToDeploying({
          deployment: { id: deployment.id, commitSha: deployment.commitSha },
          stack: { slug: stack.slug, organizationId: stack.organizationId },
          values,
          gitopsConfig,
          imageTag,
          tx,
          chartVersion: argocdConfig?.chartVersion,
          chartRepoUrl: argocdConfig?.chartRepo,
        }),
      { timeout: 30000 }
    )

    return { processed: true, status: "DEPLOYING", gitopsCommitSha }
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
      type: "DEPLOY_FAILED",
      message: `Deployment failed: ${reason}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "deploy",
      status: "FAILED",
      message: reason,
    })

    return { processed: true, status: "FAILED", error: reason }
  }
}
