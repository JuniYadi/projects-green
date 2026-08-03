import type { AppManagedServiceType } from "@prisma/client"

export type { AppManagedServiceType } from "@prisma/client"

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
