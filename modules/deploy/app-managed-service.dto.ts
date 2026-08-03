import type { AppManagedServiceCredential } from "@/modules/deploy/app-managed-service.types"

export type AppManagedServiceCredentialDTO = {
  id: string
  clusterId: string
  serviceType: AppManagedServiceCredential["serviceType"]
  endpointHost: string
  endpointPort: number
  tlsEnabled: boolean
  username: string | null
  secretPreview: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function toAppManagedServiceCredentialDTO(
  row: AppManagedServiceCredential
): AppManagedServiceCredentialDTO {
  return {
    id: row.id,
    clusterId: row.clusterId,
    serviceType: row.serviceType,
    endpointHost: row.endpointHost,
    endpointPort: row.endpointPort,
    tlsEnabled: row.tlsEnabled,
    username: row.username,
    secretPreview: row.secretPreview,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
