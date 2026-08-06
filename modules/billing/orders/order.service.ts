import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import {
  BillingTransactionService,
  type BillingChargeSource,
} from "../billing-transaction.service"
import { resolveRecurringPrice } from "../pricing/pricing.service"
import type {
  RecurringBillingPeriod,
  ResolvedRecurringPrice,
} from "../pricing/pricing.types"
import {
  createBillingFulfillmentRegistry,
  type BillingFulfillmentInput,
  type BillingFulfillmentRegistry,
} from "./fulfillment-adapters"
export type BillingOrderResult = {
  orderId: string
  status: "PENDING" | "CHARGED" | "FULFILLED" | "FAILED" | "CANCELLED"
  subscriptionId: string | null
  invoiceId: string | null
  invoiceLineId: string | null
  amount: string
  currency: string
  billingPeriod: RecurringBillingPeriod
  periodStart: string
  periodEnd: string
}

type OrderWithLines = Prisma.BillingOrderGetPayload<{
  include: { lines: true }
}>
type BillingDbClient = PrismaClient | Prisma.TransactionClient

type ResolvePrice = typeof resolveRecurringPrice

type BillingOrderServiceDependencies = {
  transactions?: BillingTransactionService
  resolvePrice?: ResolvePrice
  registry?: BillingFulfillmentRegistry
}

const PERIOD_MONTHS: Record<RecurringBillingPeriod, 1 | 3 | 6 | 12> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

function isRecurringBillingPeriod(
  value: string
): value is RecurringBillingPeriod {
  return value in PERIOD_MONTHS
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

function jsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}

function metadataObject(
  value: Prisma.JsonValue | null
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
function isIdempotencyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as {
    code?: unknown
    meta?: { target?: unknown }
  }
  return (
    candidate.code === "P2002" &&
    Array.isArray(candidate.meta?.target) &&
    candidate.meta.target.includes("idempotencyKey")
  )
}

function toResult(order: OrderWithLines): BillingOrderResult {
  const line = order.lines[0]
  if (!line || !isRecurringBillingPeriod(line.billingPeriod)) {
    throw new Error("ORDER_LINE_INVALID")
  }
  const lineInvoiceLineId = metadataObject(line.metadataJson).invoiceLineId
  const orderInvoiceLineId = metadataObject(order.metadataJson).invoiceLineId
  const invoiceLineId = lineInvoiceLineId ?? orderInvoiceLineId
  return {
    orderId: order.id,
    status: order.status,
    subscriptionId: order.serviceSubscriptionId,
    invoiceId: order.billingInvoiceId,
    invoiceLineId: typeof invoiceLineId === "string" ? invoiceLineId : null,
    amount: order.totalAmount.toString(),
    currency: order.currency,
    billingPeriod: line.billingPeriod,
    periodStart: line.periodStart.toISOString(),
    periodEnd: line.periodEnd.toISOString(),
  }
}

export class BillingOrderService {
  private readonly transactions: BillingTransactionService
  private readonly resolvePrice: ResolvePrice
  private readonly registry: BillingFulfillmentRegistry

  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    dependencies: BillingOrderServiceDependencies = {},
    registry?: BillingFulfillmentRegistry
  ) {
    this.transactions =
      dependencies.transactions ?? new BillingTransactionService(prisma)
    this.resolvePrice = dependencies.resolvePrice ?? resolveRecurringPrice
    this.registry =
      registry ??
      dependencies.registry ??
      createBillingFulfillmentRegistry(undefined, prisma)
  }

  async createOrder(input: {
    organizationId: string
    pricingId: string
    quantity?: Prisma.Decimal
    amount?: Prisma.Decimal
    discountAmount?: Prisma.Decimal
    periodStart?: Date
    periodEnd?: Date
    prorateMonthly?: boolean
    metadata?: Record<string, unknown>
    voucherId?: string
    voucherCode?: string
    voucherCurrency?: string
    voucherExchangeRate?: Prisma.Decimal
    idempotencyKey: string
    now?: Date
  }): Promise<BillingOrderResult> {
    const existing = await this.findByIdempotencyKey(input.idempotencyKey)
    if (existing) return toResult(existing)

    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
      select: { id: true, currency: true },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
    const now = input.now ?? new Date()
    const price = await this.resolvePrice({
      pricingId: input.pricingId,
      currency: account.currency,
      at: now,
    })
    this.registry.get(price.packageCode)
    const quantity = input.quantity ?? new Prisma.Decimal(1)
    await this.validateQuantity(input.organizationId, price, quantity)

    const periodStart = input.periodStart ?? now
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    )
    const periodEnd =
      input.periodEnd ??
      (input.prorateMonthly && price.billingPeriod === "MONTHLY"
        ? monthEnd
        : addMonths(periodStart, price.periodMonths))
    const amount =
      input.amount ??
      (input.prorateMonthly && price.billingPeriod === "MONTHLY"
        ? price.periodPrice
            .mul(monthEnd.getUTCDate() - now.getUTCDate() + 1)
            .div(monthEnd.getUTCDate())
            .mul(quantity)
        : price.periodPrice.mul(quantity))
    const discountAmount = input.discountAmount ?? new Prisma.Decimal(0)
    if (discountAmount.isNegative() || discountAmount.gt(amount)) {
      throw new Error("ORDER_DISCOUNT_INVALID")
    }
    const totalAmount = amount.sub(discountAmount)
    const metadata = input.metadata ?? {}
    const lineMetadata = { ...metadata, planId: price.planId }
    let order: OrderWithLines
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const raced = await tx.billingOrder.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { lines: true },
        })
        if (raced) return raced
        return tx.billingOrder.create({
          data: {
            organizationId: input.organizationId,
            billingAccountId: account.id,
            status: "PENDING",
            currency: price.currency,
            subtotalAmount: amount,
            discountAmount,
            totalAmount,
            idempotencyKey: input.idempotencyKey,
            voucherId: input.voucherId,
            voucherCode: input.voucherCode,
            voucherCurrency: input.voucherCurrency,
            voucherExchangeRate: input.voucherExchangeRate,
            metadataJson: jsonObject(metadata),
            lines: {
              create: {
                pricingId: price.pricingId,
                packageCode: price.packageCode,
                planCode: price.planCode,
                regionCode: price.regionCode,
                billingPeriod: price.billingPeriod,
                chargeUnit: price.chargeUnit,
                quantity,
                unitPrice: price.periodPrice,
                amount,
                currency: price.currency,
                periodStart,
                periodEnd,
                metadataJson: jsonObject(lineMetadata),
              },
            },
          },
          include: { lines: true },
        })
      })
    } catch (error) {
      if (!isIdempotencyConflict(error)) throw error
      const raced = await this.findByIdempotencyKey(input.idempotencyKey)
      if (!raced) throw error
      order = raced
    }
    return toResult(order)
  }

  async chargeOrder(
    orderId: string,
    transactionClient?: Prisma.TransactionClient
  ): Promise<BillingOrderResult> {
    const client = transactionClient ?? this.prisma
    const order = await this.loadOrder(orderId, client)
    if (order.status === "CHARGED" || order.status === "FULFILLED") {
      return toResult(order)
    }
    if (order.status !== "PENDING") throw new Error("ORDER_NOT_CHARGEABLE")
    const line = order.lines[0]
    if (!line || !isRecurringBillingPeriod(line.billingPeriod)) {
      throw new Error("ORDER_LINE_INVALID")
    }

    const chargeInput = {
      organizationId: order.organizationId,
      amount: order.totalAmount,
      currency: order.currency,
      source: line.packageCode as BillingChargeSource,
      reason: `Subscription order ${order.id}`,
      idempotencyKey: order.idempotencyKey,
      metadata: {
        ...metadataObject(order.metadataJson),
        orderId: order.id,
      },
      line: {
        description: `${line.packageCode} ${line.planCode} subscription`,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineType: "SUBSCRIPTION" as const,
        category: line.packageCode.toLowerCase(),
      },
    }
    const charge = transactionClient
      ? await this.transactions.debitServiceBalance(
          chargeInput,
          transactionClient
        )
      : await this.transactions.debitServiceBalance(chargeInput)

    await client.billingOrder.update({
      where: { id: order.id },
      data: {
        billingInvoiceId: charge.invoiceId,
        chargedAt: new Date(),
        status: "CHARGED",
        metadataJson: jsonObject({
          ...metadataObject(order.metadataJson),
          invoiceLineId: charge.invoiceLineId,
        }),
      },
    })
    return toResult({
      ...order,
      status: "CHARGED",
      billingInvoiceId: charge.invoiceId,
      metadataJson: {
        ...metadataObject(order.metadataJson),
        invoiceLineId: charge.invoiceLineId,
      },
    })
  }

  async checkoutOrder(
    orderId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<BillingOrderResult> {
    return this.prisma.$transaction(async (tx) => {
      const charged = await this.chargeOrder(orderId, tx)
      return this.fulfillOrder(charged.orderId, metadata, tx)
    })
  }

  async fulfillOrder(
    orderId: string,
    metadata: Record<string, unknown> = {},
    transactionClient?: Prisma.TransactionClient
  ): Promise<BillingOrderResult> {
    let adapterAttempted = false
    const run = async (tx: Prisma.TransactionClient) => {
      const txClient = tx as Prisma.TransactionClient & {
        $executeRaw?: (query: unknown) => Promise<number>
      }
      if (typeof txClient.$executeRaw !== "function") {
        throw new Error("ADVISORY_LOCK_UNAVAILABLE")
      }
      await txClient.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`
      )
      const order = await this.loadOrder(orderId, txClient)
      if (order.status === "FULFILLED") return toResult(order)
      if (
        order.status !== "CHARGED" &&
        !(order.status === "FAILED" && order.billingInvoiceId)
      ) {
        throw new Error("ORDER_NOT_CHARGED")
      }
      const line = order.lines[0]
      if (!line || !isRecurringBillingPeriod(line.billingPeriod)) {
        throw new Error("ORDER_LINE_INVALID")
      }

      const adapter = this.registry.get(line.packageCode)
      const lineMetadata = metadataObject(line.metadataJson)
      const input: BillingFulfillmentInput = {
        orderId: order.id,
        organizationId: order.organizationId,
        pricingId: line.pricingId ?? "",
        packageCode: line.packageCode,
        planId:
          typeof lineMetadata.planId === "string"
            ? lineMetadata.planId
            : line.planCode,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        currency: line.currency,
        periodStart: line.periodStart,
        periodEnd: line.periodEnd,
        metadata: {
          ...metadataObject(order.metadataJson),
          ...lineMetadata,
          ...metadata,
        },
      }
      adapterAttempted = true
      let subscriptionId = order.serviceSubscriptionId
      if (subscriptionId) {
        await adapter.renew(input, tx)
      } else {
        subscriptionId = (await adapter.create(input, tx)).subscriptionId
      }
      await txClient.billingOrder.update({
        where: { id: order.id },
        data: {
          status: "FULFILLED",
          fulfilledAt: new Date(),
          serviceSubscriptionId: subscriptionId,
        },
      })
      return toResult({
        ...order,
        status: "FULFILLED",
        serviceSubscriptionId: subscriptionId,
      })
    }

    try {
      return transactionClient
        ? await run(transactionClient)
        : await this.prisma.$transaction(run)
    } catch (error) {
      if (adapterAttempted && !transactionClient) {
        await this.prisma.billingOrder.update({
          where: { id: orderId },
          data: { status: "FAILED" },
        })
      }
      throw error
    }
  }

  async renewServiceSubscription(
    subscriptionId: string,
    now = new Date()
  ): Promise<BillingOrderResult> {
    const subscription = await this.prisma.serviceSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        package: true,
        plan: true,
        pricing: { include: { region: true } },
      },
    })
    if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND")
    if (!isRecurringBillingPeriod(subscription.billingPeriod)) {
      throw new Error("SUBSCRIPTION_PERIOD_INVALID")
    }
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: subscription.organizationId },
      select: { id: true, currency: true },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
    if (account.currency !== subscription.currency) {
      throw new Error("CURRENCY_MISMATCH")
    }

    const periodStart = subscription.currentPeriodEnd
    const periodEnd = addMonths(
      periodStart,
      PERIOD_MONTHS[subscription.billingPeriod]
    )
    const amount = subscription.priceLocked.mul(subscription.quantity)
    const idempotencyKey = `service-subscription:${subscription.id}:${periodStart.toISOString()}`
    const existing = await this.findByIdempotencyKey(idempotencyKey)
    if (existing) {
      const existingLine = existing.lines[0]
      const existingPeriodStart = existingLine?.periodStart ?? periodStart
      const existingPeriodEnd = existingLine?.periodEnd ?? periodEnd
      if (existing.status === "FULFILLED") {
        await this.advanceSubscriptionPeriod(
          subscription,
          existingPeriodStart,
          existingPeriodEnd
        )
        return toResult(existing)
      }
      if (existing.status === "PENDING") {
        const charged = await this.chargeOrder(existing.id)
        const fulfilled = await this.fulfillOrder(charged.orderId)
        await this.advanceSubscriptionPeriod(
          subscription,
          existingPeriodStart,
          existingPeriodEnd
        )
        return fulfilled
      }
      if (existing.status === "CHARGED" || existing.status === "FAILED") {
        const fulfilled = await this.fulfillOrder(existing.id)
        await this.advanceSubscriptionPeriod(
          subscription,
          existingPeriodStart,
          existingPeriodEnd
        )
        return fulfilled
      }
      return toResult(existing)
    }

    const order = await this.prisma.billingOrder.create({
      data: {
        organizationId: subscription.organizationId,
        billingAccountId: account.id,
        serviceSubscriptionId: subscription.id,
        status: "PENDING",
        currency: subscription.currency,
        subtotalAmount: amount,
        totalAmount: amount,
        idempotencyKey,
        metadataJson: jsonObject({
          renewal: true,
          subscriptionId,
          renewedAt: now.toISOString(),
        }),
        lines: {
          create: {
            pricingId: subscription.pricingId,
            packageCode: subscription.package.code,
            planCode: subscription.plan.code,
            regionCode: subscription.pricing.region.code,
            billingPeriod: subscription.billingPeriod,
            chargeUnit: subscription.pricing.chargeUnit,
            quantity: subscription.quantity,
            unitPrice: subscription.priceLocked,
            amount,
            currency: subscription.currency,
            periodStart,
            periodEnd,
            metadataJson: jsonObject({
              renewal: true,
              subscriptionId,
              planId: subscription.planId,
              renewedAt: now.toISOString(),
            }),
          },
        },
      },
      include: { lines: true },
    })
    const charged = await this.chargeOrder(order.id)
    const fulfilled = await this.fulfillOrder(charged.orderId)
    await this.advanceSubscriptionPeriod(subscription, periodStart, periodEnd)
    return fulfilled
  }
  private async advanceSubscriptionPeriod(
    subscription: {
      id: string
      currentPeriodStart: Date
      currentPeriodEnd: Date
    },
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    const currentStart = subscription.currentPeriodStart.getTime()
    const currentEnd = subscription.currentPeriodEnd.getTime()
    const requestedStart = periodStart.getTime()
    const requestedEnd = periodEnd.getTime()
    if (currentStart === requestedStart && currentEnd === requestedEnd) {
      return
    }
    if (currentEnd > requestedEnd || currentEnd !== requestedStart) {
      return
    }
    await this.prisma.serviceSubscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    })
  }

  private async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<OrderWithLines | null> {
    return this.prisma.billingOrder.findUnique({
      where: { idempotencyKey },
      include: { lines: true },
    })
  }

  private async loadOrder(
    orderId: string,
    client: BillingDbClient = this.prisma
  ): Promise<OrderWithLines> {
    const order = await client.billingOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    })
    if (!order) throw new Error("ORDER_NOT_FOUND")
    return order
  }

  private async validateQuantity(
    organizationId: string,
    price: ResolvedRecurringPrice,
    quantity: Prisma.Decimal
  ): Promise<void> {
    if (quantity.lt(1)) throw new Error("INVALID_QUANTITY")
    if (price.chargeUnit !== "DEVICE") return
    const activeDevices = await this.prisma.whatsappDevice.count({
      where: { organizationId, status: "ACTIVE" },
    })
    if (!quantity.eq(activeDevices)) throw new Error("INVALID_QUANTITY")
  }
}
