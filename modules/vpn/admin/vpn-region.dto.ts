import type { Prisma } from "@prisma/client"

/**
 * DTO for VPN region — stable contract returned to admin clients.
 */
export type VpnRegionDTO = Pick<
  Prisma.VpnRegionGetPayload<object>,
  "id" | "name" | "slug" | "flagEmoji" | "isActive"
> & {
  serverCount: number
  createdAt: string
  updatedAt: string
}

type VpnRegionWithCount = Prisma.VpnRegionGetPayload<{
  include: { _count: { select: { servers: true } } }
}>

export function toVpnRegionDTO(region: VpnRegionWithCount): VpnRegionDTO {
  return {
    id: region.id,
    name: region.name,
    slug: region.slug,
    flagEmoji: region.flagEmoji,
    isActive: region.isActive,
    serverCount: region._count.servers,
    createdAt: region.createdAt.toISOString(),
    updatedAt: region.updatedAt.toISOString(),
  }
}
