import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import type {
  CreateVpnServerInput,
  UpdateVpnServerInput,
} from "./vpn-server.schema"

type PrismaLike = Pick<PrismaClient, "vpnServer" | "vpnRegion" | "vpnSshKey">

const serverInclude = {
  region: { select: { id: true, name: true, slug: true, countryCode: true } },
  sshKey: { select: { id: true, name: true, fingerprint: true } },
} satisfies Prisma.VpnServerInclude

export class VpnServerNotFoundError extends Error {
  constructor(message = "Server not found.") {
    super(message)
    this.name = "VpnServerNotFoundError"
  }
}

export class VpnServerReferenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VpnServerReferenceError"
  }
}

export class VpnServerConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VpnServerConflictError"
  }
}

const toProtocolData = (input: {
  openVpnPort?: number
  wireGuardPort?: number
  proxyPort?: number
}) => ({
  hasOpenVpn: typeof input.openVpnPort === "number",
  openVpnPort: input.openVpnPort ?? null,
  hasWireGuard: typeof input.wireGuardPort === "number",
  wireGuardPort: input.wireGuardPort ?? null,
  hasProxy: typeof input.proxyPort === "number",
  proxyPort: input.proxyPort ?? null,
})

export class VpnServerService {
  private readonly prisma: PrismaLike

  constructor(prisma: PrismaLike = defaultPrisma) {
    this.prisma = prisma
  }

  list(filter: { regionId?: string; search?: string } = {}) {
    const where: Prisma.VpnServerWhereInput = {}
    if (filter.regionId) where.regionId = filter.regionId
    if (filter.search) {
      where.OR = [
        { hostname: { contains: filter.search, mode: "insensitive" } },
        { ipAddress: { contains: filter.search, mode: "insensitive" } },
      ]
    }
    return this.prisma.vpnServer.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: serverInclude,
      orderBy: { name: "asc" },
    })
  }

  async create(input: CreateVpnServerInput) {
    await this.assertRegion(input.regionId)
    await this.assertSshKey(input.sshKeyId)
    await this.assertNameAvailable(input.name)

    return this.prisma.vpnServer.create({
      data: {
        name: input.name,
        regionId: input.regionId,
        hostname: input.hostname,
        ipAddress: input.ipAddress ?? null,
        sshPort: input.sshPort,
        sshKeyId: input.sshKeyId,
        sshUser: input.sshUser,
        isActive: input.isActive ?? true,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        ...toProtocolData(input),
      },
      include: serverInclude,
    })
  }

  async update(id: string, input: UpdateVpnServerInput) {
    await this.requireServer(id)
    await this.assertRegion(input.regionId)
    await this.assertSshKey(input.sshKeyId)
    await this.assertNameAvailable(input.name, id)

    return this.prisma.vpnServer.update({
      where: { id },
      data: {
        name: input.name,
        regionId: input.regionId,
        hostname: input.hostname,
        ipAddress: input.ipAddress ?? null,
        sshPort: input.sshPort,
        sshKeyId: input.sshKeyId,
        sshUser: input.sshUser,
        isActive: input.isActive ?? true,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        ...toProtocolData(input),
      },
      include: serverInclude,
    })
  }

  async remove(id: string) {
    await this.requireServer(id)
    await this.prisma.vpnServer.delete({ where: { id } })
  }

  async getById(id: string) {
    return this.requireServer(id)
  }

  private async requireServer(id: string) {
    const server = await this.prisma.vpnServer.findUnique({
      where: { id },
      include: serverInclude,
    })
    if (!server) {
      throw new VpnServerNotFoundError()
    }
    return server
  }

  private async assertRegion(regionId: string) {
    const region = await this.prisma.vpnRegion.findUnique({
      where: { id: regionId },
    })
    if (!region) {
      throw new VpnServerReferenceError("Selected region does not exist.")
    }
  }

  private async assertSshKey(sshKeyId: string) {
    const key = await this.prisma.vpnSshKey.findUnique({
      where: { id: sshKeyId },
    })
    if (!key) {
      throw new VpnServerReferenceError("Selected SSH key does not exist.")
    }
  }

  private async assertNameAvailable(name: string, ignoreId?: string) {
    const existing = await this.prisma.vpnServer.findUnique({
      where: { name },
    })
    if (existing && existing.id !== ignoreId) {
      throw new VpnServerConflictError(
        `A server named "${name}" already exists.`
      )
    }
  }
}

export const vpnServerService = new VpnServerService()
