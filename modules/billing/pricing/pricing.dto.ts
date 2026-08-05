import type {
  BillingChargeUnit,
  BillingMode,
  Prisma,
  ServiceType,
  SubscriptionType,
} from "@prisma/client"
import type { RecurringBillingPeriod } from "./pricing.types"

type PricingRecord = Prisma.ServicePricingGetPayload<{
  include: {
    servicePlan: { include: { package: true } }
    region: true
  }
}>

export type PricingDTO = {
  id: string
  planId: string
  regionId: string
  packageCode: ServiceType
  planCode: string
  regionCode: string
  type: SubscriptionType
  billingMode: BillingMode
  billingPeriod: RecurringBillingPeriod | null
  periodPrice: string | null
  currency: string
  chargeUnit: BillingChargeUnit
  effectiveFrom: Date
  effectiveTo: Date | null
  isActive: boolean
  basePriceIdr: string
  monthlyCapIdr: string | null
  unitRateCpu: string | null
  unitRateMem: string | null
  unitRateMessage: string | null
}

const decimalString = (value: Prisma.Decimal | null | undefined) =>
  value === null || value === undefined ? null : value.toString()

export function toPricingDTO(pricing: PricingRecord): PricingDTO {
  return {
    id: pricing.id,
    planId: pricing.planId,
    regionId: pricing.regionId,
    packageCode: pricing.servicePlan.package.code,
    planCode: pricing.servicePlan.code,
    regionCode: pricing.region.code,
    type: pricing.type,
    billingMode: pricing.billingMode,
    billingPeriod:
      pricing.billingPeriod === "MONTHLY" ||
      pricing.billingPeriod === "QUARTERLY" ||
      pricing.billingPeriod === "SEMI_ANNUAL" ||
      pricing.billingPeriod === "ANNUAL"
        ? pricing.billingPeriod
        : null,
    periodPrice: decimalString(pricing.periodPrice),
    currency: pricing.currency,
    chargeUnit: pricing.chargeUnit,
    effectiveFrom: pricing.effectiveFrom,
    effectiveTo: pricing.effectiveTo,
    isActive: pricing.isActive,
    basePriceIdr: pricing.basePriceIdr.toString(),
    monthlyCapIdr: decimalString(pricing.monthlyCapIdr),
    unitRateCpu: decimalString(pricing.unitRateCpu),
    unitRateMem: decimalString(pricing.unitRateMem),
    unitRateMessage: decimalString(pricing.unitRateMessage),
  }
}
