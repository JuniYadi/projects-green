import type {
  Prisma,
  BillingPeriod,
  ProductState,
  ServiceType,
} from "@prisma/client"

export type AdminCatalogPriceDTO = {
  id: string
  billingPeriod: BillingPeriod
  currency: "IDR" | "USD" | string
  amount: string
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
}

export type AdminCatalogPriceInput = {
  billingPeriod: BillingPeriod
  currency: "IDR" | "USD"
  amount: string
  effectiveFrom?: string
  effectiveTo?: string
  isActive: boolean
}

export type AdminCatalogPlanDTO = {
  id: string
  code: string
  name: string
  resources: Record<string, unknown>
  isActive: boolean
  prices: AdminCatalogPriceDTO[]
}

export type AdminCatalogPlanInput = {
  code: string
  name: string
  resources: Record<string, unknown>
  isActive?: boolean
  prices: AdminCatalogPriceInput[]
}

export type AdminCatalogProductDTO = {
  code: ServiceType
  name: string
  description: string | null
  state: ProductState
  plans: AdminCatalogPlanDTO[]
  updatedAt: string
}

export type AdminCatalogProductInput = {
  code: ServiceType
  name: string
  description?: string | null
  plans: AdminCatalogPlanInput[]
}

type AdminCatalogRecord = Prisma.ServicePackageGetPayload<{
  include: { plans: { include: { pricings: true } } }
}>

type AdminCatalogPlanRecord = AdminCatalogRecord["plans"][number]
type AdminCatalogPricingRecord = AdminCatalogPlanRecord["pricings"][number]

export const toAdminCatalogPriceDTO = (
  pricing: AdminCatalogPricingRecord
): AdminCatalogPriceDTO => ({
  id: pricing.id,
  billingPeriod: pricing.billingPeriod as BillingPeriod,
  currency: pricing.currency,
  amount: pricing.periodPrice?.toString() ?? "0",
  effectiveFrom: pricing.effectiveFrom.toISOString(),
  effectiveTo: pricing.effectiveTo?.toISOString() ?? null,
  isActive: pricing.isActive,
})

export const toAdminCatalogPlanDTO = (
  plan: AdminCatalogPlanRecord
): AdminCatalogPlanDTO => ({
  id: plan.id,
  code: plan.code,
  name: plan.name,
  resources: (plan.resources ?? {}) as Record<string, unknown>,
  isActive: plan.isActive,
  prices: plan.pricings.map(toAdminCatalogPriceDTO),
})

export const toAdminCatalogProductDTO = (
  product: AdminCatalogRecord
): AdminCatalogProductDTO => ({
  code: product.code,
  name: product.name,
  description: product.description,
  state: (product.state ??
    (product.isActive ? "PUBLISHED" : "ARCHIVED")) as ProductState,
  plans: product.plans.map(toAdminCatalogPlanDTO),
  updatedAt: product.updatedAt.toISOString(),
})

export const adminCatalogInclude = {
  plans: {
    include: { pricings: { orderBy: { effectiveFrom: "desc" as const } } },
    orderBy: { code: "asc" as const },
  },
} as const
