import type { Prisma } from "@prisma/client"

import { toVpnServerDTO, type VpnServerDTO } from "./vpn-server.dto"
import {
  hasValidVpnCatalogOffer,
  isVpnCatalogParentActive,
  isValidVpnCatalogOffer,
  vpnPeriodMonths,
  type VpnRecurringPeriod,
} from "../catalog/vpn-catalog-eligibility"

const packageServerInclude = {
  server: {
    include: {
      region: {
        select: { id: true, name: true, slug: true, countryCode: true },
      },
      sshKey: { select: { id: true, name: true, fingerprint: true } },
    },
  },
} satisfies Prisma.VpnPackageServerInclude

export const vpnPackageInclude = {
  servers: { include: packageServerInclude },
  servicePlan: {
    include: {
      package: { select: { code: true, isActive: true } },
      pricings: { orderBy: { effectiveFrom: "desc" } },
    },
  },
} satisfies Prisma.VpnPackageInclude

type VpnPackageWithServers = Prisma.VpnPackageGetPayload<{
  include: typeof vpnPackageInclude
}>

/**
 * Protocol labels enabled on a server, derived from its feature flags.
 * Mirrors the "Protocols auto-detected from server config" rule in Story 13.
 */
export function serverProtocolLabels(server: VpnServerDTO): string[] {
  const labels: string[] = []
  if (server.protocols.openVpn.enabled) labels.push("OpenVPN")
  if (server.protocols.wireGuard.enabled) labels.push("WireGuard")
  if (server.protocols.proxy.enabled) labels.push("Proxy")
  return labels
}

export type VpnPackageServerDTO = {
  id: string
  server: VpnServerDTO
  protocols: string[]
}

export type VpnPackageOfferDTO = {
  id: string
  billingPeriod: VpnRecurringPeriod
  periodMonths: 1 | 3 | 6 | 12
  periodPrice: string
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
}

export type VpnPackageCatalogPlanDTO = {
  id: string
  code: string
  name: string
  isActive: boolean
  parentIsActive: boolean
  offers: VpnPackageOfferDTO[]
}

/**
 * DTO for VPN package — stable admin contract. `price` is serialized as a
 * string to avoid float precision loss across the boundary.
 */
export type VpnPackageDTO = Pick<
  Prisma.VpnPackageGetPayload<object>,
  "id" | "name" | "description" | "currency" | "isActive"
> & {
  servicePlanId: string
  catalogPlan: VpnPackageCatalogPlanDTO | null
  pricingStatus: "READY" | "PRICING_REQUIRED"
  catalogAvailable: boolean
  price: string | null
  serverCount: number
  servers: VpnPackageServerDTO[]
  createdAt: string
  updatedAt: string
}

export function toVpnPackageDTO(pkg: VpnPackageWithServers): VpnPackageDTO {
  const servicePlan = pkg.servicePlan
  const now = new Date()
  const servers: VpnPackageServerDTO[] = pkg.servers.map((entry) => {
    const server = toVpnServerDTO(entry.server)
    return {
      id: entry.id,
      server,
      protocols: serverProtocolLabels(server),
    }
  })

  const offers = servicePlan
    ? servicePlan.pricings
        .filter((pricing) => isValidVpnCatalogOffer(pricing, now))
        .map(
          (pricing): VpnPackageOfferDTO => ({
            id: pricing.id,
            billingPeriod: pricing.billingPeriod as VpnRecurringPeriod,
            periodMonths: vpnPeriodMonths(
              pricing.billingPeriod as VpnRecurringPeriod
            ),
            periodPrice: pricing.periodPrice!.toString(),
            currency: pricing.currency,
            effectiveFrom: pricing.effectiveFrom.toISOString(),
            effectiveTo: pricing.effectiveTo?.toISOString() ?? null,
            isActive: pricing.isActive,
          })
        )
    : []
  const parentIsActive = servicePlan?.package?.isActive ?? false
  const planIsActive = servicePlan?.isActive ?? false
  const catalogPlan = servicePlan
    ? {
        id: servicePlan.id,
        code: servicePlan.code,
        name: servicePlan.name,
        isActive: planIsActive,
        parentIsActive,
        offers,
      }
    : null
  const hasValidOffers = servicePlan
    ? hasValidVpnCatalogOffer(servicePlan.pricings, now)
    : false

  return {
    servicePlanId: pkg.servicePlanId,
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    currency: pkg.currency,
    isActive: pkg.isActive,
    price: pkg.price?.toString() ?? null,
    catalogPlan,
    pricingStatus: hasValidOffers ? "READY" : "PRICING_REQUIRED",
    catalogAvailable:
      pkg.isActive && isVpnCatalogParentActive(servicePlan) && hasValidOffers,
    serverCount: servers.length,
    servers,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  }
}
