import type { Prisma } from "@prisma/client"

type SubscriptionPayload = Prisma.VpnSubscriptionGetPayload<{
  include: {
    serverAccounts: {
      include: {
        server: {
          select: {
            id: true
            name: true
            hostname: true
            ipAddress: true
            openVpnPort: true
            wireGuardPort: true
            proxyPort: true
            region: {
              select: { id: true; name: true; slug: true; countryCode: true }
            }
          }
        }
      }
    }
    _count: {
      select: { mobileDevices: true }
    }
  }
}>

type ServerAccount = SubscriptionPayload["serverAccounts"][number]

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type BillingAdjustmentPayload = Prisma.BillingAdjustmentGetPayload<{}>

export type VpnSubscriptionPaymentDTO = {
  id: BillingAdjustmentPayload["id"]
  amount: string
  currency: BillingAdjustmentPayload["currency"]
  paidAt: string | null
  reason: BillingAdjustmentPayload["reason"]
}

export function toVpnSubscriptionPaymentDTO(
  payment: Pick<
    BillingAdjustmentPayload,
    "id" | "amount" | "currency" | "appliedAt" | "reason"
  >
): VpnSubscriptionPaymentDTO {
  return {
    id: payment.id,
    amount: payment.amount.toString(),
    currency: payment.currency,
    paidAt: payment.appliedAt?.toISOString() ?? null,
    reason: payment.reason,
  }
}

type VpnSubscriptionBillingDTO = {
  firstPayment: VpnSubscriptionPaymentDTO | null
}

type VpnSubscriptionDTOOptions = {
  billing?: Partial<VpnSubscriptionBillingDTO>
}

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
  hostname: string
  ipAddress: string | null
  region: { name: string; slug: string; countryCode: string } | null
  port: number | null
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
  packageName: string
  status: SubscriptionPayload["status"]
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  deviceCount: number
  serverAccounts: VpnServerAccountDTO[]
  provisioningSummary: ProvisioningSummary
  // Multi-currency audit fields
  priceLocked: string
  currency: string
  originalPrice: string | null
  originalCurrency: string | null
  exchangeRate: number | null
  firstPayment: VpnSubscriptionPaymentDTO | null
  createdAt: string
  updatedAt: string
}

export function toServerAccountDTO(
  account: ServerAccount
): VpnServerAccountDTO {
  // ponytail: port is protocol-specific, simple ternary
  const port =
    account.protocol === "OPENVPN"
      ? account.server.openVpnPort
      : account.protocol === "WIREGUARD"
        ? account.server.wireGuardPort
        : account.protocol === "PROXY"
          ? account.server.proxyPort
          : null

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
    hostname: account.server.hostname,
    ipAddress: account.server.ipAddress,
    region: account.server.region
      ? {
          name: account.server.region.name,
          slug: account.server.region.slug,
          countryCode: account.server.region.countryCode,
        }
      : null,
    port,
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
  orgName: string | null = null,
  packageName: string | null = null,
  options: VpnSubscriptionDTOOptions = {}
): VpnSubscriptionDTO {
  const accounts = subscription.serverAccounts.map(toServerAccountDTO)
  return {
    id: subscription.id,
    organizationId: subscription.organizationId,
    organizationName: orgName ?? null,
    packageId: subscription.packageId,
    packageName: packageName ?? "Unknown Package",
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
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
    firstPayment: options.billing?.firstPayment ?? null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  }
}

/** List DTO — same as VpnSubscriptionDTO but without serverAccounts (saves bandwidth). */
export type VpnSubscriptionListDTO = Omit<VpnSubscriptionDTO, "serverAccounts">

export function toVpnSubscriptionListDTO(
  subscription: SubscriptionPayload,
  orgName: string | null = null,
  packageName: string | null = null,
  options: VpnSubscriptionDTOOptions = {}
): VpnSubscriptionListDTO {
  const accounts = subscription.serverAccounts.map(toServerAccountDTO)
  return {
    id: subscription.id,
    organizationId: subscription.organizationId,
    organizationName: orgName ?? null,
    packageId: subscription.packageId,
    packageName: packageName ?? "Unknown Package",
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    deviceCount: subscription._count.mobileDevices,
    provisioningSummary: computeProvisioningSummary(accounts),
    priceLocked: subscription.priceLocked.toString(),
    currency: subscription.currency,
    originalPrice: subscription.originalPrice?.toString() ?? null,
    originalCurrency: subscription.originalCurrency ?? null,
    exchangeRate: subscription.exchangeRate
      ? Number(subscription.exchangeRate)
      : null,
    firstPayment: options.billing?.firstPayment ?? null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  }
}
