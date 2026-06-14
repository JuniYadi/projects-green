import type { Prisma } from "@prisma/client"

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

/**
 * DTO for VPN package — stable admin contract. `price` is serialized as a
 * string to avoid float precision loss across the boundary.
 */
export type VpnPackageDTO = Pick<
  Prisma.VpnPackageGetPayload<object>,
  "id" | "name" | "description" | "currency" | "isActive"
> & {
  price: string
  serverCount: number
  servers: VpnPackageServerDTO[]
  createdAt: string
  updatedAt: string
}

export function toVpnPackageDTO(pkg: VpnPackageWithServers): VpnPackageDTO {
  const servers: VpnPackageServerDTO[] = pkg.servers.map((entry) => {
    const server = toVpnServerDTO(entry.server)
    return {
      id: entry.id,
      server,
      protocols: serverProtocolLabels(server),
    }
  })

  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    currency: pkg.currency,
    isActive: pkg.isActive,
    price: pkg.price.toString(),
    serverCount: servers.length,
    servers,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  }
}
