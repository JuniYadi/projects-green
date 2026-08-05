import type { Prisma, ServiceType } from "@prisma/client"

export type RecurringBillingPeriod =
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUAL"

export type ResolveRecurringPriceInput = {
  pricingId: string
  currency: string
  at?: Date
}

export type ResolvedRecurringPrice = {
  pricingId: string
  packageCode: ServiceType
  planId: string
  planCode: string
  regionCode: string
  billingPeriod: RecurringBillingPeriod
  periodMonths: 1 | 3 | 6 | 12
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  periodPrice: Prisma.Decimal
  currency: string
  effectiveFrom: Date
  effectiveTo: Date | null
}

export type RecurringPriceResolutionCode =
  | "PRICE_NOT_FOUND"
  | "PRICE_CONFIGURATION_CONFLICT"

export class RecurringPriceResolutionError extends Error {
  constructor(
    public readonly code: RecurringPriceResolutionCode,
    message: string
  ) {
    super(message)
    this.name = "RecurringPriceResolutionError"
  }
}
