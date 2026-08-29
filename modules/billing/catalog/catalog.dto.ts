import type { Prisma, ServiceType } from "@prisma/client"
import type { RecurringBillingPeriod } from "../pricing/pricing.types"

type CatalogPricingRecord = Prisma.ServicePricingGetPayload<{
  include: {
    servicePlan: {
      include: {
        package: true
      }
    }
    region: true
  }
}>

// ─── Offer ─────────────────────────────────────────────────────────────

export type CatalogOfferDTO = {
  id: string
  billingPeriod: RecurringBillingPeriod
  periodMonths: 1 | 3 | 6 | 12
  periodPrice: string
  currency: string
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  effectiveFrom: string // ISO date
  effectiveTo: string | null
  regionId?: string | null
  regionCode?: string | null
  regionName?: string | null
  regionFlag?: string | null
}

const PERIOD_MONTHS: Record<RecurringBillingPeriod, 1 | 3 | 6 | 12> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

export function toCatalogOfferDTO(
  pricing: CatalogPricingRecord
): CatalogOfferDTO {
  const billingPeriod = pricing.billingPeriod as RecurringBillingPeriod
  return {
    id: pricing.id,
    billingPeriod,
    periodMonths: PERIOD_MONTHS[billingPeriod],
    periodPrice: pricing.periodPrice?.toString() ?? "0",
    currency: pricing.currency,
    chargeUnit: pricing.chargeUnit as "SUBSCRIPTION" | "DEVICE",
    effectiveFrom: pricing.effectiveFrom.toISOString(),
    effectiveTo: pricing.effectiveTo?.toISOString() ?? null,
    regionId: pricing.regionId ?? null,
    regionCode: pricing.region?.code ?? null,
    regionName: pricing.region?.name ?? null,
    regionFlag: pricing.region?.flag ?? null,
  }
}

// ─── Plan ─────────────────────────────────────────────────────────────

export type CatalogPlanDTO = {
  id: string
  code: string
  name: string
  resources: Record<string, unknown>
  billingStrategy: "PRO_RATA" | "FIXED_CYCLE"
  stockControl: "UNLIMITED" | "TRACKED"
  stockCount: number | null
  allowBackorder: boolean
  isActive: boolean
  offers: CatalogOfferDTO[]
}

export function toCatalogPlanDTO(
  plan: Prisma.ServicePlanGetPayload<{
    include: {
      pricings: {
        include: {
          servicePlan: {
            include: {
              package: true
            }
          }
          region: true
        }
      }
    }
  }>
): CatalogPlanDTO {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    resources: plan.resources as Record<string, unknown>,
    billingStrategy: plan.billingStrategy,
    stockControl: plan.stockControl,
    stockCount: plan.stockCount,
    allowBackorder: plan.allowBackorder,
    isActive: plan.isActive,
    offers: plan.pricings.map(toCatalogOfferDTO),
  }
}

// ─── Product ──────────────────────────────────────────────────────────

export type CatalogProductDTO = {
  code: ServiceType
  name: string
  description: string | null
  isActive: boolean
  plans: CatalogPlanDTO[]
}

// ─── List response ─────────────────────────────────────────────────────

export type CatalogListResponse = {
  products: CatalogProductDTO[]
  currency: string
}

// ─── Detail response ───────────────────────────────────────────────────

export type CatalogProductDetailResponse = {
  product: CatalogProductDTO
  currency: string
}
