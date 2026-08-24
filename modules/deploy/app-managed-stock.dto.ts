import type { AppManagedStock } from "@prisma/client"
import type { ManagedStockDTO } from "@/modules/deploy/app-managed-stock.types"

export type { ManagedStockDTO } from "@/modules/deploy/app-managed-stock.types"

export function toManagedStockDTO(row: AppManagedStock): ManagedStockDTO {
  return {
    id: row.id,
    clusterId: row.clusterId,
    serviceType: row.serviceType,
    label: row.label,
    endpointHost: row.endpointHost,
    endpointPort: row.endpointPort,
    databaseName: row.databaseName,
    username: row.username,
    tlsEnabled: row.tlsEnabled,
    vaultPath: row.vaultPath,
    vaultVersion: row.vaultVersion,
    status: row.status,
    allocatedStackId: row.allocatedStackId,
    allocatedAt: row.allocatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
