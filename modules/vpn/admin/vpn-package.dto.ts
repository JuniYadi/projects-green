import type { Prisma } from "@prisma/client"

import {
  isCurrentVpnPackageOffer,
  vpnPeriodMonths,
  type VpnRecurringBillingPeriod,
} from "../subscriptions/vpn-package-pricing"
import { toVpnServerDTO, type VpnServerDTO } from "./vpn-server.dto"

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
      package: { select: { code: true } },
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
  billingPeriod: VpnRecurringBillingPeriod
  periodMonths: 1 | 3 | 6 | 12
  periodPrice: string
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
}

export type VpnPackageCatalogPlanDTO = {
  id: string
  code: string
  name: string
  packageCode: string
  isActive: boolean
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
  price: string | null
  serverCount: number
  servers: VpnPackageServerDTO[]
  catalogPlan: VpnPackageCatalogPlanDTO
  offers: VpnPackageOfferDTO[]
  pricingStatus: "READY" | "PRICING_REQUIRED"
  createdAt: string
  updatedAt: string
}

export function toVpnPackageDTO(
  pkg: VpnPackageWithServers,
  at = new Date()
): VpnPackageDTO {
  const servers: VpnPackageServerDTO[] = pkg.servers.map((entry) => {
    const server = toVpnServerDTO(entry.server)
    return {
      id: entry.id,
      server,
      protocols: serverProtocolLabels(server),
    }
  })
  const offers = pkg.servicePlan.pricings
    .filter((pricing) => isCurrentVpnPackageOffer(pricing, at))
    .map((pricing) => ({
      id: pricing.id,
      billingPeriod: pricing.billingPeriod,
      periodMonths: vpnPeriodMonths(pricing.billingPeriod),
      periodPrice: pricing.periodPrice.toString(),
      currency: pricing.currency,
      effectiveFrom: pricing.effectiveFrom.toISOString(),
      effectiveTo: pricing.effectiveTo?.toISOString() ?? null,
    }))

  return {
    servicePlanId: pkg.servicePlanId,
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    currency: pkg.currency,
    isActive: pkg.isActive,
    price: pkg.price?.toString() ?? null,
    serverCount: servers.length,
    servers,
    catalogPlan: {
      id: pkg.servicePlan.id,
      code: pkg.servicePlan.code,
      name: pkg.servicePlan.name,
      packageCode: pkg.servicePlan.package.code,
      isActive: pkg.servicePlan.isActive,
    },
    offers,
    pricingStatus:
      pkg.servicePlan.isActive && offers.length > 0
        ? "READY"
        : "PRICING_REQUIRED",
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  }
}
