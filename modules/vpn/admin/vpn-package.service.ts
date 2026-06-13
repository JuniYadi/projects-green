import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import { vpnPackageInclude } from "./vpn-package.dto"
import type {
  CreateVpnPackageInput,
  UpdateVpnPackageInput,
} from "./vpn-package.schema"

type PrismaLike = Pick<PrismaClient, "vpnPackage" | "vpnServer">

export class VpnPackageNotFoundError extends Error {
  constructor(message = "Package not found.") {
    super(message)
    this.name = "VpnPackageNotFoundError"
  }
}

export class VpnPackageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VpnPackageValidationError"
  }
}

export class VpnPackageService {
  private readonly prisma: PrismaLike

  constructor(prisma: PrismaLike = defaultPrisma) {
    this.prisma = prisma
  }

  list() {
    return this.prisma.vpnPackage.findMany({
      include: vpnPackageInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  async create(input: CreateVpnPackageInput) {
    await this.assertServersExist(input.serverIds)

    return this.prisma.vpnPackage.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        price: new Prisma.Decimal(input.price),
        currency: input.currency,
        isActive: input.isActive ?? true,
        servers: {
          create: input.serverIds.map((serverId) => ({ serverId })),
        },
      },
      include: vpnPackageInclude,
    })
  }

  async update(id: string, input: UpdateVpnPackageInput) {
    await this.requirePackage(id)

    const data: Prisma.VpnPackageUpdateInput = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined)
      data.description = input.description ?? null
    if (input.price !== undefined) data.price = new Prisma.Decimal(input.price)
    if (input.currency !== undefined) data.currency = input.currency
    if (input.isActive !== undefined) data.isActive = input.isActive

    if (input.serverIds !== undefined) {
      await this.assertServersExist(input.serverIds)
      data.servers = {
        deleteMany: {},
        create: input.serverIds.map((serverId) => ({ serverId })),
      }
    }

    return this.prisma.vpnPackage.update({
      where: { id },
      data,
      include: vpnPackageInclude,
    })
  }

  /**
   * Soft delete: deactivate the package so existing subscriptions keep
   * running. Story 13 forbids hard deletion.
   */
  async deactivate(id: string) {
    await this.requirePackage(id)
    return this.prisma.vpnPackage.update({
      where: { id },
      data: { isActive: false },
      include: vpnPackageInclude,
    })
  }

  private async assertServersExist(serverIds: string[]) {
    const unique = [...new Set(serverIds)]
    const found = await this.prisma.vpnServer.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    })
    if (found.length !== unique.length) {
      const known = new Set(found.map((server) => server.id))
      const missing = unique.filter((id) => !known.has(id))
      throw new VpnPackageValidationError(
        `Unknown server id(s): ${missing.join(", ")}.`
      )
    }
  }

  private async requirePackage(id: string) {
    const pkg = await this.prisma.vpnPackage.findUnique({ where: { id } })
    if (!pkg) throw new VpnPackageNotFoundError()
    return pkg
  }
}

export const vpnPackageService = new VpnPackageService()
