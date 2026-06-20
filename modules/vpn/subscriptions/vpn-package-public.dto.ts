import type { Prisma } from "@prisma/client"

/**
 * Customer-facing VPN package include. Unlike the admin DTO this never pulls
 * SSH key material — only what a buyer needs to evaluate a package.
 */
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

type PackageServerPayload = PublicPackagePayload["servers"][number]["server"]

/** Enabled protocol labels on a server, derived from its feature flags. */
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

/** Summary card shape for the package listing grid. */
export type VpnPublicPackageDTO = {
  id: string
  name: string
  description: string | null
  price: string
  currency: string
  serverCount: number
  protocolCount: number
  regions: string[]
  // Multi-currency: converted price for the buyer's billing currency
  convertedPrice: string | null
  convertedCurrency: string | null
  exchangeRate: number | null
}

/** Detail shape with the per-server protocol breakdown. */
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

function summaryFields(
  pkg: PublicPackagePayload,
  servers: VpnPublicPackageServerDTO[],
  conversion?: PackageConversion
) {
  const regions = Array.from(new Set(servers.map((s) => s.region.name)))
  const protocolCount = servers.reduce((sum, s) => sum + s.protocols.length, 0)
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price.toString(),
    currency: pkg.currency,
    serverCount: servers.length,
    protocolCount,
    regions,
    convertedPrice: conversion?.convertedPrice.toString() ?? null,
    convertedCurrency: conversion?.convertedCurrency ?? null,
    exchangeRate: conversion?.exchangeRate ?? null,
  }
}

export function toVpnPublicPackageDTO(
  pkg: PublicPackagePayload,
  conversion?: PackageConversion
): VpnPublicPackageDTO {
  return summaryFields(pkg, buildServers(pkg), conversion)
}

export function toVpnPublicPackageDetailDTO(
  pkg: PublicPackagePayload,
  conversion?: PackageConversion
): VpnPublicPackageDetailDTO {
  const servers = buildServers(pkg)
  return { ...summaryFields(pkg, servers, conversion), servers }
}
