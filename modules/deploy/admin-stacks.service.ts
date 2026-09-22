import * as jsYaml from "js-yaml"
import { prisma } from "@/lib/prisma"
import { getCachedOrganizations } from "@/lib/workos-directory"
import { StackStatus, type Prisma } from "@prisma/client"
import { releaseManagedStock } from "@/modules/deploy/app-managed-stock.service"
import {
  resolveClusterIntegration,
  resolveAppHostingClusterForStack,
  type ArgoCdClusterConfig,
  type GitOpsClusterConfig,
} from "@/modules/deploy/cluster-integration.service"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"
import {
  resolveGitOpsManifestPaths,
  buildArgoCdProjectManifest,
  buildHelmApplicationManifest,
} from "@/modules/deploy/gitops-manifest.builder"
import { buildHelmValues } from "@/modules/deploy/helm-values.builder"
import {
  loadPersistedEdgePolicy,
  resolveHelmEnvInputs,
} from "@/modules/deploy/jenkins-image-ready.service"
import {
  resolveTemplateImageReference,
  getStackDeploymentType,
  getStackAdditionalPorts,
  resolveStackProbes,
  resolveStorageMounts,
} from "@/modules/deploy/deploy-builder.service"

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type AdminStackDTO = {
  id: string
  slug: string
  name: string
  framework: string | null
  organizationId: string
  organizationName: string | null
  status: string
  subdomain: string | null
  customDomain: string | null
  clusterName: string | null
  clusterCode: string | null
  cpu: number | null
  memory: number | null
  replicas: number | null
  billingMode: string | null
  billingState: string | null
  suspended: boolean
  createdAt: string
  updatedAt: string
  lastDeployedAt: string | null
  deploymentsCount: number
}

export type AdminStacksListQuery = {
  page?: number
  limit?: number
  organizationId?: string
  query?: string
  status?: string
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listAdminStacks(params: AdminStacksListQuery = {}) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const skip = (page - 1) * limit

  const where: Prisma.ApplicationStackWhereInput = {}

  const organizationId = params.organizationId?.trim()
  if (
    organizationId &&
    organizationId !== "undefined" &&
    organizationId !== "null"
  ) {
    where.organizationId = {
      contains: organizationId,
      mode: "insensitive",
    }
  }

  const status = params.status?.trim()
  if (
    status &&
    status !== "ALL" &&
    status !== "undefined" &&
    status !== "null" &&
    (Object.values(StackStatus) as string[]).includes(status)
  ) {
    where.status = status as StackStatus
  }

  const query = params.query?.trim()
  if (query && query !== "undefined" && query !== "null") {
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { slug: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
    ]
  }

  const [total, stacks] = await Promise.all([
    prisma.applicationStack.count({ where }),
    prisma.applicationStack.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        cluster: {
          select: { name: true, code: true },
        },
        _count: {
          select: { deployments: true },
        },
      },
    }),
  ])

  const orgIds = stacks.map((s) => s.organizationId).filter(Boolean)
  const orgMap = await getCachedOrganizations(orgIds)

  const data: AdminStackDTO[] = stacks.map((s) => {
    const meta =
      typeof s.metadataJson === "object" && s.metadataJson !== null
        ? (s.metadataJson as Record<string, unknown>)
        : {}

    const billingState =
      meta.billingState === "SUSPENDED"
        ? "SUSPENDED"
        : meta.billingState === "PAYMENT_GRACE"
          ? "PAYMENT_GRACE"
          : "ACTIVE"

    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      framework: s.framework ?? null,
      organizationId: s.organizationId,
      organizationName: orgMap.get(s.organizationId)?.name ?? null,
      status: s.status,
      subdomain: s.subdomain ?? null,
      customDomain: s.customDomain ?? null,
      clusterName: s.cluster?.name ?? null,
      clusterCode: s.cluster?.code ?? null,
      cpu: s.cpu ?? null,
      memory: s.memory ?? null,
      replicas: typeof meta.replicas === "number" ? meta.replicas : null,
      billingMode: s.billingMode ?? null,
      billingState,
      suspended: meta.suspended === true,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lastDeployedAt: s.lastDeployedAt ? s.lastDeployedAt.toISOString() : null,
      deploymentsCount: s._count.deployments,
    }
  })

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Resolve GitOps + ArgoCD cluster integration for a stack, non-throwing. */
async function resolveGitOpsAndArgoConfig(stackId: string): Promise<{
  gitopsConfig: GitOpsClusterConfig | null
  argocdConfig: ArgoCdClusterConfig | null
}> {
  let gitopsConfig: GitOpsClusterConfig | null = null
  let argocdConfig: ArgoCdClusterConfig | null = null

  try {
    gitopsConfig = await resolveClusterIntegration(stackId, "GITOPS")
  } catch {
    // no gitops integration configured
  }
  try {
    argocdConfig = await resolveClusterIntegration(stackId, "ARGOCD")
  } catch {
    // no argocd integration configured
  }

  return { gitopsConfig, argocdConfig }
}

/** Trigger ArgoCD sync for an application (non-fatal). */
async function triggerArgoCdSync(
  argocdConfig: ArgoCdClusterConfig,
  appName: string
): Promise<void> {
  const baseUrl = argocdConfig.apiUrl.replace(/\/$/, "")
  try {
    await fetch(
      `${baseUrl}/api/v1/applications/${encodeURIComponent(appName)}/sync`,
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
      `[admin-stacks] ArgoCD sync trigger failed for ${appName}:`,
      err
    )
  }
}

/**
 * Delete the ArgoCD Application object via the API, which triggers
 * the resources-finalizer cascade (removes all K8s workloads, services,
 * ingresses, PVCs etc. from the cluster before the Application itself is gone).
 */
async function deleteArgoCdApplication(
  argocdConfig: ArgoCdClusterConfig,
  appName: string
): Promise<void> {
  const baseUrl = argocdConfig.apiUrl.replace(/\/$/, "")
  // cascade=true ensures finalizer runs (resources-finalizer.argocd.argoproj.io)
  const url = `${baseUrl}/api/v1/applications/${encodeURIComponent(appName)}?cascade=true&propagationPolicy=foreground`
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${argocdConfig.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => "")
      console.warn(
        `[admin-stacks] ArgoCD DELETE application ${appName} returned ${res.status}: ${body}`
      )
    }
  } catch (err) {
    console.warn(
      `[admin-stacks] ArgoCD DELETE application ${appName} failed:`,
      err
    )
  }
}

// ─── Suspend (scale to 0) ─────────────────────────────────────────────────────

/**
 * Admin suspend — scales the deployment to 0 replicas by:
 *   1. Pushing value.yml with replicas=0 to the GitOps repo
 *   2. Triggering ArgoCD sync so the cluster reconciles immediately
 *   3. Marking metadataJson.suspended = true in DB
 *
 * GitOps/ArgoCD integrations are optional: if not configured the DB flag
 * is still set so the UI reflects the intent.
 */
export async function adminSuspendStack(
  stackId: string
): Promise<{ gitopsPushed: boolean; argocdSynced: boolean }> {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
    include: {
      template: true,
      deployments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })
  if (!stack) throw new Error(`NOT_FOUND: Stack ${stackId} not found`)

  const { gitopsConfig, argocdConfig } =
    await resolveGitOpsAndArgoConfig(stackId)

  let gitopsPushed = false
  let argocdSynced = false

  if (gitopsConfig) {
    try {
      const cluster = await resolveAppHostingClusterForStack(stackId)

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
          const reg = await resolveClusterIntegration(stackId, "REGISTRY")
          registryHost = reg.host
          registryNamespace = reg.namespace ?? undefined
        } catch {
          // fallback defaults
        }
        imageRepository = registryNamespace
          ? `${registryHost}/${registryNamespace}/${stack.slug}`
          : `${registryHost}/${stack.slug}`
        const latestDeploy = stack.deployments[0]
        imageTag = latestDeploy?.commitSha?.slice(0, 7) || "latest"
      }

      const { envVars, externalSecretVaultPath } = resolveHelmEnvInputs(
        stack.envVarsJson
      )
      const edge = await loadPersistedEdgePolicy(stackId, stack.slug)

      const resolvedDomain =
        stack.customDomain ??
        (cluster.managedBaseDomain
          ? `${stack.slug}.${cluster.managedBaseDomain}`
          : null)

      const stackMeta =
        stack.metadataJson && typeof stack.metadataJson === "object"
          ? (stack.metadataJson as Record<string, unknown>)
          : null
      const templateBlueprint =
        (stack.template?.blueprintJson as Record<string, unknown> | null) ??
        null
      const blueprintStorage =
        templateBlueprint && typeof templateBlueprint.storage === "object"
          ? (templateBlueprint.storage as Record<string, unknown>)
          : null
      const blueprintRuntime =
        templateBlueprint && typeof templateBlueprint.runtime === "object"
          ? (templateBlueprint.runtime as Record<string, unknown>)
          : null

      const runtimePort =
        (typeof stackMeta?.defaultPort === "number"
          ? (stackMeta.defaultPort as number)
          : null) ??
        (typeof blueprintRuntime?.defaultPort === "number"
          ? blueprintRuntime.defaultPort
          : 80)

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
              accessMode: "ReadWriteOnce" as const,
              fsGroup: resolvedFsGroup,
              mounts: resolveStorageMounts(blueprintStorage.mounts),
            }
          : null

      const { livenessProbe, readinessProbe, startupProbe } =
        resolveStackProbes({ stackMeta, blueprintRuntime, runtimePort })
      const command = Array.isArray(blueprintRuntime?.command)
        ? (blueprintRuntime.command as string[])
        : Array.isArray(stackMeta?.command)
          ? (stackMeta.command as string[])
          : undefined
      const args = Array.isArray(blueprintRuntime?.args)
        ? (blueprintRuntime.args as string[])
        : Array.isArray(stackMeta?.args)
          ? (stackMeta.args as string[])
          : undefined

      // Build values with replicas = 0 (scale to zero)
      const values = buildHelmValues({
        slug: stack.slug,
        imageRepository,
        imageTag,
        command,
        args,
        containerPort: runtimePort,
        servicePort: runtimePort,
        env: envVars,
        replicas: 0,
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

      const { valuePath, helmPath, argocdProjectPath, appSlug, namespace } =
        resolveGitOpsManifestPaths({
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
        servicesPath: resolveGitOpsManifestPaths({
          slug: stack.slug,
          organizationId: stack.organizationId,
          basePath: gitopsConfig.basePath,
        }).appServicesDir,
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

      await gitops.commitFiles(
        gitopsConfig.repo,
        `Suspend ${stack.slug} (scale to 0)`,
        [
          { path: valuePath, content: valuesYaml },
          { path: helmPath, content: helmYaml },
          { path: argocdProjectPath, content: argocdProjectYaml },
        ]
      )

      gitopsPushed = true

      if (argocdConfig) {
        await triggerArgoCdSync(argocdConfig, stack.slug)
        argocdSynced = true
      }
    } catch (err) {
      console.error(
        `[admin-stacks] suspend gitops push failed for ${stack.slug}:`,
        err
      )
    }
  }

  // Always persist the suspended flag in DB regardless of gitops outcome
  const currentMeta =
    typeof stack.metadataJson === "object" && stack.metadataJson !== null
      ? (stack.metadataJson as Record<string, unknown>)
      : {}
  await prisma.applicationStack.update({
    where: { id: stackId },
    data: {
      metadataJson: {
        ...currentMeta,
        suspended: true,
        suspendedAt: new Date().toISOString(),
      },
    },
  })

  return { gitopsPushed, argocdSynced }
}

// ─── Terminate (full removal) ─────────────────────────────────────────────────

/**
 * Admin terminate — full removal:
 *   1. Deletes GitOps manifest files (value.yml, helm.yml, argocd Application file,
 *      entire services-yaml/{tenant}/{slug}/ directory) via git commit
 *   2. Calls ArgoCD DELETE /api/v1/applications/:name?cascade=true so the
 *      resources-finalizer tears down all K8s workloads, services, ingresses etc.
 *   3. Releases managed DB stock (Vault KV cleanup)
 *   4. Deletes the ApplicationStack record from the database
 *
 * Steps 1-3 are non-fatal: a failure logs a warning but does not prevent DB deletion.
 */
export async function adminDeleteStack(stackId: string): Promise<{
  gitopsDeleted: boolean
  argocdDeleted: boolean
  stockReleased: boolean
}> {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
  })
  if (!stack) throw new Error(`NOT_FOUND: Stack ${stackId} not found`)

  const { gitopsConfig, argocdConfig } =
    await resolveGitOpsAndArgoConfig(stackId)

  let gitopsDeleted = false
  let argocdDeleted = false
  let stockReleased = false

  // 1. Delete GitOps manifests
  if (gitopsConfig) {
    try {
      const { serviceDir, helmPath, valuePath, argocdProjectPath } =
        resolveGitOpsManifestPaths({
          slug: stack.slug,
          organizationId: stack.organizationId,
          basePath: gitopsConfig.basePath,
        })

      const gitops = new GitOpsRepositoryService({
        pat: gitopsConfig.pat,
        branch: gitopsConfig.branch,
      })

      // Delete service directory tree + helm manifest + argocd application file
      await gitops.commitFiles(
        gitopsConfig.repo,
        `Terminate ${stack.name} (${stack.slug})`,
        [],
        [serviceDir, helmPath, valuePath, argocdProjectPath]
      )

      gitopsDeleted = true
    } catch (err) {
      console.warn(
        `[admin-stacks] gitops delete failed for ${stack.slug}:`,
        err
      )
    }
  }

  // 2. Delete ArgoCD Application (cascade=true triggers resources-finalizer)
  if (argocdConfig) {
    await deleteArgoCdApplication(argocdConfig, stack.slug)
    argocdDeleted = true
  }

  // 3. Release managed DB stock (frees Vault KV secret)
  await releaseManagedStock(stackId).catch((err) => {
    console.warn(
      `[admin-stacks] releaseManagedStock failed for ${stackId}:`,
      err
    )
  })
  stockReleased = true

  // 4. Delete stack record from DB (cascade deletes deployments, events etc.)
  await prisma.applicationStack.delete({ where: { id: stackId } })

  return { gitopsDeleted, argocdDeleted, stockReleased }
}
