import { Prisma, type PrismaClient, type VpnProtocol } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"
import { logAuditEvent } from "@/lib/audit.service"
import {
  encryptVpnConfig,
  encryptProxyPassword,
} from "@/modules/vpn/vpn-crypto"
import { OpenVpnSshAdapter } from "@/modules/vpn/openvpn/openvpn-ssh-adapter"

import { WireGuardSshAdapter } from "./wireguard-ssh-adapter"
import { ProxySshAdapter } from "./proxy-ssh-adapter"
import type { SshTarget } from "./vpn-server-ssh-executor"

type PrismaLike = Pick<PrismaClient, "vpnServerAccount" | "vpnServer">

const accountWithServer = {
  include: {
    server: {
      include: { sshKey: { select: { privateKey: true } } },
    },
    subscription: {
      select: { organizationId: true },
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
    await logAuditEvent({
      serverAccountId,
      serverId: account.serverId,
      subscriptionId: account.subscriptionId,
      organizationId: account.subscription.organizationId,
      action: "PROVISIONING_STARTED",
      status: "STARTED",
      message: `Provisioning ${account.protocol} account "${account.username}" on ${account.server.hostname}`,
      details: { protocol: account.protocol, username: account.username },
    })

    const target = this.toSshTarget(account)

    try {
      const data = await this.runProtocol(
        account,
        target,
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
      await logAuditEvent({
        serverAccountId,
        serverId: account.serverId,
        subscriptionId: account.subscriptionId,
        organizationId: account.subscription.organizationId,
        action: "PROVISIONING_SUCCESS",
        status: "OK",
        message: `Provisioning ${account.protocol} account "${account.username}" succeeded on ${account.server.hostname}`,
        details: { protocol: account.protocol },
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
      await logAuditEvent({
        serverAccountId,
        serverId: account.serverId,
        subscriptionId: account.subscriptionId,
        organizationId: account.subscription.organizationId,
        action: "PROVISIONING_FAILED",
        status: "FAILED",
        message: `Provisioning account failed: ${reason}`,
        errorMessage: reason,
        details: { protocol: account.protocol },
      }).catch(() => {})
      throw error
    }
  }

  async removeRemoteAccount(serverAccountId: string): Promise<void> {
    const account = await this.findAccount(serverAccountId)
    const target = this.toSshTarget(account)

    // ponytail: WireGuard/Proxy cleanup not yet implemented — add
    // removePeer/removeUser adapters when those protocols need remote
    // cleanup on subscription expiry.
    if (account.protocol !== "OPENVPN") return

    await this.withStep(serverAccountId, account, "revoking_client", () =>
      this.openVpn.revokeClient(target, account.username)
    )
    await this.withStep(serverAccountId, account, "removing_certificate", () =>
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
    await logAuditEvent({
      serverAccountId,
      serverId: account.serverId,
      subscriptionId: account.subscriptionId,
      organizationId: account.subscription.organizationId,
      action: "REMOTE_ACCOUNT_REMOVED",
      status: "OK",
      message: `Remote ${account.protocol} account "${account.username}" removed from ${account.server.hostname}`,
      details: { protocol: account.protocol, username: account.username },
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

    await logAuditEvent({
      serverAccountId,
      serverId: account.serverId,
      subscriptionId: account.subscriptionId,
      organizationId: account.subscription.organizationId,
      action: result.exists ? "REMOTE_ACCOUNT_VALIDATED" : "REMOTE_ACCOUNT_MISSING",
      status: result.exists ? "OK" : "FAILED",
      message: result.exists
        ? `Remote account "${account.username}" exists on ${account.server.hostname}`
        : `Remote account "${account.username}" missing on ${account.server.hostname}: ${result.message}`,
      errorMessage: result.exists ? null : result.message,
      details: { protocol: account.protocol, username: account.username },
    })

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
    account: AccountWithServer,
    target: SshTarget,
    serverAccountId: string,
  ): Promise<Prisma.VpnServerAccountUpdateInput> {
    switch (account.protocol) {
      case "OPENVPN": {
        await this.withStep(serverAccountId, account, "creating_client", () =>
          this.openVpn.createClient(target, account.username),
        )
        const config = await this.withStep(serverAccountId, account, "fetching_config", () =>
          this.openVpn.fetchConfig(target, account.username),
        )
        const encrypted = encryptVpnConfig(config)
        return { configEncrypted: encrypted }
      }
      case "WIREGUARD": {
        const { config } = await this.withStep(serverAccountId, account, "creating_peer", () =>
          this.wireGuard.createPeer(target, account.username),
        )
        return { configEncrypted: encryptVpnConfig(config) }
      }
      case "PROXY": {
        const { password } = await this.withStep(serverAccountId, account, "creating_user", () =>
          this.proxy.createUser(target, account.username),
        )
        return { password: encryptProxyPassword(password) }
      }
      default: {
        const exhaustive: never = account.protocol
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

  /** Write a step log entry via the unified audit service. */
  private async withStep<T>(
    serverAccountId: string,
    account: AccountWithServer,
    step: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const start = performance.now()

    await logAuditEvent({
      serverAccountId,
      serverId: account.serverId,
      subscriptionId: account.subscriptionId,
      organizationId: account.subscription.organizationId,
      action: "PROVISIONING_STEP",
      status: "STARTED",
      step,
      message: `Step "${step}" started for account ${serverAccountId}`,
    })
    console.info(`[vpn-provisioning] step=${step} account=${serverAccountId} started`)

    try {
      const result = await fn()
      const durationMs = Math.round(performance.now() - start)
      await logAuditEvent({
        serverAccountId,
        serverId: account.serverId,
        subscriptionId: account.subscriptionId,
        organizationId: account.subscription.organizationId,
        action: "PROVISIONING_STEP",
        status: "OK",
        step,
        message: `Step "${step}" completed for account ${serverAccountId}`,
        durationMs,
      })
      console.info(`[vpn-provisioning] step=${step} account=${serverAccountId} ok`)
      return result
    } catch (error) {
      const durationMs = Math.round(performance.now() - start)
      const message =
        error instanceof Error ? error.message : "Unknown error"
      await logAuditEvent({
        serverAccountId,
        serverId: account.serverId,
        subscriptionId: account.subscriptionId,
        organizationId: account.subscription.organizationId,
        action: "PROVISIONING_STEP",
        status: "FAILED",
        step,
        message: `Step "${step}" failed for account ${serverAccountId}: ${message}`,
        errorMessage: message,
        durationMs,
      })
      console.error(
        `[vpn-provisioning] step=${step} account=${serverAccountId} failed: ${message}`
      )
      throw error
    }
  }
}

export const vpnProvisioningService = new VpnProvisioningService()
