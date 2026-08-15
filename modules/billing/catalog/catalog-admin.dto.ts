import type { Prisma, ServiceType } from "@prisma/client"

import { toCatalogOfferDTO, type CatalogOfferDTO } from "./catalog.dto"

export const adminCatalogPlanInclude = {
  pricings: {
    include: {
      servicePlan: { include: { package: true } },
      region: true,
    },
  },
} satisfies Prisma.ServicePlanInclude

type AdminCatalogPlanPayload = Prisma.ServicePlanGetPayload<{
  include: typeof adminCatalogPlanInclude
}>

type AdminCatalogProductPayload = Prisma.ServicePackageGetPayload<{
  include: { plans: { include: typeof adminCatalogPlanInclude } }
}>

export type AdminCatalogOfferDTO = CatalogOfferDTO & {
  isActive: boolean
}

export type AdminCatalogPlanDTO = {
  id: string
  code: string
  name: string
  resources: Record<string, unknown>
  isActive: boolean
  offers: AdminCatalogOfferDTO[]
}

export type AdminCatalogProductDTO = {
  code: ServiceType
  name: string
  description: string | null
  isActive: boolean
  plans: AdminCatalogPlanDTO[]
}

export type AdminCatalogProductDetailResponse = {
  product: AdminCatalogProductDTO
  currency: string
}

export function toAdminCatalogPlanDTO(
  plan: AdminCatalogPlanPayload
): AdminCatalogPlanDTO {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    resources: plan.resources as Record<string, unknown>,
    isActive: plan.isActive,
    offers: plan.pricings.map((pricing) => ({
      ...toCatalogOfferDTO(pricing),
      isActive: pricing.isActive,
    })),
  }
}

export function toAdminCatalogProductDTO(
  product: AdminCatalogProductPayload
): AdminCatalogProductDetailResponse {
  const plans = product.plans.map(toAdminCatalogPlanDTO)
  const currency =
    plans.flatMap((plan) => plan.offers).find((offer) => offer.currency)
      ?.currency ?? "IDR"

  return {
    product: {
      code: product.code as ServiceType,
      name: product.name,
      description: product.description,
      isActive: product.isActive,
      plans,
    },
    currency,
  }
}
