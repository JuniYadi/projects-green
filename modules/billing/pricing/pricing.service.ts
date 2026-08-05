import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { CurrencyNotFoundError, CurrencyService } from "../currency.service"
import {
  RecurringPriceResolutionError,
  type RecurringBillingPeriod,
  type ResolveRecurringPriceInput,
  type ResolvedRecurringPrice,
} from "./pricing.types"

const PERIOD_MONTHS: Record<RecurringBillingPeriod, 1 | 3 | 6 | 12> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

const recurringPeriods = Object.keys(PERIOD_MONTHS) as RecurringBillingPeriod[]

export async function resolveRecurringPrice(
  input: ResolveRecurringPriceInput
): Promise<ResolvedRecurringPrice> {
  const currency = await new CurrencyService().getByCode(input.currency)
  if (!currency.isActive) {
    throw new CurrencyNotFoundError(input.currency)
  }

  const at = input.at ?? new Date()
  const rows = await prisma.servicePricing.findMany({
    where: {
      id: input.pricingId,
      type: "BUNDLE",
      billingMode: "PACKAGE",
      billingPeriod: { in: recurringPeriods },
      currency: input.currency,
      isActive: true,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    include: {
      servicePlan: {
        select: {
          code: true,
          package: { select: { code: true } },
        },
      },
      region: { select: { code: true } },
    },
    orderBy: { effectiveFrom: "desc" },
  })

  if (rows.length === 0) {
    throw new RecurringPriceResolutionError(
      "PRICE_NOT_FOUND",
      `No active recurring price found for pricing=${input.pricingId} currency=${input.currency}`
    )
  }
  if (rows.length > 1) {
    throw new RecurringPriceResolutionError(
      "PRICE_CONFIGURATION_CONFLICT",
      `Multiple active recurring prices found for pricing=${input.pricingId} currency=${input.currency}`
    )
  }

  const row = rows[0]
  const billingPeriod = row.billingPeriod
  if (
    billingPeriod !== "MONTHLY" &&
    billingPeriod !== "QUARTERLY" &&
    billingPeriod !== "SEMI_ANNUAL" &&
    billingPeriod !== "ANNUAL"
  ) {
    throw new RecurringPriceResolutionError(
      "PRICE_NOT_FOUND",
      `Unsupported recurring billing period for pricing=${input.pricingId}`
    )
  }
  if (row.periodPrice === null) {
    throw new RecurringPriceResolutionError(
      "PRICE_NOT_FOUND",
      `Recurring price is not configured for pricing=${input.pricingId}`
    )
  }

  return {
    pricingId: row.id,
    packageCode: row.servicePlan.package.code,
    planId: row.planId,
    planCode: row.servicePlan.code,
    regionCode: row.region.code,
    billingPeriod,
    periodMonths: PERIOD_MONTHS[billingPeriod],
    chargeUnit: row.chargeUnit,
    periodPrice: row.periodPrice,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  }
}

export { RecurringPriceResolutionError }
export type {
  RecurringBillingPeriod,
  ResolveRecurringPriceInput,
  ResolvedRecurringPrice,
} from "./pricing.types"

export type PricingDecimal = Prisma.Decimal
