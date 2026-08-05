import type { Prisma } from "@prisma/client"

export const publicPackageInclude = {
  servers: {
    include: {
      server: {
        include: {
          region: {
            select: { id: true, name: true, slug: true, countryCode: true },
          },
        },
      },
    },
  },
} satisfies Prisma.VpnPackageInclude

type PublicPackagePayload = Prisma.VpnPackageGetPayload<{
  include: typeof publicPackageInclude
}>

type PublicPricingPayload = {
  id: string
  type: string
  billingMode: string
  billingPeriod: string | null
  periodPrice: Prisma.Decimal | null
  currency: string
  effectiveFrom: Date
  effectiveTo: Date | null
  isActive: boolean
}

type PublicPackageWithPricing = PublicPackagePayload & {
  servicePlan: { pricings: PublicPricingPayload[] }
}

type PackageServerPayload = PublicPackagePayload["servers"][number]["server"]

function serverProtocols(server: PackageServerPayload): string[] {
  const protocols: string[] = []
  if (server.hasOpenVpn) protocols.push("OpenVPN")
  if (server.hasWireGuard) protocols.push("WireGuard")
  if (server.hasProxy) protocols.push("Proxy")
  return protocols
}

export type VpnPublicPackageServerDTO = {
  serverId: string
  name: string
  region: { name: string; slug: string; countryCode: string }
  protocols: string[]
}

export type VpnPublicPackageOfferDTO = {
  pricingId: string
  billingPeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"
  periodMonths: 1 | 3 | 6 | 12
  periodPrice: string
  currency: string
  convertedPrice: string | null
  convertedCurrency: string | null
  exchangeRate: number | null
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
}

export type VpnPublicPackageDTO = {
  id: string
  name: string
  description: string | null
  offers: VpnPublicPackageOfferDTO[]
  price: string
  currency: string
  serverCount: number
  protocolCount: number
  regions: string[]
  convertedPrice: string | null
  convertedCurrency: string | null
  exchangeRate: number | null
}

export type VpnPublicPackageDetailDTO = VpnPublicPackageDTO & {
  servers: VpnPublicPackageServerDTO[]
}

function toServerDTO(
  entry: PublicPackagePayload["servers"][number]
): VpnPublicPackageServerDTO {
  const { server } = entry
  return {
    serverId: server.id,
    name: server.name,
    region: {
      name: server.region.name,
      slug: server.region.slug,
      countryCode: server.region.countryCode,
    },
    protocols: serverProtocols(server),
  }
}

function buildServers(pkg: PublicPackagePayload): VpnPublicPackageServerDTO[] {
  return pkg.servers.map(toServerDTO)
}

export type PackageConversion = {
  convertedPrice: Prisma.Decimal
  convertedCurrency: string
  exchangeRate: number
}
type RecurringPeriod = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"

const PERIOD_MONTHS: Record<RecurringPeriod, 1 | 3 | 6 | 12> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

function summaryFields(
  pkg: PublicPackageWithPricing,
  servers: VpnPublicPackageServerDTO[],
  conversions: Map<string, PackageConversion> = new Map(),
  at = new Date()
) {
  const regions = Array.from(
    new Set(servers.map((server) => server.region.name))
  )
  const protocolCount = servers.reduce(
    (sum, server) => sum + server.protocols.length,
    0
  )
  const pricings = pkg.servicePlan.pricings
  const offers: VpnPublicPackageOfferDTO[] = pricings
    .filter((pricing) => {
      if (
        !pricing.isActive ||
        pricing.type !== "BUNDLE" ||
        pricing.billingMode !== "PACKAGE"
      )
        return false
      if (!pricing.billingPeriod || !(pricing.billingPeriod in PERIOD_MONTHS))
        return false
      if (!pricing.periodPrice || pricing.periodPrice.lt(0)) return false
      return (
        pricing.effectiveFrom <= at &&
        (!pricing.effectiveTo || at < pricing.effectiveTo)
      )
    })
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
    .map((pricing) => {
      const conversion = conversions.get(pricing.id)
      const billingPeriod = pricing.billingPeriod as RecurringPeriod
      return {
        pricingId: pricing.id,
        billingPeriod,
        periodMonths: PERIOD_MONTHS[billingPeriod],
        periodPrice: pricing.periodPrice!.toString(),
        currency: pricing.currency,
        convertedPrice: conversion?.convertedPrice.toString() ?? null,
        convertedCurrency: conversion?.convertedCurrency ?? null,
        exchangeRate: conversion?.exchangeRate ?? null,
        effectiveFrom: pricing.effectiveFrom.toISOString(),
        effectiveTo: pricing.effectiveTo?.toISOString() ?? null,
        isActive: pricing.isActive,
      }
    })
  const first = offers[0]
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    offers,
    price: first?.periodPrice ?? "0",
    currency: first?.currency ?? "IDR",
    serverCount: servers.length,
    protocolCount,
    regions,
    convertedPrice: first?.convertedPrice ?? null,
    convertedCurrency: first?.convertedCurrency ?? null,
    exchangeRate: first?.exchangeRate ?? null,
  }
}

export function toVpnPublicPackageDTO(
  pkg: PublicPackageWithPricing,
  conversions: Map<string, PackageConversion> = new Map(),
  at?: Date
): VpnPublicPackageDTO {
  return summaryFields(pkg, buildServers(pkg), conversions, at)
}

export function toVpnPublicPackageDetailDTO(
  pkg: PublicPackageWithPricing,
  conversions: Map<string, PackageConversion> = new Map(),
  at?: Date
): VpnPublicPackageDetailDTO {
  const servers = buildServers(pkg)
  return { ...summaryFields(pkg, servers, conversions, at), servers }
}
