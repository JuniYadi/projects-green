import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import {
  slugifyRegionName,
  type CreateVpnRegionInput,
  type UpdateVpnRegionInput,
} from "./vpn-region.schema"

type PrismaLike = Pick<PrismaClient, "vpnRegion">

const regionInclude = {
  _count: { select: { servers: true } },
} satisfies Prisma.VpnRegionInclude

export class VpnRegionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VpnRegionConflictError"
  }
}

export class VpnRegionNotFoundError extends Error {
  constructor(message = "Region not found.") {
    super(message)
    this.name = "VpnRegionNotFoundError"
  }
}

export class VpnRegionInUseError extends Error {
  constructor(message = "Region has servers and cannot be deleted.") {
    super(message)
    this.name = "VpnRegionInUseError"
  }
}

export class VpnRegionService {
  private readonly prisma: PrismaLike

  constructor(prisma: PrismaLike = defaultPrisma) {
    this.prisma = prisma
  }

  list() {
    return this.prisma.vpnRegion.findMany({
      include: regionInclude,
      orderBy: { name: "asc" },
    })
  }

  async create(input: CreateVpnRegionInput) {
    const slug = slugifyRegionName(input.name)
    if (!slug) {
      throw new VpnRegionConflictError(
        "Region name must contain at least one alphanumeric character."
      )
    }

    const existing = await this.prisma.vpnRegion.findUnique({
      where: { slug },
    })
    if (existing) {
      throw new VpnRegionConflictError(
        `A region with slug "${slug}" already exists.`
      )
    }

    return this.prisma.vpnRegion.create({
      data: {
        name: input.name,
        slug,
        flagEmoji: input.flagEmoji,
        isActive: input.isActive ?? true,
      },
      include: regionInclude,
    })
  }

  async update(id: string, input: UpdateVpnRegionInput) {
    await this.requireRegion(id)

    const data: Prisma.VpnRegionUpdateInput = {}
    if (input.name !== undefined) {
      const slug = slugifyRegionName(input.name)
      if (!slug) {
        throw new VpnRegionConflictError(
          "Region name must contain at least one alphanumeric character."
        )
      }
      const clash = await this.prisma.vpnRegion.findUnique({ where: { slug } })
      if (clash && clash.id !== id) {
        throw new VpnRegionConflictError(
          `A region with slug "${slug}" already exists.`
        )
      }
      data.name = input.name
      data.slug = slug
    }
    if (input.flagEmoji !== undefined) data.flagEmoji = input.flagEmoji
    if (input.isActive !== undefined) data.isActive = input.isActive

    return this.prisma.vpnRegion.update({
      where: { id },
      data,
      include: regionInclude,
    })
  }

  async remove(id: string) {
    const region = await this.requireRegion(id)
    if (region._count.servers > 0) {
      throw new VpnRegionInUseError()
    }
    await this.prisma.vpnRegion.delete({ where: { id } })
  }

  private async requireRegion(id: string) {
    const region = await this.prisma.vpnRegion.findUnique({
      where: { id },
      include: regionInclude,
    })
    if (!region) {
      throw new VpnRegionNotFoundError()
    }
    return region
  }
}

export const vpnRegionService = new VpnRegionService()
