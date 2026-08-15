import type { Prisma } from "@prisma/client"

export const VPN_RECURRING_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
] as const

export type VpnRecurringBillingPeriod = (typeof VPN_RECURRING_PERIODS)[number]

export type VpnPackagePricing = {
  type: string
  billingMode: string
  billingPeriod: string | null
  periodPrice: Prisma.Decimal | null
  effectiveFrom: Date
  effectiveTo: Date | null
  isActive: boolean
}

const PERIOD_MONTHS: Record<VpnRecurringBillingPeriod, 1 | 3 | 6 | 12> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

export function isCurrentVpnPackageOffer(
  pricing: VpnPackagePricing,
  at = new Date()
): pricing is VpnPackagePricing & {
  billingPeriod: VpnRecurringBillingPeriod
  periodPrice: Prisma.Decimal
} {
  if (
    !pricing.isActive ||
    pricing.type !== "BUNDLE" ||
    pricing.billingMode !== "PACKAGE" ||
    !pricing.billingPeriod ||
    !VPN_RECURRING_PERIODS.includes(
      pricing.billingPeriod as VpnRecurringBillingPeriod
    ) ||
    !pricing.periodPrice ||
    pricing.periodPrice.lt(0)
  ) {
    return false
  }

  return (
    pricing.effectiveFrom <= at &&
    (!pricing.effectiveTo || at < pricing.effectiveTo)
  )
}

export function vpnPeriodMonths(
  period: VpnRecurringBillingPeriod
): 1 | 3 | 6 | 12 {
  return PERIOD_MONTHS[period]
}
