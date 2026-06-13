import {
  Prisma,
  type PrismaClient,
  type VpnProtocol,
} from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

const subscriptionInclude = {
  serverAccounts: {
    include: {
      server: {
        select: { id: true, name: true, hostname: true },
      },
    },
  },
} satisfies Prisma.VpnSubscriptionInclude

export type VpnSubscriptionWithAccounts = Prisma.VpnSubscriptionGetPayload<{
  include: typeof subscriptionInclude
}>

export type ProvisioningDispatcher = (serverAccountId: string) => Promise<void>

export class VpnPackageUnavailableError extends Error {
  constructor(message = "Package is not available for purchase.") {
    super(message)
    this.name = "VpnPackageUnavailableError"
  }
}

export class VpnDuplicateSubscriptionError extends Error {
  constructor(
    message = "An active subscription for this package already exists."
  ) {
    super(message)
    this.name = "VpnDuplicateSubscriptionError"
  }
}

export class VpnInsufficientBalanceError extends Error {
  constructor(message = "Insufficient balance for this purchase.") {
    super(message)
    this.name = "VpnInsufficientBalanceError"
  }
}

type PrismaLike = PrismaClient

/** Enabled protocols on a server, derived from its feature flags. */
function enabledProtocols(server: {
  hasOpenVpn: boolean
  hasWireGuard: boolean
  hasProxy: boolean
}): VpnProtocol[] {
  const protocols: VpnProtocol[] = []
  if (server.hasOpenVpn) protocols.push("OPENVPN")
  if (server.hasWireGuard) protocols.push("WIREGUARD")
  if (server.hasProxy) protocols.push("PROXY")
  return protocols
}

/**
 * Username scheme from Story 14: `vpn-{orgId}-{serverId}-{protocol}`,
 * sanitized to the adapter-safe charset.
 */
export function buildAccountUsername(
  organizationId: string,
  serverId: string,
  protocol: VpnProtocol
): string {
  const safeOrg = organizationId.replace(/[^A-Za-z0-9]/g, "").slice(0, 16)
  const safeServer = serverId.replace(/[^A-Za-z0-9]/g, "").slice(0, 16)
  return `vpn-${safeOrg}-${safeServer}-${protocol.toLowerCase()}`
}

export type PurchaseInput = {
  organizationId: string
  packageId: string
}

/**
 * Owns VPN package purchase + subscription creation (Story 14).
 *
 * Flow: validate package + no active duplicate → debit balance upfront via
 * BillingTransactionService → create subscription + one PENDING server account
 * per protocol per server → dispatch one provisioning job per account. The
 * balance debit is idempotent on the subscription id + period.
 */
export class VpnSubscriptionService {
  private readonly prisma: PrismaLike
  private readonly transactions: BillingTransactionService
  private readonly dispatch: ProvisioningDispatcher

  constructor(
    prisma: PrismaLike = defaultPrisma,
    options: {
      transactions?: BillingTransactionService
      dispatch?: ProvisioningDispatcher
    } = {}
  ) {
    this.prisma = prisma
    this.transactions =
      options.transactions ?? new BillingTransactionService(prisma)
    this.dispatch = options.dispatch ?? (async () => {})
  }

  listForOrganization(organizationId: string) {
    return this.prisma.vpnSubscription.findMany({
      where: { organizationId },
      include: subscriptionInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  getForOrganization(organizationId: string, id: string) {
    return this.prisma.vpnSubscription.findFirst({
      where: { id, organizationId },
      include: subscriptionInclude,
    })
  }

  listAll() {
    return this.prisma.vpnSubscription.findMany({
      include: subscriptionInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  getById(id: string) {
    return this.prisma.vpnSubscription.findUnique({
      where: { id },
      include: subscriptionInclude,
    })
  }

  async purchase(
    input: PurchaseInput
  ): Promise<VpnSubscriptionWithAccounts> {
    const pkg = await this.prisma.vpnPackage.findUnique({
      where: { id: input.packageId },
      include: { servers: { include: { server: true } } },
    })
    if (!pkg || !pkg.isActive) {
      throw new VpnPackageUnavailableError()
    }

    const existingActive = await this.prisma.vpnSubscription.findFirst({
      where: {
        organizationId: input.organizationId,
        packageId: input.packageId,
        status: "ACTIVE",
      },
    })
    if (existingActive) {
      throw new VpnDuplicateSubscriptionError()
    }

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)
    const period = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}`

    // Build the per-protocol account plan up front.
    const plan = pkg.servers.flatMap((entry) =>
      enabledProtocols(entry.server).map((protocol) => ({
        serverId: entry.server.id,
        protocol,
        username: buildAccountUsername(
          input.organizationId,
          entry.server.id,
          protocol
        ),
      }))
    )

    // Create the subscription first so the billing idempotency key is stable.
    const subscription = await this.prisma.vpnSubscription.create({
      data: {
        organizationId: input.organizationId,
        packageId: input.packageId,
        status: "SUSPENDED",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        serverAccounts: {
          create: plan.map((account) => ({
            serverId: account.serverId,
            protocol: account.protocol,
            username: account.username,
            provisioningStatus: "PENDING",
          })),
        },
      },
      include: subscriptionInclude,
    })

    // Billing gate: debit balance upfront. Leaves the subscription SUSPENDED
    // (no charge) when balance is insufficient.
    try {
      await this.transactions.debitServiceBalance({
        organizationId: input.organizationId,
        amount: pkg.price,
        currency: pkg.currency,
        source: "VPN",
        reason: `VPN package "${pkg.name}" monthly payment`,
        idempotencyKey: `vpn-package:${subscription.id}:${period}`,
        metadata: {
          vpnSubscriptionId: subscription.id,
          packageId: pkg.id,
          period,
        },
        line: {
          description: `VPN package "${pkg.name}" monthly payment`,
          quantity: new Prisma.Decimal(1),
          unitPrice: pkg.price,
          lineType: "SUBSCRIPTION",
        },
      })
    } catch (error) {
      if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
        throw new VpnInsufficientBalanceError()
      }
      throw error
    }

    // Charge succeeded → activate subscription and dispatch provisioning jobs.
    const activated = await this.prisma.vpnSubscription.update({
      where: { id: subscription.id },
      data: { status: "ACTIVE" },
      include: subscriptionInclude,
    })

    for (const account of activated.serverAccounts) {
      await this.dispatch(account.id)
    }

    return activated
  }
}

export const vpnSubscriptionService = new VpnSubscriptionService()
