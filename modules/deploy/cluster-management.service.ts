import { Prisma, type AppHostingClusterIntegrationType } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { VaultClient } from "@/lib/vault/vault-client"
import {
  decryptClusterIntegrationSecrets,
  encryptClusterIntegrationSecrets,
  invalidateClusterIntegrationCache,
  maskClusterIntegrationSecret,
} from "./cluster-integration.service"
import {
  clusterMetadataSchema,
  integrationMetaJsonSchemas,
  integrationSecretPatchSchemas,
  integrationSecretSchemas,
} from "@/modules/deploy/cluster-integration.schema"
import { toClusterDTO } from "@/modules/deploy/cluster-management.dto"
import type { ClusterAdminDTO } from "@/modules/deploy/cluster-management.dto"

// ── Types ────────────────────────────────────────────

export type ListClustersParams = { page: number; limit: number }

export type CreateClusterInput = {
  code: string
  name: string
  region?: string
  regionId?: string
  metadataJson?: Record<string, unknown>
  status?: "PLANNED" | "ACTIVE" | "DEPRECATED"
  isDefault?: boolean
}

export type UpdateClusterInput = {
  name?: string
  region?: string
  regionId?: string
  metadataJson?: Record<string, unknown>
}

export type UpsertIntegrationInput = {
  metaJson?: Record<string, unknown>
  secrets?: Record<string, unknown>
}

export class ClusterIntegrationValidationError extends Error {
  readonly issues: z.ZodIssue[]

  constructor(issues: z.ZodIssue[]) {
    super("Cluster integration validation failed")
    this.name = "ClusterIntegrationValidationError"
    this.issues = issues
  }
}

function validateClusterMetadata(
  metadata: Record<string, unknown> | undefined
) {
  const parsed = clusterMetadataSchema.safeParse(metadata ?? {})
  if (!parsed.success) {
    throw new ClusterIntegrationValidationError(parsed.error.issues)
  }
  return parsed.data
}

function validateIntegrationConfig(
  type: AppHostingClusterIntegrationType,
  metadata: Record<string, unknown> | undefined,
  secrets: Record<string, unknown>,
  existingSecrets: Record<string, unknown>
) {
  const metadataResult = integrationMetaJsonSchemas[type].safeParse(
    metadata ?? {}
  )
  const secretPatchResult =
    integrationSecretPatchSchemas[type].safeParse(secrets)
  const issues = [
    ...(metadataResult.success
      ? []
      : metadataResult.error.issues.map((issue) => ({
          ...issue,
          path: ["metaJson", ...issue.path],
        }))),
    ...(secretPatchResult.success
      ? []
      : secretPatchResult.error.issues.map((issue) => ({
          ...issue,
          path: ["secrets", ...issue.path],
        }))),
  ]
  if (issues.length > 0) throw new ClusterIntegrationValidationError(issues)

  const mergedSecrets = {
    ...existingSecrets,
    ...(secretPatchResult.data ?? {}),
  }
  const completeSecrets =
    integrationSecretSchemas[type].safeParse(mergedSecrets)
  if (!completeSecrets.success) {
    throw new ClusterIntegrationValidationError(
      completeSecrets.error.issues.map((issue) => ({
        ...issue,
        path: ["secrets", ...issue.path],
      }))
    )
  }

  return { metadata: metadataResult.data, secrets: completeSecrets.data }
}

// ── Helpers ──────────────────────────────────────────

function throwIfNotFound<T>(value: T | null, label: string): T {
  if (!value) {
    const err = new Error(`NOT_FOUND: ${label} not found`)
    ;(err as unknown as { code: string }).code = "NOT_FOUND"
    throw err
  }
  return value
}

function throwConflict(message: string) {
  const err = new Error(`CONFLICT: ${message}`)
  ;(err as unknown as { code: string }).code = "CONFLICT"
  throw err
}

function throwInvalidDefault(message: string) {
  const err = new Error(`INVALID_DEFAULT_TRANSITION: ${message}`)
  ;(err as unknown as { code: string }).code = "INVALID_DEFAULT_TRANSITION"
  throw err
}

const clusterInclude = { integrations: true, region: true } as const

// ── Service ──────────────────────────────────────────

export async function listClusters(
  params: ListClustersParams
): Promise<{ clusters: ClusterAdminDTO[]; total: number }> {
  const { page, limit } = params
  const skip = (page - 1) * limit

  const [rows, total] = await Promise.all([
    prisma.appHostingCluster.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: clusterInclude,
    }),
    prisma.appHostingCluster.count(),
  ])

  return { clusters: rows.map(toClusterDTO), total }
}

export async function getClusterById(
  id: string
): Promise<ClusterAdminDTO | null> {
  const row = await prisma.appHostingCluster.findUnique({
    where: { id },
    include: clusterInclude,
  })
  return row ? toClusterDTO(row) : null
}

async function resolveRegionId(
  db: Prisma.TransactionClient | typeof prisma,
  regionId?: string | null,
  regionNameOrCode?: string | null
): Promise<string | null> {
  if (regionId) return regionId
  if (!regionNameOrCode || !db.serviceRegion) return null

  const trimmed = regionNameOrCode.trim()
  if (!trimmed) return null

  const normalizedCode = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const found = await db.serviceRegion.findFirst({
    where: {
      OR: [
        { id: trimmed },
        { code: normalizedCode },
        { name: { equals: trimmed, mode: "insensitive" } },
      ],
    },
  })

  return found?.id ?? null
}
export async function createCluster(
  input: CreateClusterInput
): Promise<ClusterAdminDTO> {
  const metadata = validateClusterMetadata(input.metadataJson)
  const existing = await prisma.appHostingCluster.findFirst({
    where: { code: input.code },
  })
  if (existing) throwConflict("Code already exists")

  if (input.isDefault && (input.status ?? "PLANNED") !== "ACTIVE") {
    throwInvalidDefault("A default cluster must be ACTIVE")
  }
  if (input.isDefault) {
    return prisma.$transaction(async (tx) => {
      await tx.appHostingCluster.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
      const resolvedRegionId = await resolveRegionId(
        tx,
        input.regionId,
        input.region
      )

      const row = await tx.appHostingCluster.create({
        data: {
          code: input.code,
          name: input.name,
          regionId: resolvedRegionId,
          status: input.status ?? "PLANNED",
          isDefault: true,
          metadataJson: metadata as Prisma.InputJsonValue,
        },
        include: clusterInclude,
      })
      return toClusterDTO(row)
    })
  }

  const resolvedRegionId = await resolveRegionId(
    prisma,
    input.regionId,
    input.region
  )

  const row = await prisma.appHostingCluster.create({
    data: {
      code: input.code,
      name: input.name,
      regionId: resolvedRegionId,
      status: input.status ?? "PLANNED",
      isDefault: input.isDefault ?? false,
      metadataJson: metadata as Prisma.InputJsonValue,
    },
    include: clusterInclude,
  })
  return toClusterDTO(row)
}

export async function updateCluster(
  id: string,
  input: UpdateClusterInput
): Promise<ClusterAdminDTO> {
  throwIfNotFound(
    await prisma.appHostingCluster.findUnique({ where: { id } }),
    "Cluster"
  )
  let regionIdToSet: string | null | undefined = input.regionId
  if (regionIdToSet === undefined && input.region !== undefined) {
    regionIdToSet = await resolveRegionId(prisma, undefined, input.region)
  }

  const metadata =
    input.metadataJson === undefined
      ? undefined
      : (validateClusterMetadata(input.metadataJson) as Prisma.InputJsonValue)
  const row = await prisma.appHostingCluster.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(regionIdToSet !== undefined && { regionId: regionIdToSet }),
      ...(metadata !== undefined && { metadataJson: metadata }),
    },
    include: clusterInclude,
  })
  return toClusterDTO(row)
}

export async function updateClusterStatus(
  id: string,
  status: "PLANNED" | "ACTIVE" | "DEPRECATED",
  opts?: { isDefault?: boolean }
): Promise<ClusterAdminDTO> {
  const existing = throwIfNotFound(
    await prisma.appHostingCluster.findUnique({ where: { id } }),
    "Cluster"
  )

  const wantsDefaultOn = opts?.isDefault === true
  const wantsDefaultOff = opts?.isDefault === false

  if (wantsDefaultOn && status !== "ACTIVE") {
    throwInvalidDefault("A default cluster must be ACTIVE")
  }

  const deactivatesDefault =
    existing.isDefault &&
    !wantsDefaultOn &&
    (status !== "ACTIVE" || wantsDefaultOff)

  if (deactivatesDefault) {
    const replacement = await prisma.appHostingCluster.findFirst({
      where: {
        id: { not: id },
        status: "ACTIVE",
        isDefault: true,
      },
    })
    if (!replacement) {
      throwInvalidDefault("An active default replacement is required")
    }
  }

  if (wantsDefaultOn) {
    return prisma.$transaction(async (tx) => {
      await tx.appHostingCluster.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
      const row = await tx.appHostingCluster.update({
        where: { id },
        data: { status, isDefault: true },
        include: clusterInclude,
      })
      return toClusterDTO(row)
    })
  }

  const row = await prisma.appHostingCluster.update({
    where: { id },
    data: {
      status,
      ...(opts?.isDefault !== undefined && { isDefault: opts.isDefault }),
    },
    include: clusterInclude,
  })
  return toClusterDTO(row)
}

const getVaultClient = (): Pick<VaultClient, "writeKV"> => new VaultClient()

export async function upsertClusterIntegration(
  clusterId: string,
  type: AppHostingClusterIntegrationType,
  input: UpsertIntegrationInput,
  vaultClient?: Pick<VaultClient, "writeKV">
) {
  const client = vaultClient ?? getVaultClient()
  throwIfNotFound(
    await prisma.appHostingCluster.findUnique({ where: { id: clusterId } }),
    "Cluster"
  )

  const existing = await prisma.appHostingClusterIntegration.findUnique({
    where: { clusterId_type: { clusterId, type } },
  })
  const existingSecrets = existing
    ? decryptClusterIntegrationSecrets(
        existing.secretCiphertext,
        existing.keyVersion
      )
    : {}
  const validated = validateIntegrationConfig(
    type,
    input.metaJson,
    input.secrets ?? {},
    existingSecrets
  )

  // Convert all secrets to string map for Vault KV v2 storage
  const stringSecrets: Record<string, string> = {}
  for (const [k, v] of Object.entries(validated.secrets)) {
    if (v !== undefined && v !== null) {
      stringSecrets[k] = String(v)
    }
  }

  const vaultPath = `admin/clusters/${clusterId}/integrations/${type}`
  let vaultVersion: number | undefined
  try {
    const writeResult = await client.writeKV(vaultPath, stringSecrets)
    vaultVersion = writeResult.version
  } catch (error) {
    // Vault write failure log - proceed or allow for resilient operations
    console.warn(
      `[Vault] Failed to write cluster integration secrets to ${vaultPath}:`,
      error
    )
  }

  const metadataWithVault = {
    ...validated.metadata,
    vaultPath,
    ...(vaultVersion !== undefined && { vaultVersion }),
  }

  const secretCiphertext = encryptClusterIntegrationSecrets(validated.secrets)
  const secretPreview = maskClusterIntegrationSecret(validated.secrets)

  const row = await prisma.appHostingClusterIntegration.upsert({
    where: { clusterId_type: { clusterId, type } },
    create: {
      clusterId,
      type,
      metaJson: metadataWithVault as Prisma.InputJsonValue,
      secretCiphertext,
      secretPreview,
    },
    update: {
      metaJson: metadataWithVault as Prisma.InputJsonValue,
      secretCiphertext,
      secretPreview,
    },
  })
  await invalidateClusterIntegrationCache(clusterId, type)

  return {
    id: row.id,
    type: row.type,
    metaJson: row.metaJson,
    secretPreview: row.secretPreview,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function updateClusterIntegrationStatus(
  clusterId: string,
  type: AppHostingClusterIntegrationType,
  isActive: boolean
) {
  throwIfNotFound(
    await prisma.appHostingCluster.findUnique({ where: { id: clusterId } }),
    "Cluster"
  )

  const integration = throwIfNotFound(
    await prisma.appHostingClusterIntegration.findFirst({
      where: { clusterId, type },
    }),
    "Integration"
  )

  const row = await prisma.appHostingClusterIntegration.update({
    where: { id: integration.id },
    data: { isActive },
  })
  await invalidateClusterIntegrationCache(clusterId, type)

  // Secret-safe DTO
  return {
    id: row.id,
    type: row.type,
    metaJson: row.metaJson,
    secretPreview: row.secretPreview,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function deleteClusterIntegration(
  clusterId: string,
  type: AppHostingClusterIntegrationType
) {
  throwIfNotFound(
    await prisma.appHostingCluster.findUnique({ where: { id: clusterId } }),
    "Cluster"
  )

  const integration = throwIfNotFound(
    await prisma.appHostingClusterIntegration.findFirst({
      where: { clusterId, type },
    }),
    "Integration"
  )

  await prisma.appHostingClusterIntegration.delete({
    where: { id: integration.id },
  })
  await invalidateClusterIntegrationCache(clusterId, type)

  return {
    id: integration.id,
    clusterId,
    type,
    deleted: true,
  }
}
