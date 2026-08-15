import { Prisma, type PrismaClient } from "@prisma/client"

import { logAuditEvent } from "@/lib/audit.service"
import { prisma as defaultPrisma } from "@/lib/prisma"
import { BillingOrderService } from "@/modules/billing/orders/order.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
export { buildAccountUsername } from "./vpn-account-username"
import { CurrencyService } from "@/modules/billing/currency.service"
import { vpnEmailService } from "@/modules/vpn/email.service"
import type { VpnEmailService } from "@/modules/vpn/email.service"
import { isCurrentVpnPackageOffer } from "./vpn-package-pricing"

const subscriptionInclude = {
  serverAccounts: {
    include: {
      server: {
        select: {
          id: true,
          name: true,
          hostname: true,
          ipAddress: true,
          openVpnPort: true,
          wireGuardPort: true,
          proxyPort: true,
          region: {
            select: { id: true, name: true, slug: true, countryCode: true },
          },
        },
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

export type PurchaseInput = {
  organizationId: string
  packageId: string
  pricingId: string
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
  private readonly emailService: VpnEmailService
  private readonly orders: BillingOrderService

  constructor(
    prisma: PrismaLike = defaultPrisma,
    options: {
      transactions?: BillingTransactionService
      dispatch?: ProvisioningDispatcher
      currency?: CurrencyService
      emailService?: VpnEmailService
      orders?: BillingOrderService
    } = {}
  ) {
    this.prisma = prisma
    this.transactions =
      options.transactions ?? new BillingTransactionService(prisma)
    this.dispatch = options.dispatch ?? (async () => {})
    this.currency = options.currency ?? new CurrencyService(prisma)
    this.emailService = options.emailService ?? vpnEmailService
    this.orders = options.orders ?? new BillingOrderService(prisma)
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

  async listAll(
    query: {
      orgId?: string
      packageId?: string
      status?: "ACTIVE" | "SUSPENDED" | "EXPIRED"
      periodStartFrom?: string
      periodStartTo?: string
      q?: string
      page?: number
      limit?: number
    } = {}
  ): Promise<{ data: VpnSubscriptionWithAccounts[]; total: number }> {
    const where: Prisma.VpnSubscriptionWhereInput = {}

    if (query.orgId) where.organizationId = query.orgId
    if (query.packageId) where.packageId = query.packageId
    if (query.status) where.status = query.status
    if (query.periodStartFrom || query.periodStartTo) {
      where.currentPeriodStart = {}
      if (query.periodStartFrom)
        where.currentPeriodStart.gte = new Date(query.periodStartFrom)
      if (query.periodStartTo)
        where.currentPeriodStart.lte = new Date(query.periodStartTo)
    }
    // ponytail: server-side q only searches id + organizationId.
    // Full org name search is client-side on the loaded page.
    if (query.q) {
      where.OR = [
        { id: { contains: query.q } },
        { organizationId: { contains: query.q } },
      ]
    }

    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.prisma.vpnSubscription.findMany({
        where,
        include: subscriptionInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.vpnSubscription.count({ where }),
    ])

    return { data, total }
  }

  getById(id: string) {
    return this.prisma.vpnSubscription.findUnique({
      where: { id },
      include: subscriptionInclude,
    })
  }

  async purchase(input: PurchaseInput): Promise<VpnSubscriptionWithAccounts> {
    const now = input.now ?? new Date()
    const pkg = await this.prisma.vpnPackage.findUnique({
      where: { id: input.packageId },
      include: { servers: { include: { server: true } }, servicePlan: true },
    })
    if (!pkg || !pkg.isActive || !pkg.servicePlan.isActive) {
      throw new VpnPackageUnavailableError()
    }

    const pricing = await this.prisma.servicePricing.findUnique({
      where: { id: input.pricingId },
      include: { servicePlan: true },
    })
    if (
      !pricing ||
      pricing.planId !== pkg.servicePlanId ||
      !isCurrentVpnPackageOffer(pricing, now)
    ) {
      throw new VpnPackageUnavailableError(
        "Selected pricing is not available for this package."
      )
    }

    const duplicate = await this.prisma.vpnSubscription.findFirst({
      where: {
        organizationId: input.organizationId,
        packageId: input.packageId,
        status: "ACTIVE",
      },
    })
    if (duplicate) throw new VpnDuplicateSubscriptionError()

    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    let order
    try {
      order = await this.orders.createOrder({
        organizationId: input.organizationId,
        pricingId: input.pricingId,
        idempotencyKey: `vpn-package:${input.organizationId}:${input.packageId}:${input.pricingId}:${period}`,
        metadata: {
          vpnPackageId: input.packageId,
          packageId: input.packageId,
          planId: pkg.servicePlanId,
          period,
        },
        now,
        prorateMonthly: pricing.billingPeriod === "MONTHLY",
      })
      const charged = await this.orders.chargeOrder(order.orderId)
      await this.orders.fulfillOrder(charged.orderId, {
        vpnPackageId: input.packageId,
        packageId: input.packageId,
        planId: pkg.servicePlanId,
      })
    } catch (error) {
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

    const activated = await this.prisma.vpnSubscription.findFirst({
      where: {
        organizationId: input.organizationId,
        packageId: input.packageId,
      },
      include: subscriptionInclude,
      orderBy: { createdAt: "desc" },
    })
    if (!activated) throw new VpnSubscriptionNotFoundError()

    logAuditEvent({
      organizationId: activated.organizationId,
      subscriptionId: activated.id,
      action: "SUBSCRIPTION_CREATED",
      status: "OK",
      message: `Subscription created for org ${activated.organizationId}: package ${input.packageId}, ${activated.serverAccounts.length} accounts`,
      details: {
        packageId: input.packageId,
        pricingId: input.pricingId,
        organizationId: input.organizationId,
        serverAccountCount: activated.serverAccounts.length,
      },
    }).catch(() => {})

    this.emailService
      .sendSubscriptionCreated(activated.organizationId, pkg.name)
      .catch(() => {})

    return activated
  }

  /**
   * Reinstate a previously cancelled subscription. The subscription will
   * resume normal billing at the next period end instead of expiring.
   * Only valid when `cancelAtPeriodEnd` is true.
   */
  async reinstate(
    organizationId: string,
    id: string,
    reason?: string
  ): Promise<VpnSubscriptionWithAccounts> {
    const existing = await this.prisma.vpnSubscription.findFirst({
      where: { id, organizationId },
    })
    if (!existing) throw new VpnSubscriptionNotFoundError()
    if (!existing.cancelAtPeriodEnd) {
      throw new Error("Subscription is not pending cancellation.")
    }

    const updated = await this.prisma.vpnSubscription.update({
      where: { id: existing.id },
      data: { cancelAtPeriodEnd: false },
      include: subscriptionInclude,
    })

    logAuditEvent({
      organizationId,
      subscriptionId: id,
      action: "SUBSCRIPTION_REINSTATED",
      status: "OK",
      message: `Subscription reinstated (cancellation undone). Reason: ${reason ?? "Not provided"}`,
      details: { reason: reason ?? null },
    }).catch(() => {})

    return updated
  }

  /**
   * Cancel a subscription at period end (no refund, Story 16). The customer
   * keeps access until `currentPeriodEnd`; the renewal worker then lets it
   * lapse instead of charging again.
   */
  async cancelAtPeriodEnd(
    organizationId: string,
    id: string,
    reason?: string
  ): Promise<VpnSubscriptionWithAccounts> {
    const existing = await this.prisma.vpnSubscription.findFirst({
      where: { id, organizationId },
    })
    if (!existing) throw new VpnSubscriptionNotFoundError()

    const updated = await this.prisma.vpnSubscription.update({
      where: { id: existing.id },
      data: { cancelAtPeriodEnd: true },
      include: subscriptionInclude,
    })

    logAuditEvent({
      organizationId,
      subscriptionId: id,
      action: "SUBSCRIPTION_CANCELLED",
      status: "OK",
      message: `Subscription cancelled at period end: ${existing.currentPeriodEnd.toISOString()}. Reason: ${reason ?? "Not provided"}`,
      details: {
        currentPeriodEnd: existing.currentPeriodEnd.toISOString(),
        reason: reason ?? null,
      },
    }).catch(() => {})

    this.emailService
      .sendSubscriptionCancelled(
        organizationId,
        undefined,
        existing.currentPeriodEnd.toISOString()
      )
      .catch(() => {})

    return updated
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
