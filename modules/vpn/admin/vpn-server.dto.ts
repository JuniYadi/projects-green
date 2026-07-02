import type { Prisma, VpnServerHealth } from "@prisma/client"

/**
 * DTO for VPN server — stable admin contract. Never exposes SSH key material;
 * surfaces only the key's id, name, and fingerprint for display.
 */
export type VpnServerDTO = {
  id: string
  name: string
  hostname: string
  ipAddress: string | null
  sshPort: number
  sshUser: string
  isActive: boolean
  health: VpnServerHealth
  latitude: number | null
  longitude: number | null
  region: { id: string; name: string; slug: string; countryCode: string }
  sshKey: { id: string; name: string; fingerprint: string }
  protocols: {
    openVpn: { enabled: boolean; port: number | null }
    wireGuard: { enabled: boolean; port: number | null }
    proxy: { enabled: boolean; port: number | null }
  }
  createdAt: string
  updatedAt: string
}

type VpnServerWithRelations = Prisma.VpnServerGetPayload<{
  include: {
    region: { select: { id: true; name: true; slug: true; countryCode: true } }
    sshKey: { select: { id: true; name: true; fingerprint: true } }
  }
}>

export function toVpnServerDTO(server: VpnServerWithRelations): VpnServerDTO {
  return {
    id: server.id,
    name: server.name,
    hostname: server.hostname,
    ipAddress: server.ipAddress,
    sshPort: server.sshPort,
    sshUser: server.sshUser,
    isActive: server.isActive,
    health: server.health,
    latitude: server.latitude,
    longitude: server.longitude,
    region: {
      id: server.region.id,
      name: server.region.name,
      slug: server.region.slug,
      countryCode: server.region.countryCode,
    },
    sshKey: {
      id: server.sshKey.id,
      name: server.sshKey.name,
      fingerprint: server.sshKey.fingerprint,
    },
    protocols: {
      openVpn: { enabled: server.hasOpenVpn, port: server.openVpnPort },
      wireGuard: { enabled: server.hasWireGuard, port: server.wireGuardPort },
      proxy: { enabled: server.hasProxy, port: server.proxyPort },
    },
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  }
}
