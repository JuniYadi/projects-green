import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import type { WhatsAppPlanResources } from "@/modules/billing/types"

type BillingOrderResultLike = { orderId: string; [key: string]: unknown }
type BillingOrders = {
  renewServiceSubscription(
    subscriptionId: string,
    now?: Date
  ): Promise<BillingOrderResultLike>
  chargeOrder(orderId: string): Promise<BillingOrderResultLike>
  fulfillOrder(orderId: string): Promise<BillingOrderResultLike>
}

// ─── Types ──────────────────────────────────────────────────────────────

export type WhatsappBillingDecision =
  | {
      kind: "ALLOWANCE"
      remainingDefaultAllowance: Prisma.Decimal
      remainingAddonAllowance: Prisma.Decimal
      defaultConsumed: Prisma.Decimal
      addonConsumed: Prisma.Decimal
    }
  | {
      kind: "OVERAGE_CHARGED"
      remainingDefaultAllowance: Prisma.Decimal
      remainingAddonAllowance: Prisma.Decimal
      defaultConsumed: Prisma.Decimal
      addonConsumed: Prisma.Decimal
      charged: Prisma.Decimal
      adjustmentId: string
    }

export type ChargeSubscriptionBaseInput = {
  organizationId: string
  subscriptionId: string
  pricingId: string
  unitPrice: Prisma.Decimal
  quantity: Prisma.Decimal
  periodStart: Date
  periodEnd: Date
  deviceIds: string[]
  period: string
  allowanceByDevice: Record<string, Prisma.Decimal | number>
}

export type OverageInput = {
  organizationId: string
  deviceId: string
  quotaCredit: Prisma.Decimal
  unitPrice: Prisma.Decimal
  idempotencyKey: string
}

// ─── Service ────────────────────────────────────────────────────────────
function metadataObject(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function jsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}

export class WhatsappBillingService {
  private orders?: BillingOrders

  constructor(
    private prisma: PrismaClient,
    private transactions: BillingTransactionService,
    orders?: BillingOrders
  ) {
    this.orders = orders
  }

  async chargeSubscriptionBase(input: ChargeSubscriptionBaseInput) {
    if (
      input.deviceIds.length === 0 ||
      !input.quantity.eq(input.deviceIds.length)
    ) {
      throw new Error("NO_ACTIVE_DEVICES")
    }
    const allowances: Record<string, string> = {}
    for (const deviceId of input.deviceIds) {
      const raw = input.allowanceByDevice[deviceId]
      if (raw === undefined)
        throw new Error("WHATSAPP_ALLOWANCE_METADATA_REQUIRED")
      const allowance = new Prisma.Decimal(raw)
      if (allowance.isNegative()) throw new Error("WHATSAPP_ALLOWANCE_INVALID")
      allowances[deviceId] = allowance.toString()
    }

    const subscription = await this.prisma.serviceSubscription.findUnique({
      where: { id: input.subscriptionId },
      select: { organizationId: true, metadata: true },
    })
    if (!subscription || subscription.organizationId !== input.organizationId) {
      throw new Error("SUBSCRIPTION_NOT_FOUND")
    }
    const metadata = {
      ...metadataObject(subscription.metadata),
      subscriptionId: input.subscriptionId,
      deviceIds: input.deviceIds,
      allowanceByDevice: allowances,
      pricingId: input.pricingId,
      unitPrice: input.unitPrice.toString(),
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
    }
    await this.prisma.serviceSubscription.update({
      where: { id: input.subscriptionId },
      data: { quantity: input.quantity, metadata: jsonObject(metadata) },
    })

    const idempotencyKey = `service-subscription:${input.subscriptionId}:${input.period}`
    const existing = await this.prisma.billingOrder.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true },
    })
    if (!this.orders) throw new Error("ORDER_SERVICE_REQUIRED")
    const orders = this.orders
    const result = existing
      ? await orders.fulfillOrder(
          existing.status === "PENDING"
            ? (await orders.chargeOrder(existing.id)).orderId
            : existing.id
        )
      : await orders.renewServiceSubscription(
          input.subscriptionId,
          input.periodStart
        )

    if (!existing) {
      await this.prisma.billingOrder.update({
        where: { id: result.orderId },
        data: { idempotencyKey },
      })
    }
    await this.resetAllowances(input.deviceIds, allowances)
    return result
  }

  private async resetAllowances(
    deviceIds: string[],
    allowanceByDevice: Record<string, string>
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const deviceId of deviceIds) {
        const allowance = new Prisma.Decimal(allowanceByDevice[deviceId])
        await tx.whatsappDevice.update({
          where: { id: deviceId },
          data: { quotaBaseOut: allowance, quotaBase: allowance },
        })
      }
    })
  }

  async consumeAllowanceOrChargeOverage(
    input: OverageInput
  ): Promise<WhatsappBillingDecision> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the device row to prevent concurrent consumption races
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "WhatsappDevice" WHERE id = ${input.deviceId} FOR UPDATE`
      )

      const device = await tx.whatsappDevice.findUnique({
        where: { id: input.deviceId },
        select: { quotaBaseOut: true, addonQuota: true },
      })
      if (!device) throw new Error("WHATSAPP_DEVICE_NOT_FOUND")

      const defaultRemaining =
        device.quotaBaseOut instanceof Prisma.Decimal
          ? device.quotaBaseOut
          : new Prisma.Decimal(Number(device.quotaBaseOut ?? 0))
      const addonRemaining =
        device.addonQuota instanceof Prisma.Decimal
          ? device.addonQuota
          : new Prisma.Decimal(Number(device.addonQuota ?? 0))
      const credit = input.quotaCredit

      // Case 1: Default allowance covers the full credit
      if (defaultRemaining.gte(credit)) {
        await tx.whatsappDevice.update({
          where: { id: input.deviceId },
          data: { quotaBaseOut: { decrement: credit } },
        })
        return {
          kind: "ALLOWANCE",
          remainingDefaultAllowance: defaultRemaining.minus(credit),
          remainingAddonAllowance: addonRemaining,
          defaultConsumed: credit,
          addonConsumed: new Prisma.Decimal(0),
        }
      }

      // Case 2: Default + addon cover the full credit
      const combined = defaultRemaining.plus(addonRemaining)
      if (combined.gte(credit)) {
        const addonNeed = credit.minus(defaultRemaining)
        await tx.whatsappDevice.update({
          where: { id: input.deviceId },
          data: {
            quotaBaseOut: new Prisma.Decimal(0),
            addonQuota: { decrement: addonNeed },
          },
        })
        return {
          kind: "ALLOWANCE",
          remainingDefaultAllowance: new Prisma.Decimal(0),
          remainingAddonAllowance: addonRemaining.minus(addonNeed),
          defaultConsumed: defaultRemaining,
          addonConsumed: addonNeed,
        }
      }

      // Overage uses the commercial subscription snapshot; account currency is legacy fallback.
      const account = await tx.billingAccount.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
      const subscription =
        typeof tx.serviceSubscription?.findFirst === "function"
          ? await tx.serviceSubscription.findFirst({
              where: {
                organizationId: input.organizationId,
                package: { code: "WHATSAPP" },
                status: "ACTIVE",
              },
              select: { currency: true },
            })
          : null
      const currency = subscription?.currency ?? account.currency
      const overageCredit = credit.minus(combined)
      const amount = input.unitPrice.times(overageCredit)

      // Charge BEFORE mutating allowance — if charge fails, allowance is untouched
      const result = await this.transactions.debitServiceBalance(
        {
          organizationId: input.organizationId,
          amount,
          currency,
          source: "WHATSAPP",
          reason: "WhatsApp overage charge",
          idempotencyKey: input.idempotencyKey,
          metadata: {
            deviceId: input.deviceId,
            quotaCredit: input.quotaCredit.toString(),
            overageCredit: overageCredit.toString(),
          },
          line: {
            description: "WhatsApp overage quota credit",
            quantity: overageCredit,
            unitPrice: input.unitPrice,
            lineType: "USAGE",
          },
        },
        tx
      )

      // Zero both allowances (charge succeeded)
      await tx.whatsappDevice.update({
        where: { id: input.deviceId },
        data: {
          quotaBaseOut: new Prisma.Decimal(0),
          addonQuota: new Prisma.Decimal(0),
        },
      })

      return {
        kind: "OVERAGE_CHARGED",
        remainingDefaultAllowance: new Prisma.Decimal(0),
        remainingAddonAllowance: new Prisma.Decimal(0),
        defaultConsumed: defaultRemaining,
        addonConsumed: addonRemaining,
        charged: amount,
        adjustmentId: result.adjustmentId,
      }
    })
  }
  /**
   * Restore consumed allowance (e.g., after Meta API failure).
   * Best-effort: if another message consumed allowance concurrently,
   * the restore may overshoot. Acceptable because:
   * 1. Worst case is a slightly higher allowance this period
   * 2. The monthly reset caps it anyway
   * 3. The alternative (lost allowance + failed message) is worse
   *
   * Only allowance (default/addon) can be restored; balance overages
   * are not auto-refunded (preserve existing behavior).
   */
  async restoreAllowance(
    deviceId: string,
    amounts: {
      default?: Prisma.Decimal | number
      addon?: Prisma.Decimal | number
    }
  ): Promise<void> {
    const data: Record<string, unknown> = {}
    if (amounts.default !== undefined) {
      const credit =
        typeof amounts.default === "number"
          ? new Prisma.Decimal(amounts.default)
          : amounts.default
      data.quotaBaseOut = { increment: credit }
    }
    if (amounts.addon !== undefined) {
      const credit =
        typeof amounts.addon === "number"
          ? new Prisma.Decimal(amounts.addon)
          : amounts.addon
      data.addonQuota = { increment: credit }
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.whatsappDevice.update({
        where: { id: deviceId },
        data,
      })
    }
  }
}

export async function runWhatsappBillingCycle(
  prisma: PrismaClient,
  orders: BillingOrders,
  now = new Date()
): Promise<{ charged: number; skipped: number; errors: number }> {
  const billing = new WhatsappBillingService(
    prisma,
    new BillingTransactionService(prisma),
    orders
  )
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  const subscriptions = await prisma.serviceSubscription.findMany({
    where: { package: { code: "WHATSAPP" }, status: "ACTIVE" },
    include: { plan: true },
  })
  let charged = 0
  let skipped = 0
  let errors = 0
  for (const subscription of subscriptions) {
    const devices = await prisma.whatsappDevice.findMany({
      where: { organizationId: subscription.organizationId, status: "ACTIVE" },
      select: { id: true },
    })
    if (devices.length === 0) {
      skipped++
      continue
    }
    const allowance =
      (subscription.plan.resources as WhatsAppPlanResources | null)
        ?.quotaOutMonthly ??
      (subscription.plan.resources as WhatsAppPlanResources | null)?.quotaOut ??
      0
    const periodMonths =
      subscription.billingPeriod === "QUARTERLY"
        ? 3
        : subscription.billingPeriod === "SEMI_ANNUAL"
          ? 6
          : subscription.billingPeriod === "ANNUAL"
            ? 12
            : 1
    const periodEnd = new Date(subscription.currentPeriodEnd)
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + periodMonths)
    try {
      await billing.chargeSubscriptionBase({
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        pricingId: subscription.pricingId,
        unitPrice: new Prisma.Decimal(subscription.priceLocked),
        quantity: new Prisma.Decimal(devices.length),
        periodStart: subscription.currentPeriodEnd,
        periodEnd,
        deviceIds: devices.map((device) => device.id),
        period,
        allowanceByDevice: Object.fromEntries(
          devices.map((device) => [device.id, allowance])
        ),
      })
      charged++
    } catch (error) {
      errors++
      console.error(
        `[whatsapp-billing] subscription=${subscription.id} error:`,
        error
      )
    }
  }
  return { charged, skipped, errors }
}
