import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import type { CreateVpnSshKeyInput } from "./vpn-ssh-key.schema"
import {
  computeSshKeyFingerprint,
  encryptSshPrivateKey,
} from "./vpn-ssh-key.crypto"

type PrismaLike = Pick<PrismaClient, "vpnSshKey">

const sshKeyInclude = {
  servers: { select: { name: true } },
} satisfies Prisma.VpnSshKeyInclude

export class VpnSshKeyNotFoundError extends Error {
  constructor(message = "SSH key not found.") {
    super(message)
    this.name = "VpnSshKeyNotFoundError"
  }
}

export class VpnSshKeyInUseError extends Error {
  constructor(message = "SSH key is referenced by a server and cannot be deleted.") {
    super(message)
    this.name = "VpnSshKeyInUseError"
  }
}

export class VpnSshKeyService {
  private readonly prisma: PrismaLike

  constructor(prisma: PrismaLike = defaultPrisma) {
    this.prisma = prisma
  }

  list() {
    return this.prisma.vpnSshKey.findMany({
      include: sshKeyInclude,
      orderBy: { name: "asc" },
    })
  }

  async create(input: CreateVpnSshKeyInput) {
    // Throws VpnSshKeyError (mapped at route) when the key cannot be parsed.
    const fingerprint = computeSshKeyFingerprint(input.privateKey)
    const encrypted = encryptSshPrivateKey(input.privateKey)

    return this.prisma.vpnSshKey.create({
      data: {
        name: input.name,
        privateKey: encrypted,
        fingerprint,
      },
      include: sshKeyInclude,
    })
  }

  async remove(id: string) {
    const key = await this.prisma.vpnSshKey.findUnique({
      where: { id },
      include: sshKeyInclude,
    })
    if (!key) {
      throw new VpnSshKeyNotFoundError()
    }
    if (key.servers.length > 0) {
      throw new VpnSshKeyInUseError()
    }
    await this.prisma.vpnSshKey.delete({ where: { id } })
  }
}

export const vpnSshKeyService = new VpnSshKeyService()
