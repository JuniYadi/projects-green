import type { Prisma } from "@prisma/client"

type SubscriptionPayload = Prisma.VpnSubscriptionGetPayload<{
  include: {
    serverAccounts: {
      include: {
        server: { select: { id: true; name: true; hostname: true } }
      }
    }
    _count: {
      select: { mobileDevices: true }
    }
  }
}>

type ServerAccount = SubscriptionPayload["serverAccounts"][number]

/**
 * Server-account DTO. Never exposes the stored config or password material —
 * those are downloaded through dedicated, scoped endpoints.
 */
export type VpnServerAccountDTO = {
  id: string
  serverId: string
  serverName: string
  protocol: ServerAccount["protocol"]
  username: string
  provisioningStatus: ServerAccount["provisioningStatus"]
  failureReason: string | null
  hasConfig: boolean
  hasCredentials: boolean
  createdAt: string
  updatedAt: string
}

export type VpnSubscriptionDTO = {
  id: string
  organizationId: string
  packageId: string
  status: SubscriptionPayload["status"]
  currentPeriodStart: string
  currentPeriodEnd: string
  deviceCount: number
  serverAccounts: VpnServerAccountDTO[]
  // Multi-currency audit fields
  priceLocked: string
  currency: string
  originalPrice: string | null
  originalCurrency: string | null
  exchangeRate: number | null
  createdAt: string
  updatedAt: string
}

function toServerAccountDTO(account: ServerAccount): VpnServerAccountDTO {
  return {
    id: account.id,
    serverId: account.serverId,
    serverName: account.server.name,
    protocol: account.protocol,
    username: account.username,
    provisioningStatus: account.provisioningStatus,
    failureReason: account.failureReason,
    hasConfig: account.configEncrypted !== null,
    hasCredentials: account.password !== null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

export function toVpnSubscriptionDTO(
  subscription: SubscriptionPayload
): VpnSubscriptionDTO {
  return {
    id: subscription.id,
    organizationId: subscription.organizationId,
    packageId: subscription.packageId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    deviceCount: subscription._count.mobileDevices,
    serverAccounts: subscription.serverAccounts.map(toServerAccountDTO),
    priceLocked: subscription.priceLocked.toString(),
    currency: subscription.currency,
    originalPrice: subscription.originalPrice?.toString() ?? null,
    originalCurrency: subscription.originalCurrency ?? null,
    exchangeRate: subscription.exchangeRate
      ? Number(subscription.exchangeRate)
      : null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  }
}
