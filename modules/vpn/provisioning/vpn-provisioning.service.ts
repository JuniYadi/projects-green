import { Prisma, type PrismaClient, type VpnProtocol } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
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

type AccountWithServer = Prisma.VpnServerAccountGetPayload<
  typeof accountWithServer
>

export type ProvisioningAdapters = {
  openVpn?: Pick<OpenVpnSshAdapter, "createClient" | "fetchConfig" | "validateClient" | "revokeClient" | "removeClient">
  wireGuard?: Pick<WireGuardSshAdapter, "createPeer" | "validatePeer">
  proxy?: Pick<ProxySshAdapter, "createUser" | "validateUser">
}

export type VpnAccountValidationResult = {
  exists: boolean
  status: "FOUND" | "MISSING"
  message: string
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
    const account = await this.findAccount(serverAccountId)

    await this.prisma.vpnServerAccount.update({
      where: { id: serverAccountId },
      data: { provisioningStatus: "PROVISIONING", failureReason: null },
    })

    console.info(
      `[vpn-provisioning] starting account=${serverAccountId} protocol=${account.protocol} username=${account.username} server=${account.server.hostname}`
    )
    await this.logEvent(serverAccountId, "PROVISIONING_STARTED", {
      serverAccountId,
      protocol: account.protocol,
      username: account.username,
    })

    const target = this.toSshTarget(account)

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
      console.info(
        `[vpn-provisioning] success account=${serverAccountId} protocol=${account.protocol}`
      )
      await this.logEvent(serverAccountId, "PROVISIONING_SUCCESS", {
        serverAccountId,
        protocol: account.protocol,
      })
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Provisioning failed"
      await this.prisma.vpnServerAccount.update({
        where: { id: serverAccountId },
        data: { provisioningStatus: "FAILED", failureReason: reason },
      })
      console.error(
        `[vpn-provisioning] failed account=${serverAccountId}: ${reason}`
      )
      await this.logEvent(serverAccountId, "PROVISIONING_FAILED", {
        serverAccountId,
        failureReason: reason,
      })
      throw error
    }
  }

  async removeRemoteAccount(serverAccountId: string): Promise<void> {
    const account = await this.findAccount(serverAccountId)
    const target = this.toSshTarget(account)

    if (account.protocol !== "OPENVPN") return

    await this.withStep(serverAccountId, "revoking_client", () =>
      this.openVpn.revokeClient(target, account.username)
    )
    await this.withStep(serverAccountId, "removing_certificate", () =>
      this.openVpn.removeClient(target, account.username)
    )
    await this.prisma.vpnServerAccount.update({
      where: { id: serverAccountId },
      data: {
        provisioningStatus: "REVOKED",
        configEncrypted: null,
        password: null,
      },
    })
    await this.logEvent(serverAccountId, "REMOTE_ACCOUNT_REMOVED", {
      serverAccountId,
      protocol: account.protocol,
      username: account.username,
    })
  }

  async validateAccount(
    serverAccountId: string
  ): Promise<VpnAccountValidationResult> {
    const account = await this.findAccount(serverAccountId)
    const target = this.toSshTarget(account)
    const result = await this.validateProtocol(
      account.protocol,
      target,
      account.username
    )

    await this.logEvent(
      serverAccountId,
      result.exists ? "REMOTE_ACCOUNT_VALIDATED" : "REMOTE_ACCOUNT_MISSING",
      {
        serverAccountId,
        protocol: account.protocol,
        username: account.username,
        message: result.message,
      }
    )

    return {
      exists: result.exists,
      status: result.exists ? "FOUND" : "MISSING",
      message: result.message,
    }
  }

  private async findAccount(serverAccountId: string) {
    const account = await this.prisma.vpnServerAccount.findUnique({
      where: { id: serverAccountId },
      ...accountWithServer,
    })
    if (!account) throw new VpnServerAccountNotFoundError()
    return account
  }

  private toSshTarget(account: AccountWithServer): SshTarget {
    return {
      host: account.server.hostname,
      ipAddress: account.server.ipAddress ?? undefined,
      user: account.server.sshUser,
      encryptedPrivateKey: account.server.sshKey.privateKey,
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

  private async validateProtocol(
    protocol: VpnProtocol,
    target: SshTarget,
    username: string
  ): Promise<{ exists: boolean; message: string }> {
    switch (protocol) {
      case "OPENVPN":
        return this.openVpn.validateClient(target, username)
      case "WIREGUARD":
        return this.wireGuard.validatePeer(target, username)
      case "PROXY":
        return this.proxy.validateUser(target, username)
      default: {
        const exhaustive: never = protocol
        throw new Error(`Unsupported protocol: ${String(exhaustive)}`)
      }
    }
  }

  /** Write a provisioning event via the injected prisma instance. */
  private async logEvent(
    serverAccountId: string,
    action: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.vpnAuditLog.create({
      data: {
        action,
        details: (details ?? { serverAccountId }) as Prisma.InputJsonValue,
      },
    })
  }

  /** Write a step log entry via the injected prisma instance. */
  private async logStep(
    serverAccountId: string,
    step: string,
    status: "STARTED" | "OK" | "FAILED",
    message?: string,
  ): Promise<void> {
    await this.prisma.vpnAuditLog.create({
      data: {
        action: "PROVISIONING_STEP",
        details: {
          serverAccountId,
          step,
          status,
          ...(message ? { message } : {}),
        } as Prisma.InputJsonValue,
      },
    })
  }

  private async withStep<T>(
    serverAccountId: string,
    step: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    await this.logStep(serverAccountId, step, "STARTED")
    console.info(`[vpn-provisioning] step=${step} account=${serverAccountId} started`)

    try {
      const result = await fn()
      await this.logStep(serverAccountId, step, "OK")
      console.info(`[vpn-provisioning] step=${step} account=${serverAccountId} ok`)
      return result
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error"
      await this.logStep(serverAccountId, step, "FAILED", message)
      console.error(
        `[vpn-provisioning] step=${step} account=${serverAccountId} failed: ${message}`
      )
      throw error
    }
  }
}

export const vpnProvisioningService = new VpnProvisioningService()
