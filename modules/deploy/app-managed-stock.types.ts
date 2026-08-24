export type ImportManagedStockInput = {
  clusterId: string
  serviceType: "MYSQL" | "POSTGRESQL" | "REDIS"
  label?: string
  endpointHost: string
  endpointPort: number
  databaseName: string
  username: string
  password: string
  connectionUrl?: string
  tlsEnabled?: boolean
}

export type ManagedStockDTO = {
  id: string
  clusterId: string
  serviceType: string
  label: string | null
  endpointHost: string
  endpointPort: number
  databaseName: string
  username: string
  tlsEnabled: boolean
  vaultPath: string
  vaultVersion: number
  status: string
  allocatedStackId: string | null
  allocatedAt: string | null
  createdAt: string
  updatedAt: string
}
