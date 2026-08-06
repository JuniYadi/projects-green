import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/prisma"
import { emitBillingAudit } from "./audit/audit.service"
import type {
  SubscriptionTransitionSnapshot,
  CancelSubscriptionResult,
  ReinstateSubscriptionResult,
  ChangePlanResult,
  ChangePlanPreviewResult,
} from "./lifecycle.dto"
import { resolveRecurringPrice } from "./pricing/pricing.service"

// ─── Error classes ─────────────────────────────────────────────────────────────

export class SubscriptionNotFoundError extends Error {
  readonly code = "SUBSCRIPTION_NOT_FOUND" as const
  constructor() {
    super("Subscription not found.")
  }
}

export class SubscriptionAlreadyCancelledError extends Error {
  readonly code = "SUBSCRIPTION_ALREADY_CANCELLED" as const
  constructor() {
    super("Subscription is already cancelled.")
  }
}

export class PricingNotFoundError extends Error {
  readonly code = "PRICING_NOT_FOUND" as const
  constructor() {
    super("Pricing not found.")
  }
}

export class SamePlanError extends Error {
  readonly code = "SAME_PLAN" as const
  constructor() {
    super("New pricing is the same as current.")
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIOD_MONTHS: Record<string, 1 | 3 | 6 | 12> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

function getMeta(sub: {
  metadata: Prisma.JsonValue | null
}): Record<string, unknown> {
  if (!sub.metadata || typeof sub.metadata !== "object") return {}
  return sub.metadata as Record<string, unknown>
}

function isCancelledAtPeriodEnd(sub: {
  metadata: Prisma.JsonValue | null
}): boolean {
  return getMeta(sub).cancelledAtPeriodEnd === true
}

function toJsonInput(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}

function toSnapshot(sub: {
  id: string
  status: string
  billingPeriod: string
  pricingId: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  allocatedConfig: Prisma.JsonValue | null
  metadata: Prisma.JsonValue | null
  pricing: {
    billingMode: string
    type: string
    basePriceIdr: Prisma.Decimal
    periodPrice: Prisma.Decimal | null
    currency: string
    billingPeriod: string | null
    region: { code: string }
    servicePlan: { code: string; packageId: string }
  }
  plan: { code: string }
  package: { code: string }
}): SubscriptionTransitionSnapshot {
  const period = (sub.billingPeriod as keyof typeof PERIOD_MONTHS) ?? "MONTHLY"
  const periodMonths = PERIOD_MONTHS[period] ?? 1
  return {
    id: sub.id,
    packageCode: sub.package.code,
    planCode: sub.plan.code,
    regionCode: sub.pricing.region.code,
    pricingId: sub.pricingId,
    billingMode: sub.pricing.billingMode,
    type: sub.pricing.type,
    status: sub.status,
    billingPeriod: sub.pricing.billingPeriod ?? sub.billingPeriod,
    periodMonths,
    periodPrice:
      sub.pricing.periodPrice?.toString?.() ??
      sub.pricing.basePriceIdr.toString(),
    currency: sub.pricing.currency,
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    allocatedConfig: sub.allocatedConfig as Record<string, unknown> | null,
    cancelAtPeriodEnd: isCancelledAtPeriodEnd(sub),
  }
}

const subscriptionInclude = {
  pricing: {
    include: {
      region: { select: { code: true } as const },
      servicePlan: { select: { code: true, packageId: true } as const },
    },
  },
  plan: { select: { code: true } as const },
  package: { select: { code: true } as const },
} as const

// ─── Service ──────────────────────────────────────────────────────────────────

export class SubscriptionLifecycleService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Cancel a subscription at period end.
   * Sets cancelledAtPeriodEnd in metadata — renewal worker won't charge again.
   * Customer keeps access until currentPeriodEnd.
   */
  async cancelAtPeriodEnd(
    organizationId: string,
    subscriptionId: string,
    reason?: string
  ): Promise<CancelSubscriptionResult> {
    const sub = await this.prisma.serviceSubscription.findFirst({
      where: { id: subscriptionId, organizationId },
      include: subscriptionInclude,
    })

    if (!sub) throw new SubscriptionNotFoundError()
    if (sub.status === "CANCELLED")
      throw new SubscriptionAlreadyCancelledError()

    const existingMeta = getMeta(sub)

    const updated = await this.prisma.serviceSubscription.update({
      where: { id: subscriptionId },
      data: {
        metadata: toJsonInput({
          ...existingMeta,
          cancelledAtPeriodEnd: true,
          cancelledReason: reason ?? null,
          cancelledAt: new Date().toISOString(),
        }),
      },
      include: subscriptionInclude,
    })

    emitBillingAudit({
      entityType: "ServiceSubscription",
      entityId: subscriptionId,
      action: "SUBSCRIPTION_CANCELLED",
      actorId: undefined,
      context: {
        reason: reason ?? null,
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        mode: "AT_PERIOD_END",
        previousCancelledAtPeriodEnd:
          existingMeta.cancelledAtPeriodEnd ?? false,
      },
    })

    return {
      ok: true,
      transition: "CANCELLED_AT_PERIOD_END",
      effectiveDate: sub.currentPeriodEnd.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      subscription: toSnapshot(
        updated as unknown as Parameters<typeof toSnapshot>[0]
      ),
    }
  }

  /**
   * Reinstate a subscription that was cancelled at period end.
   * Clears the cancelledAtPeriodEnd flag in metadata.
   */
  async reinstate(
    organizationId: string,
    subscriptionId: string,
    reason?: string
  ): Promise<ReinstateSubscriptionResult> {
    const sub = await this.prisma.serviceSubscription.findFirst({
      where: { id: subscriptionId, organizationId },
      include: subscriptionInclude,
    })

    if (!sub) throw new SubscriptionNotFoundError()

    const existingMeta = getMeta(sub)
    if (existingMeta.cancelledAtPeriodEnd !== true)
      throw new SubscriptionNotFoundError()

    const {
      cancelledAtPeriodEnd: _,
      cancelledReason: __,
      cancelledAt: ___,
      ...cleanMeta
    } = existingMeta
    void __
    void ___

    const updated = await this.prisma.serviceSubscription.update({
      where: { id: subscriptionId },
      data: {
        metadata:
          Object.keys(cleanMeta).length > 0
            ? toJsonInput(cleanMeta)
            : Prisma.JsonNull,
      },
      include: subscriptionInclude,
    })

    emitBillingAudit({
      entityType: "ServiceSubscription",
      entityId: subscriptionId,
      action: "SUBSCRIPTION_REINSTATED",
      actorId: undefined,
      context: {
        reason: reason ?? null,
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      },
    })

    return {
      ok: true,
      transition: "REINSTATED",
      effectiveDate: new Date().toISOString(),
      subscription: toSnapshot(
        updated as unknown as Parameters<typeof toSnapshot>[0]
      ),
    }
  }

  /**
   * Preview a plan/term change — pricing info and effective date, no commit.
   */
  async previewChangePlan(
    organizationId: string,
    subscriptionId: string,
    newPricingId: string
  ): Promise<ChangePlanPreviewResult> {
    const [sub, newPricing] = await Promise.all([
      this.prisma.serviceSubscription.findFirst({
        where: { id: subscriptionId, organizationId },
        select: {
          id: true,
          pricingId: true,
          currentPeriodEnd: true,
        },
      }),
      this.prisma.servicePricing.findUnique({
        where: { id: newPricingId },
        include: {
          servicePlan: true,
          region: true,
        },
      }),
    ])

    if (!sub) throw new SubscriptionNotFoundError()
    if (!newPricing) throw new PricingNotFoundError()

    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId },
      select: { currency: true },
    })
    const currency = account?.currency ?? "IDR"

    const resolved = await resolveRecurringPrice({
      pricingId: newPricingId,
      currency,
      at: new Date(),
    })

    return {
      ok: true,
      newPricingId,
      newPlanCode: resolved.planCode,
      newBillingPeriod: resolved.billingPeriod,
      newPeriodMonths: resolved.periodMonths,
      newPeriodPrice: resolved.periodPrice.toString(),
      newCurrency: resolved.currency,
      effectiveDate: sub.currentPeriodEnd.toISOString(),
      immediateCharge: null,
    }
  }

  /**
   * Change subscription's pricing (plan + term). Takes effect at next period.
   */
  async changePlan(
    organizationId: string,
    subscriptionId: string,
    newPricingId: string
  ): Promise<ChangePlanResult> {
    const [sub, newPricing] = await Promise.all([
      this.prisma.serviceSubscription.findFirst({
        where: { id: subscriptionId, organizationId },
        include: subscriptionInclude,
      }),
      this.prisma.servicePricing.findUnique({
        where: { id: newPricingId },
        include: {
          servicePlan: true,
          region: true,
        },
      }),
    ])

    if (!sub) throw new SubscriptionNotFoundError()
    if (!newPricing) throw new PricingNotFoundError()
    if (sub.pricingId === newPricingId) throw new SamePlanError()

    const updated = await this.prisma.serviceSubscription.update({
      where: { id: subscriptionId },
      data: {
        pricingId: newPricingId,
        planId: newPricing.planId,
      },
      include: subscriptionInclude,
    })

    emitBillingAudit({
      entityType: "ServiceSubscription",
      entityId: subscriptionId,
      action: "UPDATED",
      actorId: undefined,
      context: {
        previousPricingId: sub.pricingId,
        newPricingId,
        newPlanCode: updated.plan.code,
        newBillingPeriod: updated.pricing.billingPeriod,
      },
    })

    return {
      ok: true,
      transition: "PLAN_CHANGED",
      effectiveDate: sub.currentPeriodEnd.toISOString(),
      previousPricingId: sub.pricingId,
      newPricingId,
      subscription: toSnapshot(
        updated as unknown as Parameters<typeof toSnapshot>[0]
      ),
    }
  }
}
