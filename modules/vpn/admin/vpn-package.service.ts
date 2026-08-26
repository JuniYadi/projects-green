import { randomBytes } from "node:crypto"

import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import { isVpnCatalogParent } from "../catalog/vpn-catalog-eligibility"
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

export function slugifyPlanName(name: string): string {
  const clean = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 32)
  return clean || "PLAN"
}

export function generateVpnPlanCode(name: string): string {
  const slug = slugifyPlanName(name)
  const suffix = randomBytes(4).toString("hex").toUpperCase()
  return `VPN_${slug}_${suffix}`
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

    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.servicePackage.findUnique({
        where: { code: "VPN" },
        select: { id: true, isActive: true },
      })
      if (!parent || !parent.isActive) {
        throw new VpnPackageValidationError(
          "The global VPN catalog product is unavailable."
        )
      }

      return tx.vpnPackage.create({
        data: {
          name: input.name,
          price:
            input.price === undefined
              ? undefined
              : new Prisma.Decimal(input.price),
          currency: input.currency,
          isActive: input.isActive ?? true,
          servicePlan: {
            create: {
              code: generateVpnPlanCode(input.name),
              name: input.name,
              resources: {},
              isActive: input.isActive ?? true,
              package: { connect: { code: "VPN" } },
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
    if (input.serverIds !== undefined) {
      await this.assertServersExist(input.serverIds)
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.vpnPackage.findUnique({
        where: { id },
        include: {
          servicePlan: {
            include: {
              package: { select: { code: true, isActive: true } },
            },
          },
        },
      })
      if (!existing) throw new VpnPackageNotFoundError()
      if (!isVpnCatalogParent(existing.servicePlan)) {
        throw new VpnPackageValidationError(
          "VPN package is not linked to the global VPN catalog product."
        )
      }

      const data: Prisma.VpnPackageUpdateInput = {}
      if (input.name !== undefined) data.name = input.name
      if (input.description !== undefined)
        data.description = input.description ?? null
      if (input.isActive !== undefined) data.isActive = input.isActive

      if (input.serverIds !== undefined) {
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
      await this.requirePackage(tx, id)
      return tx.vpnPackage.update({
        where: { id },
        data: { isActive: false },
        include: vpnPackageInclude,
      })
    })
  }

  private async assertServersExist(
    serverIds: string[],
    client: Pick<PrismaClient, "vpnServer"> = this.prisma
  ) {
    const unique = [...new Set(serverIds)]
    const found = await client.vpnServer.findMany({
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
    client: Pick<PrismaClient, "vpnPackage">,
    id: string
  ) {
    const pkg = await client.vpnPackage.findUnique({ where: { id } })
    if (!pkg) throw new VpnPackageNotFoundError()
    return pkg
  }
}

export const vpnPackageService = new VpnPackageService()
