import type { Prisma } from "@prisma/client"

/**
 * DTO for VPN SSH key — NEVER includes the private key (write-only).
 * Exposes only safe metadata plus the list of servers referencing it.
 */
export type VpnSshKeyDTO = {
  id: string
  name: string
  fingerprint: string
  usedByServerNames: string[]
  createdAt: string
  updatedAt: string
}

type VpnSshKeyWithServers = Prisma.VpnSshKeyGetPayload<{
  include: { servers: { select: { name: true } } }
}>

export function toVpnSshKeyDTO(key: VpnSshKeyWithServers): VpnSshKeyDTO {
  return {
    id: key.id,
    name: key.name,
    fingerprint: key.fingerprint,
    usedByServerNames: key.servers.map((server) => server.name),
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
  }
}
