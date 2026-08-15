import type { WhatsappOrganizationApiKey } from "@prisma/client"

export type WhatsappOrganizationApiKeyDTO = {
  id: string
  organizationId: string
  fingerprint: string
  status: "ACTIVE" | "REVOKED"
  createdAt: string
  rotatedAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

export type WhatsappOrganizationApiKeyInventoryStatus =
  | "ACTIVE"
  | "REVOKED"
  | "NOT_GENERATED"

export type WhatsappOrganizationApiKeyInventoryRowDTO = {
  organizationId: string
  organizationName: string
  status: WhatsappOrganizationApiKeyInventoryStatus
  keyId: string | null
  fingerprint: string | null
  generatedKeyCount: number
  createdAt: string | null
  rotatedAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

export type WhatsappOrganizationApiKeyInventoryDTO = {
  data: WhatsappOrganizationApiKeyInventoryRowDTO[]
  summary: {
    generatedKeyTotal: number
    organizationsWithActiveKey: number
    organizationsWithoutActiveKey: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function toWhatsappOrganizationApiKeyDTO(
  key: Pick<
    WhatsappOrganizationApiKey,
    | "id"
    | "organizationId"
    | "fingerprint"
    | "status"
    | "createdAt"
    | "rotatedAt"
    | "revokedAt"
    | "lastUsedAt"
  >
): WhatsappOrganizationApiKeyDTO {
  return {
    id: key.id,
    organizationId: key.organizationId,
    fingerprint: key.fingerprint,
    status: key.status,
    createdAt: key.createdAt.toISOString(),
    rotatedAt: key.rotatedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
  }
}
