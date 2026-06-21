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

export type ProvisioningSummary = {
  active: number
  pending: number
  failed: number
  revoked: number
  total: number
}

export type VpnSubscriptionDTO = {
  id: string
  organizationId: string
  organizationName: string | null
  packageId: string
  status: SubscriptionPayload["status"]
  currentPeriodStart: string
  currentPeriodEnd: string
  deviceCount: number
  serverAccounts: VpnServerAccountDTO[]
  provisioningSummary: ProvisioningSummary
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

export function computeProvisioningSummary(
  accounts: VpnServerAccountDTO[]
): ProvisioningSummary {
  const summary: ProvisioningSummary = {
    active: 0,
    pending: 0,
    failed: 0,
    revoked: 0,
    total: accounts.length,
  }
  for (const account of accounts) {
    switch (account.provisioningStatus) {
      case "ACTIVE":
        summary.active++
        break
      case "PENDING":
      case "PROVISIONING":
        summary.pending++
        break
      case "FAILED":
        summary.failed++
        break
      case "REVOKED":
        summary.revoked++
        break
    }
  }
  return summary
}

export function toVpnSubscriptionDTO(
  subscription: SubscriptionPayload,
  orgName: string | null = null
): VpnSubscriptionDTO {
  const accounts = subscription.serverAccounts.map(toServerAccountDTO)
  return {
    id: subscription.id,
    organizationId: subscription.organizationId,
    organizationName: orgName ?? null,
    packageId: subscription.packageId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    deviceCount: subscription._count.mobileDevices,
    serverAccounts: accounts,
    provisioningSummary: computeProvisioningSummary(accounts),
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
