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
import { triggerDeploy } from "@/modules/deploy/deploy-pipeline.service"
import { ensureManagedDomainForStack } from "@/modules/deploy/app-hosting-edge.service"

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
  terminatedAt: string | null
  scheduledPurgeAt: string | null
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
    where.organizationId = organizationId
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
      terminatedAt: s.terminatedAt ? s.terminatedAt.toISOString() : null,
      scheduledPurgeAt: s.scheduledPurgeAt
        ? s.scheduledPurgeAt.toISOString()
        : null,
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
): Promise<boolean> {
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
    if (res.status === 404) {
      // Already gone — treat as success (idempotent)
      return true
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.warn(
        `[admin-stacks] ArgoCD DELETE application ${appName} returned ${res.status}: ${body}`
      )
      return false
    }
    return true
  } catch (err) {
    console.warn(
      `[admin-stacks] ArgoCD DELETE application ${appName} failed:`,
      err
    )
    return false
  }
}

// ─── Shared helper: scale-to-0 via GitOps ────────────────────────────────────

/**
 * Shared private helper that builds helm values with replicas=0 and pushes
 * them to the GitOps repository, then optionally triggers an ArgoCD sync.
 *
 * Used by both adminSuspendStack and adminDeleteStack (terminate).
 *
 * @returns { gitopsScaled, argocdSynced }
 */
async function scaleToZeroViaGitOps(
  stack: Awaited<ReturnType<typeof prisma.applicationStack.findUnique>> & {
    template: {
      blueprintJson: import("@prisma/client").Prisma.JsonValue
    } | null
    deployments: { commitSha: string | null }[]
  },
  gitopsConfig: GitOpsClusterConfig,
  argocdConfig: ArgoCdClusterConfig | null,
  commitMessage: string
): Promise<{ gitopsScaled: boolean; argocdSynced: boolean }> {
  let gitopsScaled = false
  let argocdSynced = false

  try {
    const cluster = await resolveAppHostingClusterForStack(stack.id)

    let imageRepository: string
    let imageTag: string
    if (stack.sourceType === "TEMPLATE") {
      const resolved = await resolveTemplateImageReference({
        id: stack.id,
        slug: stack.slug,
        metadataJson: stack.metadataJson,
        template: stack.template ?? null,
      })
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
      const latestDeploy = stack.deployments[0]
      imageTag = latestDeploy?.commitSha?.slice(0, 7) || "latest"
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

    const stackMeta =
      stack.metadataJson && typeof stack.metadataJson === "object"
        ? (stack.metadataJson as Record<string, unknown>)
        : null
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

    const { livenessProbe, readinessProbe, startupProbe } = resolveStackProbes({
      stackMeta,
      blueprintRuntime,
      runtimePort,
    })
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

    await gitops.commitFiles(gitopsConfig.repo, commitMessage, [
      { path: valuePath, content: valuesYaml },
      { path: helmPath, content: helmYaml },
      { path: argocdProjectPath, content: argocdProjectYaml },
    ])

    gitopsScaled = true

    if (argocdConfig) {
      await triggerArgoCdSync(argocdConfig, stack.slug)
      argocdSynced = true
    }
  } catch (err) {
    console.error(
      `[admin-stacks] scale-to-0 gitops push failed for ${stack.slug}:`,
      err
    )
  }

  return { gitopsScaled, argocdSynced }
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

  if (stack.status === StackStatus.TERMINATED) {
    throw new Error(
      `ALREADY_TERMINATED: Stack ${stackId} is already terminated`
    )
  }

  const { gitopsConfig, argocdConfig } =
    await resolveGitOpsAndArgoConfig(stackId)

  let gitopsPushed = false
  let argocdSynced = false

  if (gitopsConfig) {
    const result = await scaleToZeroViaGitOps(
      stack,
      gitopsConfig,
      argocdConfig,
      `Suspend ${stack.slug} (scale to 0)`
    )
    gitopsPushed = result.gitopsScaled
    argocdSynced = result.argocdSynced
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

// ─── Deploy / Trigger (Super Admin override for IDLE/FAILED/stuck stacks) ────

/**
 * Super Admin deploy trigger — forces a new deployment for an application stack.
 * Useful when an application stack is stuck in IDLE (e.g. initial deploy failure)
 * or when Super Admin needs to trigger a redeployment manually.
 */
export async function adminDeployStack(stackId: string): Promise<{
  deploymentId: string
  status: string
}> {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
  })
  if (!stack) throw new Error(`NOT_FOUND: Stack ${stackId} not found`)

  if (stack.status === StackStatus.TERMINATED) {
    throw new Error(
      `ALREADY_TERMINATED: Stack ${stack.slug} is already terminated`
    )
  }

  // Ensure managed domain binding exists
  await ensureManagedDomainForStack(stack.id).catch(() => {})

  // Clear suspended flag if it was marked as suspended
  const currentMeta =
    typeof stack.metadataJson === "object" && stack.metadataJson !== null
      ? (stack.metadataJson as Record<string, unknown>)
      : {}
  if (currentMeta.suspended) {
    await prisma.applicationStack.update({
      where: { id: stackId },
      data: {
        metadataJson: {
          ...currentMeta,
          suspended: false,
          suspendedAt: null,
        },
      },
    })
  }

  const triggerType =
    stack.sourceType === "TEMPLATE"
      ? "TEMPLATE"
      : stack.sourceType === "PUBLIC"
        ? "PUBLIC"
        : "MANUAL"

  const result = await triggerDeploy({
    stackId: stack.id,
    triggerType,
    force: true,
  })

  return {
    deploymentId: result.deploymentId,
    status: result.status,
  }
}

// ─── Terminate (soft-delete: scale to 0, schedule purge in 30 days) ──────────

/**
 * Admin terminate — soft-delete with 30-day purge window:
 *   1. Scales deployment to 0 via GitOps (same as suspend, different commit msg)
 *   2. Triggers ArgoCD sync
 *   3. Sets status=TERMINATED, terminatedAt=now, scheduledPurgeAt=now+30d in DB
 *
 * Does NOT delete GitOps manifests, DB record, or release managed stock.
 * Those happen in adminPurgeTerminatedStack (cron job at day 30).
 */
export async function adminDeleteStack(stackId: string): Promise<{
  gitopsScaled: boolean
  argocdSynced: boolean
  scheduledPurgeAt: string
}> {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
    include: {
      template: true,
      deployments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })
  if (!stack) throw new Error(`NOT_FOUND: Stack ${stackId} not found`)

  if (stack.status === StackStatus.TERMINATED) {
    throw new Error(
      `ALREADY_TERMINATED: Stack ${stack.slug} is already terminated`
    )
  }

  const { gitopsConfig, argocdConfig } =
    await resolveGitOpsAndArgoConfig(stackId)

  const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  let gitopsScaled = false
  let argocdSynced = false

  if (gitopsConfig) {
    const result = await scaleToZeroViaGitOps(
      stack,
      gitopsConfig,
      argocdConfig,
      `Terminate ${stack.slug} (scale to 0, purge scheduled for ${purgeAt.toISOString()})`
    )
    gitopsScaled = result.gitopsScaled
    argocdSynced = result.argocdSynced
  }

  // ALWAYS update the DB regardless of gitops outcome
  const currentMeta =
    typeof stack.metadataJson === "object" && stack.metadataJson !== null
      ? (stack.metadataJson as Record<string, unknown>)
      : {}
  await prisma.applicationStack.update({
    where: { id: stackId },
    data: {
      status: StackStatus.TERMINATED,
      terminatedAt: new Date(),
      scheduledPurgeAt: purgeAt,
      metadataJson: {
        ...currentMeta,
        terminated: true,
        terminatedAt: new Date().toISOString(),
        scheduledPurgeAt: purgeAt.toISOString(),
      },
    },
  })

  return { gitopsScaled, argocdSynced, scheduledPurgeAt: purgeAt.toISOString() }
}

// ─── Purge (hard-delete: called by cron at day 30) ───────────────────────────

/**
 * Admin purge — hard-delete of a previously TERMINATED stack:
 *   1. Deletes GitOps manifests (serviceDir, helmPath, valuePath, argocdProjectPath)
 *   2. Triggers ArgoCD cascade delete
 *   3. Releases managed stock (Vault KV cleanup)
 *   4. Hard-deletes the DB record
 *
 * Called by the terminated-stack-purge cron worker once scheduledPurgeAt has passed.
 */
export async function adminPurgeTerminatedStack(stackId: string): Promise<{
  gitopsDeleted: boolean
  argocdDeleted: boolean
  stockReleased: boolean
}> {
  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
  })
  if (!stack) throw new Error(`NOT_FOUND: Stack ${stackId} not found`)

  if (stack.status !== StackStatus.TERMINATED) {
    throw new Error(`NOT_TERMINATED: Stack ${stack.slug} is not terminated`)
  }

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
        `Purge ${stack.name} (${stack.slug}) — 30-day retention expired`,
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
    argocdDeleted = await deleteArgoCdApplication(argocdConfig, stack.slug)
  }

  // 3. Release managed DB stock (frees Vault KV secret)
  await releaseManagedStock(stackId)
    .then(() => {
      stockReleased = true
    })
    .catch((err) => {
      console.warn(
        `[admin-stacks] releaseManagedStock failed for ${stackId}:`,
        err
      )
    })

  // 4. Delete stack record from DB (cascade deletes deployments, events etc.)
  await prisma.applicationStack.delete({ where: { id: stackId } })

  return { gitopsDeleted, argocdDeleted, stockReleased }
}
