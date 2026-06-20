import crypto from "node:crypto"

import { Prisma, type PrismaClient, type VpnProtocol } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import {
  CurrencyService,
  CurrencyNotFoundError,
} from "@/modules/billing/currency.service"

const subscriptionInclude = {
  serverAccounts: {
    include: {
      server: {
        select: { id: true, name: true, hostname: true },
      },
    },
  },
  _count: {
    select: { mobileDevices: true },
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

export class VpnBillingAccountNotFoundError extends Error {
  constructor(
    message = "No billing account found. Please set up billing before making a purchase."
  ) {
    super(message)
    this.name = "VpnBillingAccountNotFoundError"
  }
}

export class VpnCurrencyNotSupportedError extends Error {
  constructor(
    message = "Currency conversion is not supported for this combination."
  ) {
    super(message)
    this.name = "VpnCurrencyNotSupportedError"
  }
}

export class VpnSubscriptionNotFoundError extends Error {
  constructor(message = "Subscription not found.") {
    super(message)
    this.name = "VpnSubscriptionNotFoundError"
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
 * sanitized to the adapter-safe charset. A 4-char hex suffix is appended
 * to ensure uniqueness when an org subscribes to the same package+protocol
 * multiple times (multi-sub).
 */
export function buildAccountUsername(
  organizationId: string,
  serverId: string,
  protocol: VpnProtocol
): string {
  const safeOrg = organizationId.replace(/[^A-Za-z0-9]/g, "").slice(0, 16)
  const safeServer = serverId.replace(/[^A-Za-z0-9]/g, "").slice(0, 16)
  const suffix = crypto.randomBytes(2).toString("hex")
  return `vpn-${safeOrg}-${safeServer}-${protocol.toLowerCase()}-${suffix}`
}

export type PurchaseInput = {
  organizationId: string
  packageId: string
  /** Override for testability (default: new Date()). */
  now?: Date
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
  private readonly currency: CurrencyService

  constructor(
    prisma: PrismaLike = defaultPrisma,
    options: {
      transactions?: BillingTransactionService
      dispatch?: ProvisioningDispatcher
      currency?: CurrencyService
    } = {}
  ) {
    this.prisma = prisma
    this.transactions =
      options.transactions ?? new BillingTransactionService(prisma)
    this.dispatch = options.dispatch ?? (async () => {})
    this.currency = options.currency ?? new CurrencyService(prisma)
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

  async purchase(input: PurchaseInput): Promise<VpnSubscriptionWithAccounts> {
    const pkg = await this.prisma.vpnPackage.findUnique({
      where: { id: input.packageId },
      include: { servers: { include: { server: true } } },
    })
    if (!pkg || !pkg.isActive) {
      throw new VpnPackageUnavailableError()
    }

    const now = input.now ?? new Date()
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
    ).getUTCDate()
    const dayOfMonth = now.getUTCDate()
    const daysRemaining = daysInMonth - dayOfMonth + 1

    // Align first period to end of current calendar month for pro-rata billing.
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    )
    const period = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}`

    // Pro-rate the first month charge when buying mid-cycle.
    const isFullMonth = dayOfMonth === 1
    const chargeAmount = isFullMonth
      ? pkg.price
      : pkg.price
          .mul(daysRemaining)
          .div(daysInMonth)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)
    const chargeQuantity = isFullMonth
      ? new Prisma.Decimal(1)
      : new Prisma.Decimal(daysRemaining).div(daysInMonth)

    // ── Currency conversion ────────────────────────────────────────
    // Fetch billing account to determine the charge currency.
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) {
      throw new VpnBillingAccountNotFoundError()
    }
    const accountCurrency = account.currency

    let chargePrice: Prisma.Decimal
    let exchangeRate: Prisma.Decimal

    if (pkg.currency === accountCurrency) {
      // Same currency — no conversion needed.
      chargePrice = chargeAmount
      exchangeRate = new Prisma.Decimal(1)
    } else {
      // Cross-currency — convert package price to billing account currency.
      try {
        chargePrice = await this.currency.convert(
          chargeAmount,
          pkg.currency,
          accountCurrency
        )
        // Compute exchange rate: units of accountCurrency per 1 unit of pkgCurrency
        const fromRate = await this.currency.getRate(pkg.currency)
        const toRate = await this.currency.getRate(accountCurrency)
        exchangeRate = toRate.div(fromRate)
      } catch (error) {
        if (
          error instanceof CurrencyNotFoundError ||
          (error instanceof Error && error.name === "CurrencyNotFoundError")
        ) {
          throw new VpnCurrencyNotSupportedError(
            `Cannot convert from ${pkg.currency} to ${accountCurrency}. Currency not supported.`
          )
        }
        throw error
      }
    }

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
        priceLocked: chargePrice,
        currency: accountCurrency,
        originalPrice: pkg.price,
        originalCurrency: pkg.currency,
        exchangeRate: exchangeRate,
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

    // Billing gate: debit balance upfront. If the charge fails for any reason
    // (no billing account, insufficient balance, unexpected error) we delete
    // the just-created subscription so failed attempts don't leave orphaned
    // SUSPENDED subscriptions + PENDING server accounts behind. The delete
    // cascades to serverAccounts (onDelete: Cascade).
    try {
      await this.transactions.debitServiceBalance({
        organizationId: input.organizationId,
        amount: chargePrice,
        currency: accountCurrency,
        source: "VPN",
        reason: `VPN package "${pkg.name}" monthly payment`,
        idempotencyKey: `vpn-package:${subscription.id}:${period}`,
        metadata: {
          vpnSubscriptionId: subscription.id,
          packageId: pkg.id,
          period,
        },
        line: {
          description: isFullMonth
            ? `VPN package "${pkg.name}" — ${period}`
            : `VPN package "${pkg.name}" — ${daysRemaining}/${daysInMonth} month (${period})`,
          quantity: chargeQuantity,
          unitPrice: chargePrice,
          lineType: "SUBSCRIPTION",
          category: "vpn",
        },
      })
    } catch (error) {
      await this.prisma.vpnSubscription
        .delete({ where: { id: subscription.id } })
        .catch(() => {
          // Best-effort cleanup. If the delete itself fails, surface the
          // original billing error rather than masking it.
        })
      if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
        throw new VpnInsufficientBalanceError()
      }
      if (
        error instanceof Error &&
        error.message === "BILLING_ACCOUNT_NOT_FOUND"
      ) {
        throw new VpnBillingAccountNotFoundError()
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

  /**
   * Cancel a subscription at period end (no refund, Story 16). The customer
   * keeps access until `currentPeriodEnd`; the renewal worker then lets it
   * lapse instead of charging again.
   */
  async cancelAtPeriodEnd(
    organizationId: string,
    id: string
  ): Promise<VpnSubscriptionWithAccounts> {
    const existing = await this.prisma.vpnSubscription.findFirst({
      where: { id, organizationId },
    })
    if (!existing) throw new VpnSubscriptionNotFoundError()

    return this.prisma.vpnSubscription.update({
      where: { id: existing.id },
      data: { cancelAtPeriodEnd: true },
      include: subscriptionInclude,
    })
  }

  /**
   * Billing info for a subscription: locked price, currency, period window,
   * and whether a cancellation is pending. Org-scoped.
   */
  async getBillingInfo(organizationId: string, id: string) {
    const sub = await this.prisma.vpnSubscription.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        priceLocked: true,
        currency: true,
        originalPrice: true,
        originalCurrency: true,
        exchangeRate: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        renewalFailedAt: true,
      },
    })
    if (!sub) throw new VpnSubscriptionNotFoundError()
    return sub
  }
}

export const vpnSubscriptionService = new VpnSubscriptionService()
