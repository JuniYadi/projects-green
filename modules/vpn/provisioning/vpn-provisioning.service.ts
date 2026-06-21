import { Prisma, type PrismaClient, type VpnProtocol } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { logProvisioningEvent } from "@/lib/audit.service"
import {
  encryptVpnConfig,
  encryptProxyPassword,
} from "@/modules/vpn/vpn-crypto"
import { OpenVpnSshAdapter } from "@/modules/vpn/openvpn/openvpn-ssh-adapter"

import { WireGuardSshAdapter } from "./wireguard-ssh-adapter"
import { ProxySshAdapter } from "./proxy-ssh-adapter"
import type { SshTarget } from "./vpn-server-ssh-executor"

type PrismaLike = Pick<PrismaClient, "vpnServerAccount" | "vpnServer" | "vpnAuditLog">

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
      adapters.openVpn ?? new OpenVpnSshAdapter()
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

    logProvisioningEvent({
      action: "PROVISIONING_STARTED",
      serverAccountId,
      details: {
        serverAccountId,
        protocol: account.protocol,
        username: account.username,
      },
    })

    const target: SshTarget = {
      host: account.server.hostname,
      ipAddress: account.server.ipAddress ?? undefined,
      user: account.server.sshUser,
      encryptedPrivateKey: account.server.sshKey.privateKey,
    }

    try {
      const data = await this.runProtocol(
        account.protocol,
        target,
        account.username,
        serverAccountId,
      )
      await this.prisma.vpnServerAccount.update({
        where: { id: serverAccountId },
        data: {
          provisioningStatus: "ACTIVE",
          failureReason: null,
          ...data,
        },
      })
      logProvisioningEvent({
        action: "PROVISIONING_SUCCESS",
        serverAccountId,
        details: { serverAccountId, protocol: account.protocol },
      })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Provisioning failed"
      await this.prisma.vpnServerAccount.update({
        where: { id: serverAccountId },
        data: { provisioningStatus: "FAILED", failureReason: reason },
      })
      logProvisioningEvent({
        action: "PROVISIONING_FAILED",
        serverAccountId,
        details: { serverAccountId, failureReason: reason },
      })
      throw error
    }
  }

  private async runProtocol(
    protocol: VpnProtocol,
    target: SshTarget,
    username: string,
    serverAccountId: string,
  ): Promise<Prisma.VpnServerAccountUpdateInput> {
    switch (protocol) {
      case "OPENVPN": {
        await this.withStep(serverAccountId, "creating_client", () =>
          this.openVpn.createClient(target, username),
        )
        const config = await this.withStep(serverAccountId, "fetching_config", () =>
          this.openVpn.fetchConfig(target, username),
        )
        const encrypted = encryptVpnConfig(config)
        return { configEncrypted: encrypted }
      }
      case "WIREGUARD": {
        const { config } = await this.withStep(serverAccountId, "creating_peer", () =>
          this.wireGuard.createPeer(target, username),
        )
        return { configEncrypted: encryptVpnConfig(config) }
      }
      case "PROXY": {
        const { password } = await this.withStep(serverAccountId, "creating_user", () =>
          this.proxy.createUser(target, username),
        )
        return { password: encryptProxyPassword(password) }
      }
      default: {
        const exhaustive: never = protocol
        throw new Error(`Unsupported protocol: ${String(exhaustive)}`)
      }
    }
  }

  /**
   * Run an operation with a provisioning step log.
   * Logs OK on success, FAILED with message on error (re-throws).
   */
  /** Write a step log entry via the injected prisma instance. */
  private async logStep(
    serverAccountId: string,
    step: string,
    status: "OK" | "FAILED",
    message?: string,
  ): Promise<void> {
    try {
      await this.prisma.vpnAuditLog.create({
        data: {
          serverAccountId,
          action: "PROVISIONING_STEP",
          step,
          status,
          details: message
            ? ({ message } as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      })
    } catch {
      // Best-effort — never block provisioning
    }
  }

  private async withStep<T>(
    serverAccountId: string,
    step: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    try {
      const result = await fn()
      await this.logStep(serverAccountId, step, "OK")
      return result
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error"
      await this.logStep(serverAccountId, step, "FAILED", message)
      throw error
    }
  }
}

export const vpnProvisioningService = new VpnProvisioningService()
