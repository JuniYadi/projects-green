import * as jsYaml from "js-yaml"
import { prisma } from "@/lib/prisma"
import {
  resolveAppHostingClusterForStack,
  resolveClusterIntegration,
  type ArgoCdClusterConfig,
  type GitOpsClusterConfig,
} from "./cluster-integration.service"
import { buildHelmValues } from "./helm-values.builder"
import {
  loadPersistedEdgePolicy,
  resolveHelmEnvInputs,
} from "./jenkins-image-ready.service"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"
import {
  buildArgoCdProjectManifest,
  buildHelmApplicationManifest,
  resolveGitOpsManifestPaths,
} from "./gitops-manifest.builder"
import { recordDeployEventOnce, recordDeployLog } from "./deploy-event.service"
import {
  resolveTemplateImageReference,
  getStackDeploymentType,
  getStackAdditionalPorts,
} from "./deploy-builder.service"

export async function syncStackConfiguration(params: {
  slug: string
  organizationId: string
}): Promise<{
  ok: boolean
  commitSha: string | null
  message: string
}> {
  const stack = await prisma.applicationStack.findUnique({
    where: {
      organizationId_slug: {
        organizationId: params.organizationId,
        slug: params.slug,
      },
    },
    include: {
      template: true,
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!stack) {
    throw new Error(`Application ${params.slug} not found`)
  }

  let gitopsConfig: GitOpsClusterConfig
  try {
    gitopsConfig = await resolveClusterIntegration(stack.id, "GITOPS")
  } catch (err) {
    // If GitOps integration not found, fallback to touching updatedAt
    await prisma.applicationStack.update({
      where: { id: stack.id },
      data: { updatedAt: new Date() },
    })
    return {
      ok: true,
      commitSha: null,
      message: "Configuration synced successfully",
    }
  }

  const cluster = await resolveAppHostingClusterForStack(stack.id)
  let argocdConfig: ArgoCdClusterConfig | null = null
  try {
    argocdConfig = await resolveClusterIntegration(stack.id, "ARGOCD")
  } catch {
    argocdConfig = null
  }

  let imageRepository: string
  let imageTag: string

  if (stack.sourceType === "TEMPLATE") {
    const resolved = await resolveTemplateImageReference(stack)
    imageRepository = resolved.imageRepository
    imageTag = resolved.imageTag
  } else {
    let registryHost = "registry-apac.pfnapp.com"
    let registryNamespace: string | undefined
    try {
      const reg = await resolveClusterIntegration(stack.id, "REGISTRY")
      registryHost = reg.host
      registryNamespace = reg.namespace ?? undefined
    } catch {
      // fallback defaults
    }
    imageRepository = registryNamespace
      ? `${registryHost}/${registryNamespace}/${stack.slug}`
      : `${registryHost}/${stack.slug}`
    const latestDeployment = stack.deployments[0]
    imageTag = latestDeployment?.commitSha?.slice(0, 7) || "latest"
  }

  const { envVars, externalSecretVaultPath } = resolveHelmEnvInputs(
    stack.envVarsJson
  )
  const edge = await loadPersistedEdgePolicy(stack.id, stack.slug)

  const resolvedDomain =
    stack.customDomain ??
    (cluster.managedBaseDomain
      ? `${stack.slug}.${cluster.managedBaseDomain}`
      : null)

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
          mounts: Array.isArray(blueprintStorage.mounts)
            ? (blueprintStorage.mounts as never)
            : undefined,
        }
      : null

  const runtimePort =
    (typeof stackMeta?.defaultPort === "number"
      ? (stackMeta.defaultPort as number)
      : null) ??
    (typeof blueprintRuntime?.defaultPort === "number"
      ? blueprintRuntime.defaultPort
      : 80)

  const userHealthCheck = stackMeta?.healthCheckPath
  const healthCheckPath =
    typeof userHealthCheck === "string"
      ? userHealthCheck.trim() || null
      : userHealthCheck === null
        ? null
        : typeof blueprintRuntime?.healthCheckPath === "string"
          ? blueprintRuntime.healthCheckPath.trim() || null
          : null

  const rawLiveness =
    blueprintRuntime?.livenessProbe &&
    typeof blueprintRuntime.livenessProbe === "object"
      ? (blueprintRuntime.livenessProbe as Record<string, unknown>)
      : null
  const rawReadiness =
    blueprintRuntime?.readinessProbe &&
    typeof blueprintRuntime.readinessProbe === "object"
      ? (blueprintRuntime.readinessProbe as Record<string, unknown>)
      : null
  const rawStartup =
    blueprintRuntime?.startupProbe &&
    typeof blueprintRuntime.startupProbe === "object"
      ? (blueprintRuntime.startupProbe as Record<string, unknown>)
      : null

  const livenessProbe = rawLiveness?.path
    ? {
        path: String(rawLiveness.path),
        port:
          typeof rawLiveness.port === "number" ? rawLiveness.port : runtimePort,
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
          port: runtimePort,
        }
      : null

  const readinessProbe = rawReadiness?.path
    ? {
        path: String(rawReadiness.path),
        port:
          typeof rawReadiness.port === "number"
            ? rawReadiness.port
            : runtimePort,
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

  const startupProbe = rawStartup?.path
    ? {
        path: String(rawStartup.path),
        port:
          typeof rawStartup.port === "number" ? rawStartup.port : runtimePort,
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

  const {
    appSlug,
    namespace,
    appServicesDir,
    helmPath,
    valuePath,
    argocdProjectPath,
  } = resolveGitOpsManifestPaths({
    slug: stack.slug,
    organizationId: stack.organizationId,
    basePath: gitopsConfig.basePath,
  })

  const repo = gitopsConfig.repo.replace(/\.git$/, "")
  const gitopsRepoUrl =
    repo.startsWith("http://") || repo.startsWith("https://")
      ? `${repo}.git`
      : `https://github.com/${repo}.git`

  const argocdProjectYaml = buildArgoCdProjectManifest({
    appSlug,
    repoUrl: gitopsRepoUrl,
    branch: gitopsConfig.branch,
    servicesPath: appServicesDir,
    namespace,
  })

  const helmYaml = buildHelmApplicationManifest({
    appName: stack.slug,
    gitopsRepoUrl,
    branch: gitopsConfig.branch,
    valueFilePath: valuePath,
    namespace,
    ...(argocdConfig?.chartVersion
      ? { chartVersion: argocdConfig.chartVersion }
      : {}),
    ...(argocdConfig?.chartRepo
      ? { chartRepoUrl: argocdConfig.chartRepo }
      : {}),
  })

  const valuesYaml = jsYaml.dump(values, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  })

  const gitops = new GitOpsRepositoryService({
    pat: gitopsConfig.pat,
    branch: gitopsConfig.branch,
  })

  const commit = await gitops.commitFiles(
    gitopsConfig.repo,
    `Sync configuration for ${stack.slug}`,
    [
      { path: valuePath, content: valuesYaml },
      { path: helmPath, content: helmYaml },
      { path: argocdProjectPath, content: argocdProjectYaml },
    ]
  )

  if (argocdConfig) {
    const baseUrl = argocdConfig.apiUrl.replace(/\/$/, "")
    try {
      await fetch(
        `${baseUrl}/api/v1/applications/${encodeURIComponent(stack.slug)}/sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${argocdConfig.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ prune: true }),
        }
      )
    } catch (err) {
      console.warn(
        `[sync-stack] Failed to trigger ArgoCD sync for ${stack.slug}:`,
        err
      )
    }
  }

  const latestDeployment = stack.deployments[0]
  if (
    latestDeployment &&
    (latestDeployment.status === "FAILED" ||
      latestDeployment.status === "QUEUED")
  ) {
    await prisma.applicationDeployment.update({
      where: { id: latestDeployment.id },
      data: {
        status: "DEPLOYING",
        manifestPushed: true,
        manifestPushedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        failureReason: null,
      },
    })
    await prisma.applicationStack.update({
      where: { id: stack.id },
      data: {
        status: "DEPLOYING",
        lastDeployStatus: "DEPLOYING",
        updatedAt: new Date(),
      },
    })
    await recordDeployEventOnce({
      deploymentId: latestDeployment.id,
      type: "ARGOCD_SYNC_STARTED",
      message: `Deploying ${stack.slug} to cloud (configuration synced)`,
      metadata: { gitopsCommitSha: commit.sha },
    })
    await recordDeployLog({
      deploymentId: latestDeployment.id,
      scope: "deploy",
      status: "info",
      message: `Configuration synced (commit ${commit.sha.slice(0, 7)}). Deploying to cluster...`,
    })
  } else {
    await prisma.applicationStack.update({
      where: { id: stack.id },
      data: { updatedAt: new Date() },
    })
  }

  return {
    ok: true,
    commitSha: commit.sha,
    message: "Configuration synced successfully",
  }
}
