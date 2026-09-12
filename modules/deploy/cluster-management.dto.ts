import type {
  AppHostingCluster,
  AppHostingClusterIntegration,
  AppHostingClusterIntegrationType,
  AppHostingClusterStatus,
} from "@prisma/client"

// ── Integration DTO (secret-safe) ────────────────────

export type ClusterIntegrationAdminDTO = {
  id: string
  type: AppHostingClusterIntegrationType
  metaJson: unknown
  secretPreview: string | null
  isActive: boolean
  /**
   * `isActive` is only a DB flag. These carry the last real probe, so the row
   * can read "Active · unreachable 19:58" instead of implying reachability.
   */
  lastTestAt: string | null
  lastTestOk: boolean | null
  lastTestMessage: string | null
  createdAt: string
  updatedAt: string
}

// ── Cluster DTO ──────────────────────────────────────

export type ClusterAdminDTO = {
  id: string
  code: string
  name: string
  region: string
  regionId: string | null
  status: AppHostingClusterStatus
  isDefault: boolean
  metadataJson: unknown | null
  integrations: ClusterIntegrationAdminDTO[]
  createdAt: string
  updatedAt: string
}

// ── Mappers ──────────────────────────────────────────

export function toClusterIntegrationDTO(
  row: AppHostingClusterIntegration
): ClusterIntegrationAdminDTO {
  return {
    id: row.id,
    type: row.type,
    metaJson: row.metaJson,
    secretPreview: row.secretPreview,
    isActive: row.isActive,
    lastTestAt: row.lastTestAt?.toISOString() ?? null,
    lastTestOk: row.lastTestOk,
    lastTestMessage: row.lastTestMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toClusterDTO(
  row: AppHostingCluster & {
    region?: { name: string } | null
    integrations?: AppHostingClusterIntegration[]
  }
): ClusterAdminDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    region: row.region?.name ?? "",
    regionId: row.regionId,
    status: row.status,
    isDefault: row.isDefault,
    metadataJson: row.metadataJson,
    integrations: (row.integrations ?? []).map(toClusterIntegrationDTO),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
