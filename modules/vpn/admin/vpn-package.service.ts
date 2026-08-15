import { randomUUID } from "node:crypto"

import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import { vpnPackageInclude } from "./vpn-package.dto"
import type {
  CreateVpnPackageInput,
  UpdateVpnPackageInput,
} from "./vpn-package.schema"

type PrismaLike = Pick<
  PrismaClient,
  "vpnPackage" | "vpnServer" | "servicePackage" | "$transaction"
>

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
    return this.prisma.$transaction(async (tx) => {
      await this.assertServersExist(input.serverIds, tx)

      const vpnProduct = await tx.servicePackage.findUnique({
        where: { code: "VPN" },
        select: { id: true },
      })
      if (!vpnProduct) {
        throw new VpnPackageValidationError(
          "The global VPN catalog product is not configured."
        )
      }

      return tx.vpnPackage.create({
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive ?? true,
          servicePlan: {
            create: {
              code: `VPN_${randomUUID()}`,
              name: input.name,
              resources: {},
              isActive: input.isActive ?? true,
              package: { connect: { id: vpnProduct.id } },
            },
          },
          servers: {
            create: input.serverIds.map((serverId) => ({ serverId })),
          },
        },
        include: vpnPackageInclude,
      })
    })
  }

  async update(id: string, input: UpdateVpnPackageInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.requirePackage(id, tx)

      const data: Prisma.VpnPackageUpdateInput = {}
      if (input.name !== undefined) data.name = input.name
      if (input.description !== undefined)
        data.description = input.description ?? null
      if (input.isActive !== undefined) data.isActive = input.isActive

      if (input.serverIds !== undefined) {
        await this.assertServersExist(input.serverIds, tx)
        data.servers = {
          deleteMany: {},
          create: input.serverIds.map((serverId) => ({ serverId })),
        }
      }

      return tx.vpnPackage.update({
        where: { id },
        data,
        include: vpnPackageInclude,
      })
    })
  }

  /**
   * Soft delete: deactivate the package so existing subscriptions keep
   * running. Story 13 forbids hard deletion.
   */
  async deactivate(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.requirePackage(id, tx)
      return tx.vpnPackage.update({
        where: { id },
        data: { isActive: false },
        include: vpnPackageInclude,
      })
    })
  }

  private async assertServersExist(
    serverIds: string[],
    db: Pick<Prisma.TransactionClient, "vpnServer"> | PrismaLike
  ) {
    const unique = [...new Set(serverIds)]
    const found = await db.vpnServer.findMany({
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

  private async requirePackage(
    id: string,
    db: Pick<Prisma.TransactionClient, "vpnPackage"> | PrismaLike
  ) {
    const pkg = await db.vpnPackage.findUnique({
      where: { id },
      include: {
        servicePlan: { select: { package: { select: { code: true } } } },
      },
    })
    if (!pkg) throw new VpnPackageNotFoundError()
    if (pkg.servicePlan.package.code !== "VPN") {
      throw new VpnPackageValidationError(
        "The VPN package is not linked to the global VPN catalog product."
      )
    }
    return pkg
  }
}

export const vpnPackageService = new VpnPackageService()
