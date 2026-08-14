import { Prisma } from "@prisma/client"

export const VPN_CATALOG_CODE = "VPN" as const

export const VPN_RECURRING_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
] as const

export type VpnRecurringPeriod = (typeof VPN_RECURRING_PERIODS)[number]

export type VpnCatalogOfferLike = {
  type: string
  billingMode: string
  billingPeriod: string | null
  periodPrice: Prisma.Decimal | number | string | null
  effectiveFrom: Date
  effectiveTo: Date | null
  isActive: boolean
}

export type VpnCatalogPlanLike = {
  isActive: boolean
  package?: {
    code: string
    isActive: boolean
  } | null
}

export function isVpnCatalogParent(
  plan: VpnCatalogPlanLike | null | undefined
): boolean {
  return plan?.package?.code === VPN_CATALOG_CODE
}

export function isVpnCatalogParentActive(
  plan: VpnCatalogPlanLike | null | undefined
): boolean {
  const parent = plan?.package
  return (
    plan?.isActive === true &&
    parent?.code === VPN_CATALOG_CODE &&
    parent.isActive === true
  )
}

export function isValidVpnCatalogOffer(
  offer: VpnCatalogOfferLike,
  at = new Date()
): boolean {
  if (
    !offer.isActive ||
    offer.type !== "BUNDLE" ||
    offer.billingMode !== "PACKAGE" ||
    !offer.billingPeriod ||
    !VPN_RECURRING_PERIODS.includes(
      offer.billingPeriod as VpnRecurringPeriod
    ) ||
    offer.periodPrice === null
  ) {
    return false
  }

  const periodPrice = new Prisma.Decimal(offer.periodPrice)
  return (
    periodPrice.gt(0) &&
    offer.effectiveFrom <= at &&
    (offer.effectiveTo === null || offer.effectiveTo > at)
  )
}

export function hasValidVpnCatalogOffer(
  offers: VpnCatalogOfferLike[],
  at = new Date()
): boolean {
  return offers.some((offer) => isValidVpnCatalogOffer(offer, at))
}

export function vpnPeriodMonths(period: VpnRecurringPeriod): 1 | 3 | 6 | 12 {
  switch (period) {
    case "MONTHLY":
      return 1
    case "QUARTERLY":
      return 3
    case "SEMI_ANNUAL":
      return 6
    case "ANNUAL":
      return 12
  }
}
