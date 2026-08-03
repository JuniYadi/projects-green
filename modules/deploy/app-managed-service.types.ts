export type AppManagedServiceType = "MYSQL" | "POSTGRESQL" | "REDIS"

export type AppManagedServiceCredentialStatus = "ACTIVE" | "INACTIVE"

export type AppManagedServiceCredential = {
  id: string
  clusterId: string
  serviceType: AppManagedServiceType
  endpointHost: string
  endpointPort: number
  tlsEnabled: boolean
  username: string | null
  secretPreview: string | null
  isActive: boolean
  keyVersion: number
  createdAt: Date
  updatedAt: Date
}

export type AppManagedServiceCredentialUpsertInput = {
  endpointHost: string
  endpointPort: number
  tlsEnabled?: boolean
  username?: string
  password?: string
  authToken?: string
  isActive?: boolean
}

export type AppManagedServiceCredentialStatusUpdateInput = {
  isActive: boolean
}

export type AppManagedServiceInternalConfig = {
  serviceType: AppManagedServiceType
  endpointHost: string
  endpointPort: number
  tlsEnabled: boolean
  username: string | null
  password: string | null
  authToken: string | null
}
