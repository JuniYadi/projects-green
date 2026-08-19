import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { CurrencyService } from "../currency.service"
import { resolveRecurringPrice } from "../pricing/pricing.service"
import type {
  RecurringBillingPeriod,
  ResolvedRecurringPrice,
} from "../pricing/pricing.types"

export type CheckoutQuoteInput = {
  organizationId: string
  pricingId: string
  quantity?: Prisma.Decimal
  addonIds?: string[]
  voucherCode?: string
  userId?: string
  idempotencyKey: string
  mode?: "PURCHASE" | "UPGRADE" | "CHANGE_TERM"
  subscriptionId?: string
  now?: Date
}

export type CheckoutQuoteAddon = {
  id: string
  code: string
  name: string
  description: string | null
  price: string
  currency: string
  billingPeriod: RecurringBillingPeriod
  quantity: "1"
  required?: boolean
  selected?: boolean
}

export type CheckoutQuoteVoucher = {
  id: string
  code: string
  kind: "PRODUCT_PROMOTION"
  discountType: "PERCENTAGE" | "FIXED"
  sourceAmount: string
  sourceCurrency: string
  discountAmount: string
  discountCurrency: string
  currencyPolicy:
    | "MATCH_CURRENCY_ONLY"
    | "CONVERT_AT_CHECKOUT"
    | "CONVERT_AT_REDEMPTION"
  exchangeRate: string | null
  rateAt: string | null
  quoteExpiresAt: string
}

export type CheckoutQuote = {
  quoteId: string
  quoteToken: string
  pricingId: string
  packageCode: string
  packageName?: string
  packageDescription?: string
  planCode: string
  planName?: string
  billingStrategy?: "PRO_RATA" | "FIXED_CYCLE"
  resources?: Record<string, unknown>
  billingPeriod: RecurringBillingPeriod
  quantity: string
  periodStart: string
  periodEnd: string
  isProrated?: boolean
  proratedDays?: number
  totalDaysInPeriod?: number
  subtotal: string
  discount: string
  firstPayment: string
  nextRenewal: string
  addons: CheckoutQuoteAddon[]
  availableAddons?: CheckoutQuoteAddon[]
  availableTerms?: Array<{
    pricingId: string
    billingPeriod: RecurringBillingPeriod
    periodPrice: string
    currency: string
  }>
  voucher: CheckoutQuoteVoucher | null
  expiresAt: string
}

type QuoteDependencies = {
  resolvePrice?: (input: {
    pricingId: string
    currency: string
    at?: Date
  }) => Promise<ResolvedRecurringPrice>
  convertCurrency?: (
    amount: Prisma.Decimal,
    from: string,
    to: string
  ) => Promise<Prisma.Decimal>
  now?: () => Date
  quoteTtlMinutes?: number
}

type QuoteDb = Pick<
  PrismaClient,
  | "servicePlanAddon"
  | "servicePlan"
  | "servicePricing"
  | "voucher"
  | "billingOrder"
  | "billingAccount"
>

export class CheckoutQuoteError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "CheckoutQuoteError"
  }
}

const PERIOD_MONTHS: Record<RecurringBillingPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  const day = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate()
  next.setUTCDate(Math.min(day, lastDay))
  return next
}

function decimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
}

function jsonStrings(value: Prisma.JsonValue | null): string[] | null {
  if (!Array.isArray(value)) return null
  return value.filter((item): item is string => typeof item === "string")
}

function assertAllowed(
  value: string,
  allowed: Prisma.JsonValue | null,
  label: string
): void {
  const values = jsonStrings(allowed)
  if (values && values.length > 0 && !values.includes(value)) {
    throw new CheckoutQuoteError(
      "VOUCHER_NOT_ELIGIBLE",
      `This voucher is not eligible for the selected ${label}.`
    )
  }
}

export class CheckoutQuoteService {
  private readonly resolvePrice: NonNullable<QuoteDependencies["resolvePrice"]>
  private readonly convertCurrency: NonNullable<
    QuoteDependencies["convertCurrency"]
  >
  private readonly now: () => Date
  private readonly quoteTtlMinutes: number

  constructor(
    private readonly db: QuoteDb = defaultPrisma,
    dependencies: QuoteDependencies = {}
  ) {
    this.resolvePrice = dependencies.resolvePrice ?? resolveRecurringPrice
    this.convertCurrency =
      dependencies.convertCurrency ??
      ((amount, from, to) => {
        const dbClient = this.db as PrismaClient
        return new CurrencyService(dbClient).convert(amount, from, to)
      })
    this.now = dependencies.now ?? (() => new Date())
    this.quoteTtlMinutes = dependencies.quoteTtlMinutes ?? 15
  }

  async createQuote(input: CheckoutQuoteInput): Promise<CheckoutQuote> {
    const now = input.now ?? this.now()
    const price = await this.resolvePrice({
      pricingId: input.pricingId,
      currency: await this.resolveCurrency(input.organizationId),
      at: now,
    })
    const quantity = decimal(input.quantity ?? 1)
    if (quantity.lt(1)) {
      throw new CheckoutQuoteError(
        "INVALID_QUANTITY",
        "Quantity must be at least one."
      )
    }

    // Check product stock and strategy
    const plan = await this.db.servicePlan.findUnique({
      where: { id: price.planId },
      select: {
        name: true,
        stockControl: true,
        stockCount: true,
        allowBackorder: true,
        billingStrategy: true,
        resources: true,
        package: {
          select: {
            name: true,
            description: true,
          },
        },
      },
    })
    if (
      plan?.stockControl === "TRACKED" &&
      !plan.allowBackorder &&
      (plan.stockCount ?? 0) < Number(quantity)
    ) {
      throw new CheckoutQuoteError(
        "OUT_OF_STOCK",
        "The selected product is currently out of stock."
      )
    }

    const isProRata =
      plan?.billingStrategy === "PRO_RATA" && price.billingPeriod === "MONTHLY"
    const attachments = await this.db.servicePlanAddon.findMany({
      where: { planId: price.planId, isActive: true },
      include: {
        addon: {
          include: {
            prices: {
              where: {
                currency: price.currency,
                billingPeriod: price.billingPeriod,
                isActive: true,
                effectiveFrom: { lte: now },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
              },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    })

    const requestedAddonIds = new Set(input.addonIds ?? [])
    const selectedIds = new Set(requestedAddonIds)
    const addons: CheckoutQuoteAddon[] = []
    for (const attachment of attachments) {
      if (attachment.isRequired || selectedIds.has(attachment.addonId)) {
        const addonPrice = attachment.addon.prices[0]
        if (!addonPrice) {
          throw new CheckoutQuoteError(
            "ADDON_PRICE_UNAVAILABLE",
            `${attachment.addon.name} is unavailable in ${price.currency}.`
          )
        }
        addons.push({
          id: attachment.addon.id,
          code: attachment.addon.code,
          name: attachment.label ?? attachment.addon.name,
          description: attachment.description ?? attachment.addon.description,
          price: decimal(addonPrice.amount).toString(),
          currency: price.currency,
          billingPeriod: price.billingPeriod,
          quantity: "1",
          required: attachment.isRequired,
          selected: true,
        })
        selectedIds.delete(attachment.addonId)
      }
    }
    if (selectedIds.size > 0) {
      throw new CheckoutQuoteError(
        "ADDON_NOT_ELIGIBLE",
        "One or more selected add-ons are not available for this plan."
      )
    }
    const availableAddons = attachments.flatMap((attachment) => {
      const addonPrice = attachment.addon.prices[0]
      if (!addonPrice) return []
      return [
        {
          id: attachment.addon.id,
          code: attachment.addon.code,
          name: attachment.label ?? attachment.addon.name,
          description: attachment.description ?? attachment.addon.description,
          price: decimal(addonPrice.amount).toString(),
          currency: price.currency,
          billingPeriod: price.billingPeriod,
          quantity: "1" as const,
          required: attachment.isRequired,
          selected:
            attachment.isRequired || requestedAddonIds.has(attachment.addonId),
        },
      ]
    })
    const utcYear = now.getUTCFullYear()
    const utcMonth = now.getUTCMonth()
    const monthEnd = new Date(
      Date.UTC(utcYear, utcMonth + 1, 0, 23, 59, 59, 999)
    )
    const totalDaysInMonth = monthEnd.getUTCDate()
    const remainingDays = totalDaysInMonth - now.getUTCDate() + 1

    let basePriceCalculated = price.periodPrice.mul(quantity)
    let isProrated = false

    if (isProRata && remainingDays < totalDaysInMonth) {
      basePriceCalculated = price.periodPrice
        .mul(remainingDays)
        .div(totalDaysInMonth)
        .mul(quantity)
      isProrated = true
    }

    const subtotal = basePriceCalculated.add(
      addons.reduce((sum, addon) => sum.add(decimal(addon.price)), decimal(0))
    )
    const expiresAt = new Date(now.getTime() + this.quoteTtlMinutes * 60_000)
    const quoteId = `${input.idempotencyKey}:${now.getTime()}:${randomUUID()}`
    const voucher = input.voucherCode
      ? await this.resolveVoucher(
          input.voucherCode,
          input.organizationId,
          input.userId,
          price,
          subtotal,
          input.mode ?? "PURCHASE",
          expiresAt,
          now
        )
      : null
    const discount = voucher ? decimal(voucher.discountAmount) : decimal(0)
    const firstPayment = subtotal.sub(discount)
    const periodEnd = isProRata
      ? monthEnd
      : addMonths(now, PERIOD_MONTHS[price.billingPeriod])

    // Find all active pricing terms for this plan in the same currency
    const siblingPricings = await this.db.servicePricing.findMany({
      where: {
        planId: price.planId,
        currency: price.currency,
        isActive: true,
        periodPrice: { gt: 0 },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { billingPeriod: "asc" },
    })

    const availableTerms = siblingPricings.map((p) => ({
      pricingId: p.id,
      billingPeriod: p.billingPeriod as RecurringBillingPeriod,
      periodPrice: p.periodPrice ? p.periodPrice.toString() : "0",
      currency: p.currency,
    }))

    return {
      quoteId,
      quoteToken: quoteId,
      pricingId: price.pricingId,
      packageCode: price.packageCode,
      packageName: plan?.package?.name,
      packageDescription: plan?.package?.description ?? undefined,
      planCode: price.planCode,
      planName: plan?.name,
      billingStrategy: plan?.billingStrategy ?? "FIXED_CYCLE",
      resources: (plan?.resources ?? {}) as Record<string, unknown>,
      billingPeriod: price.billingPeriod,
      quantity: quantity.toString(),
      periodStart: now.toISOString(),
      isProrated,
      proratedDays: isProrated ? remainingDays : undefined,
      totalDaysInPeriod: isProrated ? totalDaysInMonth : undefined,
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      firstPayment: firstPayment.toString(),
      nextRenewal: periodEnd.toISOString(),
      addons,
      availableAddons,
      availableTerms,
      voucher,
      expiresAt: expiresAt.toISOString(),
    }
  }

  private async resolveCurrency(organizationId: string): Promise<string> {
    const account = await this.db.billingAccount.findUnique({
      where: { organizationId },
      select: { currency: true },
    })
    return account?.currency ?? "IDR"
  }

  private async resolveVoucher(
    code: string,
    organizationId: string,
    userId: string | undefined,
    price: ResolvedRecurringPrice,
    subtotal: Prisma.Decimal,
    mode: "PURCHASE" | "UPGRADE" | "CHANGE_TERM",
    expiresAt: Date,
    now: Date
  ): Promise<CheckoutQuoteVoucher> {
    const voucher = await this.db.voucher.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: {
        id: true,
        code: true,
        status: true,
        kind: true,
        discountType: true,
        discountValue: true,
        discountCurrency: true,
        currency: true,
        currencyPolicy: true,
        firstCheckoutOnly: true,
        allowUpgrade: true,
        minimumOrderAmount: true,
        maximumDiscountAmount: true,
        expiresAt: true,
        targetWorkosUserId: true,
        targetOrganizationId: true,
        allowedPackageCodes: true,
        allowedPlanCodes: true,
        allowedBillingPeriods: true,
      },
    })
    if (!voucher || voucher.kind !== "PRODUCT_PROMOTION") {
      throw new CheckoutQuoteError("VOUCHER_NOT_FOUND", "Voucher not found.")
    }
    if (voucher.status !== "ACTIVE" || voucher.expiresAt <= now) {
      throw new CheckoutQuoteError(
        "VOUCHER_EXPIRED",
        "This voucher is no longer active."
      )
    }
    if (
      voucher.targetOrganizationId &&
      voucher.targetOrganizationId !== organizationId
    ) {
      throw new CheckoutQuoteError(
        "VOUCHER_TARGET_MISMATCH",
        "This voucher is not available for your organization."
      )
    }
    if (voucher.targetWorkosUserId && voucher.targetWorkosUserId !== userId) {
      throw new CheckoutQuoteError(
        "VOUCHER_TARGET_MISMATCH",
        "This voucher is not available for your account."
      )
    }
    assertAllowed(price.packageCode, voucher.allowedPackageCodes, "product")
    assertAllowed(price.planCode, voucher.allowedPlanCodes, "plan")
    assertAllowed(
      price.billingPeriod,
      voucher.allowedBillingPeriods,
      "billing term"
    )
    if (mode !== "PURCHASE" && !voucher.allowUpgrade) {
      throw new CheckoutQuoteError(
        "VOUCHER_NOT_ELIGIBLE",
        "This voucher is valid only on the first checkout."
      )
    }
    if (voucher.firstCheckoutOnly) {
      const existing = await this.db.billingOrder.count({
        where: {
          organizationId,
          voucherId: voucher.id,
          status: { in: ["CHARGED", "FULFILLED"] },
        },
      })
      if (existing > 0) {
        throw new CheckoutQuoteError(
          "VOUCHER_ALREADY_USED",
          "This voucher has already been used on an eligible checkout."
        )
      }
    }
    if (voucher.minimumOrderAmount && subtotal.lt(voucher.minimumOrderAmount)) {
      throw new CheckoutQuoteError(
        "VOUCHER_MINIMUM_NOT_MET",
        `This voucher requires a minimum order of ${voucher.minimumOrderAmount.toString()}.`
      )
    }
    if (!voucher.discountType || !voucher.discountValue) {
      throw new CheckoutQuoteError(
        "VOUCHER_RULES_INVALID",
        "This voucher has no valid promotion rule."
      )
    }

    const sourceCurrency =
      voucher.discountType === "FIXED"
        ? (voucher.discountCurrency ?? voucher.currency)
        : price.currency
    let discount =
      voucher.discountType === "PERCENTAGE"
        ? subtotal.mul(voucher.discountValue).div(100)
        : voucher.discountValue
    let exchangeRate: Prisma.Decimal | null = null
    if (voucher.discountType === "FIXED" && sourceCurrency !== price.currency) {
      if (voucher.currencyPolicy === "MATCH_CURRENCY_ONLY") {
        throw new CheckoutQuoteError(
          "BILLING_CURRENCY_MISMATCH",
          `This voucher is issued in ${sourceCurrency} and cannot be used with a ${price.currency} checkout.`
        )
      }
      const sourceDiscount = discount
      const converted = await this.convertCurrency(
        sourceDiscount,
        sourceCurrency,
        price.currency
      )
      exchangeRate = converted.div(sourceDiscount)
      discount = converted
    }
    if (voucher.maximumDiscountAmount) {
      discount = Prisma.Decimal.min(discount, voucher.maximumDiscountAmount)
    }
    discount = Prisma.Decimal.min(discount, subtotal)

    return {
      id: voucher.id,
      code: voucher.code,
      kind: "PRODUCT_PROMOTION",
      discountType: voucher.discountType as "PERCENTAGE" | "FIXED",
      sourceAmount: voucher.discountValue.toString(),
      sourceCurrency,
      discountAmount: discount.toString(),
      discountCurrency: price.currency,
      currencyPolicy:
        voucher.currencyPolicy as CheckoutQuoteVoucher["currencyPolicy"],
      exchangeRate: exchangeRate?.toString() ?? null,
      rateAt: exchangeRate ? now.toISOString() : null,
      quoteExpiresAt: expiresAt.toISOString(),
    }
  }
}
