import { createId } from "@paralleldrive/cuid2"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { VaultSecretsService } from "@/modules/secrets/vault-secrets.service"
import {
  claimManagedStock,
  releaseManagedStock,
} from "./app-managed-stock.service"
import { syncStackConfiguration } from "./sync-stack.service"
import { getStackDeploymentType } from "./deploy-builder.service"
import type {
  AppTemplateBlueprint,
  AppTemplateBlueprintDependency,
} from "./blueprint/app-template-blueprint.schema"
import type {
  PreflightDiffDTO,
  PreflightTemplateSummaryDTO,
  ReinstallPreflightResponseDTO,
  ReinstallRequestDTO,
  ReinstallResultDTO,
  RollbackResultDTO,
  StackConfigSnapshot,
  StoragePreservationPolicy,
} from "./app-reinstall.dto"

const IN_PROGRESS_STATUSES = ["QUEUED", "BUILDING", "DEPLOYING"] as const

export class AppReinstallError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = "AppReinstallError"
  }
}

export async function computeReinstallPreflight(params: {
  organizationId: string
  slug: string
  targetTemplateId: string
}): Promise<ReinstallPreflightResponseDTO> {
  const stack = await prisma.applicationStack.findUnique({
    where: {
      organizationId_slug: {
        organizationId: params.organizationId,
        slug: params.slug,
      },
    },
    include: {
      template: true,
      managedStock: true,
    },
  })

  if (!stack) {
    throw new AppReinstallError("Application not found", "NOT_FOUND", 404)
  }

  const isInProgress = (IN_PROGRESS_STATUSES as readonly string[]).includes(
    stack.status
  )

  const targetTemplate = await prisma.appTemplate.findFirst({
    where: {
      OR: [{ id: params.targetTemplateId }, { slug: params.targetTemplateId }],
    },
  })

  if (!targetTemplate) {
    throw new AppReinstallError(
      "Target template not found",
      "TARGET_TEMPLATE_NOT_FOUND",
      404
    )
  }

  // Tenant isolation: template must be public/official OR belong to caller org
  const isAccessible =
    targetTemplate.visibility === "PUBLIC" ||
    targetTemplate.isOfficial ||
    (targetTemplate.organizationId !== null &&
      targetTemplate.organizationId === params.organizationId)

  if (!isAccessible) {
    throw new AppReinstallError(
      "Target template not found",
      "TARGET_TEMPLATE_NOT_FOUND",
      404
    )
  }

  const currentMeta =
    (stack.metadataJson as Record<string, unknown> | null) ?? {}
  const currentBlueprint =
    (stack.template?.blueprintJson as AppTemplateBlueprint | null) ?? null
  const targetBlueprint =
    targetTemplate.blueprintJson as unknown as AppTemplateBlueprint

  const currentDeploymentType =
    getStackDeploymentType(stack.metadataJson) ??
    currentBlueprint?.runtime?.deploymentType ??
    "deployment"
  const currentPort =
    (currentMeta.defaultPort as number | undefined) ??
    currentBlueprint?.runtime?.defaultPort ??
    80
  const currentImage =
    (currentMeta.imageRepository as string | undefined) ??
    currentBlueprint?.runtime?.image ??
    "custom-workload"
  const currentStoragePath =
    currentBlueprint?.storage?.mountPath ??
    currentBlueprint?.storage?.mounts?.[0]?.mountPath ??
    null

  const targetDeploymentType =
    targetBlueprint.runtime?.deploymentType ?? "deployment"
  const targetPort = targetBlueprint.runtime?.defaultPort ?? 80
  const targetImage = targetBlueprint.runtime?.image ?? ""
  const targetStoragePath =
    targetBlueprint.storage?.mountPath ??
    targetBlueprint.storage?.mounts?.[0]?.mountPath ??
    null

  let storagePolicy: StoragePreservationPolicy = "NONE"
  let storageWarning: string | undefined

  if (currentStoragePath && targetStoragePath) {
    if (currentStoragePath === targetStoragePath) {
      storagePolicy = "REUSE_COMPATIBLE"
    } else {
      storagePolicy = "PRESERVE_OLD_DETACH_AND_FRESH_VOLUME"
      storageWarning =
        `Current storage (${currentStoragePath}) will be preserved and detached. ` +
        `Target will mount a fresh volume (${targetStoragePath}). Existing data is never deleted.`
    }
  } else if (currentStoragePath && !targetStoragePath) {
    storagePolicy = "PRESERVE_OLD_DETACH_AND_FRESH_VOLUME"
    storageWarning = `Existing storage volume (${currentStoragePath}) will be detached and preserved safely.`
  }

  const diff: PreflightDiffDTO = {
    workloadKind: {
      current: currentDeploymentType,
      target: targetDeploymentType,
      changed: currentDeploymentType !== targetDeploymentType,
    },
    port: {
      current: currentPort,
      target: targetPort,
      changed: currentPort !== targetPort,
    },
    image: {
      current: currentImage,
      target: targetImage,
      changed: currentImage !== targetImage,
    },
    storage: {
      currentPath: currentStoragePath,
      targetPath: targetStoragePath,
      policy: storagePolicy,
      warning: storageWarning,
    },
  }

  // Dependency analysis
  const targetDep = targetBlueprint.dependencies?.[0] as
    AppTemplateBlueprintDependency | undefined
  let availableStockCount = 0
  if (targetDep) {
    availableStockCount = await prisma.appManagedStock.count({
      where: {
        serviceType: targetDep.serviceType,
        status: "AVAILABLE",
      },
    })
  }

  const managedStockAvailable = availableStockCount > 0
  const allowedModes: Array<"MANAGED" | "BYOD"> = targetDep
    ? managedStockAvailable
      ? ["MANAGED", "BYOD"]
      : ["BYOD"]
    : []

  const dependencies = {
    requiredServiceType: targetDep?.serviceType ?? null,
    managedStockAvailable,
    availableStockCount,
    allowedModes,
    notice: targetDep
      ? managedStockAvailable
        ? `Managed ${targetDep.serviceType} database stock is available for instant provisioning.`
        : `No managed ${targetDep.serviceType} database stock available in pool. You can Bring Your Own Database (BYOD).`
      : undefined,
  }

  // Env Schema analysis
  const existingEnvs = Array.isArray(stack.envVarsJson)
    ? (stack.envVarsJson as Array<Record<string, unknown>>)
    : []
  const existingKeys = new Set(
    existingEnvs
      .map((e) => (typeof e?.key === "string" ? e.key : null))
      .filter((k): k is string => Boolean(k))
  )

  const targetSchemaVars = targetBlueprint.envSchema ?? []
  const requiredEnvs = targetSchemaVars
    .filter((v) => v.required && !existingKeys.has(v.key))
    .map((v) => ({
      key: v.key,
      label: v.label,
      description: v.description,
      defaultValue: v.defaultValue,
      isSecret: Boolean(v.isSecret),
      dataType: v.dataType,
    }))

  const targetSchemaKeys = new Set(targetSchemaVars.map((v) => v.key))
  const preservedEnvs = [...existingKeys].filter((k) => targetSchemaKeys.has(k))
  const obsoleteEnvs = [...existingKeys].filter((k) => !targetSchemaKeys.has(k))

  const currentSummary: PreflightTemplateSummaryDTO = {
    id: stack.template?.id ?? stack.id,
    slug: stack.template?.slug ?? stack.slug,
    name: stack.template?.name ?? stack.name,
    version:
      (currentMeta.templateVersion as string | undefined) ??
      stack.template?.version ??
      "1.0.0",
    image: currentImage,
    deploymentType: currentDeploymentType,
    port: currentPort,
    storagePath: currentStoragePath,
  }

  const targetSummary: PreflightTemplateSummaryDTO = {
    id: targetTemplate.id,
    slug: targetTemplate.slug,
    name: targetTemplate.name,
    version: targetTemplate.version ?? "1.0.0",
    image: targetImage,
    deploymentType: targetDeploymentType,
    port: targetPort,
    storagePath: targetStoragePath,
  }

  return {
    currentTemplate: currentSummary,
    targetTemplate: targetSummary,
    diff,
    dependencies,
    envDiff: {
      preservedEnvs,
      requiredEnvs,
      obsoleteEnvs,
    },
    canProceed: !isInProgress,
    blockReason: isInProgress
      ? "Cannot reinstall while a deployment is in progress (QUEUED, BUILDING, or DEPLOYING)."
      : undefined,
  }
}

export async function executeReinstall(params: {
  organizationId: string
  slug: string
  input: ReinstallRequestDTO
  authorUserId?: string
}): Promise<ReinstallResultDTO> {
  const stack = await prisma.applicationStack.findUnique({
    where: {
      organizationId_slug: {
        organizationId: params.organizationId,
        slug: params.slug,
      },
    },
    include: {
      template: true,
      managedStock: true,
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!stack) {
    throw new AppReinstallError("Application not found", "NOT_FOUND", 404)
  }

  if ((IN_PROGRESS_STATUSES as readonly string[]).includes(stack.status)) {
    throw new AppReinstallError(
      "A deployment is already in progress for this application.",
      "DEPLOYMENT_IN_PROGRESS",
      409
    )
  }

  const targetTemplate = await prisma.appTemplate.findFirst({
    where: {
      OR: [
        { id: params.input.targetTemplateId },
        { slug: params.input.targetTemplateId },
      ],
    },
  })

  if (!targetTemplate) {
    throw new AppReinstallError(
      "Target template not found",
      "TARGET_TEMPLATE_NOT_FOUND",
      404
    )
  }

  const isAccessible =
    targetTemplate.visibility === "PUBLIC" ||
    targetTemplate.isOfficial ||
    (targetTemplate.organizationId !== null &&
      targetTemplate.organizationId === params.organizationId)

  if (!isAccessible) {
    throw new AppReinstallError(
      "Target template not found",
      "TARGET_TEMPLATE_NOT_FOUND",
      404
    )
  }

  const targetBlueprint =
    targetTemplate.blueprintJson as unknown as AppTemplateBlueprint
  const targetDep = targetBlueprint.dependencies?.[0] as
    AppTemplateBlueprintDependency | undefined

  // Dependency validation
  if (targetDep) {
    if (!params.input.dependencyMode) {
      throw new AppReinstallError(
        `Target template requires a ${targetDep.serviceType} database. Please select MANAGED or BYOD.`,
        "DEPENDENCY_REQUIRED",
        400
      )
    }

    if (
      params.input.dependencyMode === "BYOD" &&
      !params.input.byodCredentials
    ) {
      throw new AppReinstallError(
        "BYOD database credentials are required for BYOD mode.",
        "BYOD_CREDENTIALS_REQUIRED",
        400
      )
    }
  }

  // 1. Create atomic snapshot of existing stack state
  const currentMeta =
    (stack.metadataJson as Record<string, unknown> | null) ?? {}
  const snapshotId = `snap_${Date.now()}_${createId().slice(0, 8)}`
  const snapshot: StackConfigSnapshot = {
    id: snapshotId,
    createdAt: new Date().toISOString(),
    templateId: stack.templateId,
    templateVersion:
      (currentMeta.templateVersion as string | undefined) ??
      stack.template?.version ??
      null,
    templateName: stack.template?.name ?? stack.name,
    imageRepository:
      (currentMeta.imageRepository as string | undefined) ?? null,
    deploymentType: getStackDeploymentType(stack.metadataJson) ?? null,
    defaultPort: (currentMeta.defaultPort as number | undefined) ?? null,
    additionalPorts:
      (currentMeta.additionalPorts as
        | Array<{
            port: number
            name: string
          }>
        | undefined) ?? null,
    command: (currentMeta.command as string[] | undefined) ?? null,
    args: (currentMeta.args as string[] | undefined) ?? null,
    healthCheckPath:
      (currentMeta.healthCheckPath as string | undefined) ?? null,
    livenessProbe: currentMeta.livenessProbe ?? null,
    readinessProbe: currentMeta.readinessProbe ?? null,
    startupProbe: currentMeta.startupProbe ?? null,
    envVars: Array.isArray(stack.envVarsJson) ? stack.envVarsJson : [],
    metadata: currentMeta,
    managedStockId: stack.managedStock?.id ?? null,
  }

  // 2. Handle Database Dependency Allocation
  let allocatedStockId: string | null = null
  if (targetDep && params.input.dependencyMode === "MANAGED") {
    try {
      const stock = await claimManagedStock({
        serviceType: targetDep.serviceType,
        stackId: stack.id,
        orgId: params.organizationId,
        environment: "prod",
      })
      allocatedStockId = stock.id
    } catch (err) {
      throw new AppReinstallError(
        err instanceof Error && err.message === "STOCK_NOT_AVAILABLE"
          ? "Managed database stock is out of stock. Please use BYOD or try again later."
          : "Failed to claim managed database stock.",
        "STOCK_ALLOCATION_FAILED",
        500
      )
    }
  } else if (
    targetDep &&
    params.input.dependencyMode === "BYOD" &&
    params.input.byodCredentials
  ) {
    const byod = params.input.byodCredentials
    const byodSecrets: Record<string, string> = {
      [`${targetDep.envPrefix}_HOST`]: byod.host,
      [`${targetDep.envPrefix}_PORT`]: String(byod.port),
      [`${targetDep.envPrefix}_DATABASE`]: byod.database,
      [`${targetDep.envPrefix}_USER`]: byod.user,
      [`${targetDep.envPrefix}_PASSWORD`]: byod.password,
    }
    const vault = new VaultSecretsService()
    await vault.writeSecrets({
      organizationId: params.organizationId,
      stackId: stack.id,
      environment: "prod",
      secrets: byodSecrets,
    })
  }

  // 3. Storage Preservation: archive old storage mounts if target differs
  const currentStorageMounts = currentMeta.storageMounts ?? null
  const archivedStorageMounts = (
    (currentMeta.archivedStorageMounts as unknown[] | undefined) ?? []
  ).concat(currentStorageMounts ? [currentStorageMounts] : [])

  // 4. Merge Environment Variables
  const userEnvs = Array.isArray(stack.envVarsJson)
    ? (stack.envVarsJson as Array<Record<string, unknown>>)
    : []
  const userEnvMap = new Map(
    userEnvs
      .map((e) => (typeof e?.key === "string" ? [e.key, e] : null))
      .filter((pair): pair is [string, Record<string, unknown>] =>
        Boolean(pair)
      )
  )

  const newEnvs: Array<Record<string, unknown>> = []
  if (Array.isArray(targetBlueprint.envSchema)) {
    for (const schemaVar of targetBlueprint.envSchema) {
      const customValue = params.input.customEnvs?.[schemaVar.key]
      if (customValue !== undefined) {
        newEnvs.push({
          key: schemaVar.key,
          value: customValue,
          type: schemaVar.isSecret ? "secret" : "plain",
        })
      } else if (userEnvMap.has(schemaVar.key)) {
        newEnvs.push(userEnvMap.get(schemaVar.key)!)
      } else if (
        schemaVar.defaultValue !== undefined &&
        schemaVar.defaultValue !== null &&
        schemaVar.defaultValue !== ""
      ) {
        newEnvs.push({
          key: schemaVar.key,
          value: String(schemaVar.defaultValue),
          type: schemaVar.isSecret ? "secret" : "plain",
        })
      }
    }
  }

  // 5. Update Stack Metadata
  const updatedMetadata: Record<string, unknown> = {
    ...currentMeta,
    templateId: targetTemplate.id,
    templateSlug: targetTemplate.slug,
    templateVersion: targetTemplate.version ?? "1.0.0",
    templateName: targetTemplate.name,
    imageRepository: targetBlueprint.runtime.image,
    deploymentType: targetBlueprint.runtime.deploymentType ?? "deployment",
    defaultPort: targetBlueprint.runtime.defaultPort,
    additionalPorts: targetBlueprint.runtime.additionalPorts ?? [],
    command: targetBlueprint.runtime.command,
    args: targetBlueprint.runtime.args,
    healthCheckPath: targetBlueprint.runtime.healthCheckPath?.trim() || null,
    livenessProbe: targetBlueprint.runtime.livenessProbe ?? null,
    readinessProbe: targetBlueprint.runtime.readinessProbe ?? null,
    startupProbe: targetBlueprint.runtime.startupProbe ?? null,
    scaling: targetBlueprint.scaling ?? currentMeta.scaling,
    rollbackSnapshot: snapshot,
    archivedStorageMounts,
    reinstalledAt: new Date().toISOString(),
  }

  // 6. Execute atomic stack update and deployment creation
  const { deployment } = await prisma.$transaction(async (tx) => {
    await tx.applicationStack.update({
      where: { id: stack.id },
      data: {
        templateId: targetTemplate.id,
        sourceType: "TEMPLATE",
        status: "DEPLOYING",
        metadataJson: updatedMetadata as Prisma.InputJsonValue,
        envVarsJson: newEnvs as Prisma.InputJsonValue,
        lastDeployedAt: new Date(),
        lastDeployStatus: "DEPLOYING",
      },
    })

    const newDep = await tx.applicationDeployment.create({
      data: {
        stackId: stack.id,
        organizationId: stack.organizationId,
        status: "DEPLOYING",
        triggerType: "TEMPLATE",
        commitMessage: `Reinstall template: ${stack.name} -> ${targetTemplate.name}`,
        commitAuthor: params.authorUserId ?? "system",
        branchName: stack.branchName ?? "main",
        startedAt: new Date(),
      },
    })

    return { deployment: newDep }
  })

  // 7. Push GitOps Manifests & Trigger ArgoCD
  let commitSha: string | null = null
  try {
    const syncRes = await syncStackConfiguration({
      slug: stack.slug,
      organizationId: stack.organizationId,
    })
    commitSha = syncRes.commitSha
  } catch (syncErr) {
    // GitOps manifest sync failure: record on deployment
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "FAILED",
        failureReason:
          syncErr instanceof Error ? syncErr.message : "GitOps sync failed",
        completedAt: new Date(),
      },
    })
    throw new AppReinstallError(
      syncErr instanceof Error
        ? syncErr.message
        : "Failed to sync GitOps manifests for reinstalled template",
      "GITOPS_SYNC_FAILED",
      500
    )
  }

  return {
    ok: true,
    stackId: stack.id,
    slug: stack.slug,
    deploymentId: deployment.id,
    commitSha,
    snapshotId,
    message: `Template successfully switched to ${targetTemplate.name}. Deployment is running.`,
  }
}

export async function executeRollback(params: {
  organizationId: string
  slug: string
  authorUserId?: string
}): Promise<RollbackResultDTO> {
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
    throw new AppReinstallError("Application not found", "NOT_FOUND", 404)
  }

  if ((IN_PROGRESS_STATUSES as readonly string[]).includes(stack.status)) {
    throw new AppReinstallError(
      "Cannot rollback while a deployment is already in progress.",
      "DEPLOYMENT_IN_PROGRESS",
      409
    )
  }

  const meta = (stack.metadataJson as Record<string, unknown> | null) ?? {}
  const snapshot = meta.rollbackSnapshot as StackConfigSnapshot | undefined

  if (!snapshot) {
    throw new AppReinstallError(
      "No rollback snapshot found for this application.",
      "ROLLBACK_SNAPSHOT_NOT_FOUND",
      400
    )
  }

  const restoredMetadata: Record<string, unknown> = {
    ...snapshot.metadata,
    rollbackSnapshot: null,
    rolledBackAt: new Date().toISOString(),
    rollbackOfSnapshotId: snapshot.id,
  }

  const { deployment } = await prisma.$transaction(async (tx) => {
    await tx.applicationStack.update({
      where: { id: stack.id },
      data: {
        templateId: snapshot.templateId,
        status: "DEPLOYING",
        metadataJson: restoredMetadata as Prisma.InputJsonValue,
        envVarsJson: snapshot.envVars as Prisma.InputJsonValue,
        lastDeployedAt: new Date(),
        lastDeployStatus: "DEPLOYING",
      },
    })

    const newDep = await tx.applicationDeployment.create({
      data: {
        stackId: stack.id,
        organizationId: stack.organizationId,
        status: "DEPLOYING",
        triggerType: "MANUAL",
        commitMessage: `Rollback configuration to snapshot ${snapshot.id}`,
        commitAuthor: params.authorUserId ?? "system",
        rollbackOfId: stack.deployments[0]?.id ?? null,
        branchName: stack.branchName ?? "main",
        startedAt: new Date(),
      },
    })

    return { deployment: newDep }
  })

  let commitSha: string | null = null
  try {
    const syncRes = await syncStackConfiguration({
      slug: stack.slug,
      organizationId: stack.organizationId,
    })
    commitSha = syncRes.commitSha
  } catch (syncErr) {
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "FAILED",
        failureReason:
          syncErr instanceof Error
            ? syncErr.message
            : "GitOps rollback sync failed",
        completedAt: new Date(),
      },
    })
    throw new AppReinstallError(
      syncErr instanceof Error
        ? syncErr.message
        : "Failed to sync GitOps manifests for rollback",
      "GITOPS_ROLLBACK_FAILED",
      500
    )
  }

  return {
    ok: true,
    stackId: stack.id,
    slug: stack.slug,
    deploymentId: deployment.id,
    commitSha,
    restoredTemplateId: snapshot.templateId ?? "none",
    message: "Successfully rolled back to previous template configuration.",
  }
}
