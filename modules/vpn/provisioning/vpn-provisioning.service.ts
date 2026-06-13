import { Prisma, type PrismaClient, type VpnProtocol } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { encryptVpnConfig } from "@/modules/vpn/vpn-crypto"
import {
  OpenVpnSshAdapter,
  openVpnSshEnvFromProcessEnv,
} from "@/modules/vpn/openvpn/openvpn-ssh-adapter"

import { WireGuardSshAdapter } from "./wireguard-ssh-adapter"
import { ProxySshAdapter } from "./proxy-ssh-adapter"
import type { SshTarget } from "./vpn-server-ssh-executor"
import { hashProxyPassword } from "./proxy-password"

type PrismaLike = Pick<PrismaClient, "vpnServerAccount" | "vpnServer">

const accountWithServer = {
  include: {
    server: {
      include: { sshKey: { select: { privateKey: true } } },
    },
  },
} satisfies { include: Prisma.VpnServerAccountInclude }

export type ProvisioningAdapters = {
  openVpn?: Pick<OpenVpnSshAdapter, "createClient" | "fetchConfig">
  wireGuard?: Pick<WireGuardSshAdapter, "createPeer">
  proxy?: Pick<ProxySshAdapter, "createUser">
}

export class VpnServerAccountNotFoundError extends Error {
  constructor(message = "Server account not found.") {
    super(message)
    this.name = "VpnServerAccountNotFoundError"
  }
}

/**
 * Provisions a single VpnServerAccount by protocol. Each call is independent
 * so one server account failing does not affect the others (Story 14).
 *
 * On success: provisioningStatus=ACTIVE, config/credentials encrypted at rest.
 * On failure: provisioningStatus=FAILED with failureReason (rethrows so the
 * queue can retry).
 */
export class VpnProvisioningService {
  private readonly prisma: PrismaLike
  private readonly openVpn: NonNullable<ProvisioningAdapters["openVpn"]>
  private readonly wireGuard: NonNullable<ProvisioningAdapters["wireGuard"]>
  private readonly proxy: NonNullable<ProvisioningAdapters["proxy"]>

  constructor(
    prisma: PrismaLike = defaultPrisma,
    adapters: ProvisioningAdapters = {}
  ) {
    this.prisma = prisma
    this.openVpn =
      adapters.openVpn ??
      new OpenVpnSshAdapter({ env: openVpnSshEnvFromProcessEnv() })
    this.wireGuard = adapters.wireGuard ?? new WireGuardSshAdapter()
    this.proxy = adapters.proxy ?? new ProxySshAdapter()
  }

  async provisionAccount(serverAccountId: string): Promise<void> {
    const account = await this.prisma.vpnServerAccount.findUnique({
      where: { id: serverAccountId },
      ...accountWithServer,
    })
    if (!account) throw new VpnServerAccountNotFoundError()

    await this.prisma.vpnServerAccount.update({
      where: { id: serverAccountId },
      data: { provisioningStatus: "PROVISIONING", failureReason: null },
    })

    const target: SshTarget = {
      host: account.server.hostname,
      user: account.server.sshUser,
      encryptedPrivateKey: account.server.sshKey.privateKey,
    }

    try {
      const data = await this.runProtocol(
        account.protocol,
        target,
        account.username
      )
      await this.prisma.vpnServerAccount.update({
        where: { id: serverAccountId },
        data: {
          provisioningStatus: "ACTIVE",
          failureReason: null,
          ...data,
        },
      })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Provisioning failed"
      await this.prisma.vpnServerAccount.update({
        where: { id: serverAccountId },
        data: { provisioningStatus: "FAILED", failureReason: reason },
      })
      throw error
    }
  }

  private async runProtocol(
    protocol: VpnProtocol,
    target: SshTarget,
    username: string
  ): Promise<Prisma.VpnServerAccountUpdateInput> {
    switch (protocol) {
      case "OPENVPN": {
        await this.openVpn.createClient(username)
        const config = await this.openVpn.fetchConfig(username)
        return { configEncrypted: encryptVpnConfig(config) }
      }
      case "WIREGUARD": {
        const { config } = await this.wireGuard.createPeer(target, username)
        return { configEncrypted: encryptVpnConfig(config) }
      }
      case "PROXY": {
        const { password } = await this.proxy.createUser(target, username)
        return { password: hashProxyPassword(password) }
      }
      default: {
        const exhaustive: never = protocol
        throw new Error(`Unsupported protocol: ${String(exhaustive)}`)
      }
    }
  }
}

export const vpnProvisioningService = new VpnProvisioningService()
