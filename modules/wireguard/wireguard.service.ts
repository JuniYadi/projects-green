import type { PrismaClient, Prisma } from "@prisma/client"
import QRCode from "qrcode"

import { WireGuardSshAdapter } from "./wireguard-ssh-adapter"
import type { SshTarget, WgPeer, CreatePeerResult } from "./wireguard.types"
import { encryptVpnConfig, decryptVpnConfig } from "@/modules/vpn/vpn-crypto"

export class WireGuardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly adapter: WireGuardSshAdapter = new WireGuardSshAdapter()
  ) {}

  async resolveServer(): Promise<{ target: SshTarget; server: Prisma.VpnServerGetPayload<{ include: { sshKey: { select: { privateKey: true } } } }> }> {
    const server = await this.prisma.vpnServer.findFirst({
      where: { hasWireGuard: true, isActive: true },
      include: { sshKey: { select: { privateKey: true } } },
    })
    if (!server) throw new Error("No active WireGuard server found")

    return {
      target: {
        host: server.hostname,
        ipAddress: server.ipAddress ?? undefined,
        user: server.sshUser,
        encryptedPrivateKey: server.sshKey.privateKey,
      },
      server,
    }
  }

  async listPeers(): Promise<WgPeer[]> {
    const { target } = await this.resolveServer()

    // ponytail: fetches all peers fresh each time; no caching, add if dashboard latency > 2s
    const wgPeers = await this.adapter.listPeers(target)

    // Enrich with usernames from DB
    const clients = await this.prisma.vpnClient.findMany({
      where: { provider: "WIREGUARD", encryptedConfig: { not: null } },
      select: { clientName: true, metadataJson: true },
    })

    const ipToUsername = new Map<string, string>()
    for (const c of clients) {
      const meta = c.metadataJson as { ip?: string } | null
      if (meta?.ip) ipToUsername.set(meta.ip, c.clientName)
    }

    return wgPeers.map((peer) => {
      const username = ipToUsername.get(peer.ip) || peer.username
      return { ...peer, username }
    })
  }

  async createPeer(username: string): Promise<CreatePeerResult> {
    const { target } = await this.resolveServer()

    // Check duplicate
    const existing = await this.prisma.vpnClient.findUnique({
      where: { provider_clientName: { provider: "WIREGUARD", clientName: username } },
    })
    if (existing) {
      const err = new Error("WireGuard peer already exists") as Error & { statusCode: number }
      err.statusCode = 409
      throw err
    }

    const { config } = await this.adapter.createPeer(target, username)

    // Extract IP from config
    const ipMatch = config.match(/Address\s*=\s*([^\s]+)/)
    const ip = ipMatch?.[1] ?? ""

    // Generate QR
    const qrBase64 = await QRCode.toDataURL(config, { type: "image/png", width: 400 })

    // Store in VpnClient
    const encryptedConfig = encryptVpnConfig(config)
    await this.prisma.vpnClient.create({
      data: {
        organizationId: "", // ponytail: requires multi-tenant context; set by caller
        subscriptionId: "",
        provider: "WIREGUARD",
        clientName: username,
        encryptedConfig,
        metadataJson: { ip },
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    })

    return { username, ip, config, qrBase64 }
  }

  async removePeer(username: string): Promise<void> {
    const { target } = await this.resolveServer()
    await this.adapter.removePeer(target, username)

    await this.prisma.vpnClient.updateMany({
      where: { provider: "WIREGUARD", clientName: username },
      data: { status: "REVOKED", revokedAt: new Date() },
    })
  }

  async getConfig(username: string): Promise<string> {
    const client = await this.prisma.vpnClient.findUnique({
      where: { provider_clientName: { provider: "WIREGUARD", clientName: username } },
    })
    if (client?.encryptedConfig) {
      return decryptVpnConfig(client.encryptedConfig)
    }

    // Fallback: fetch from server
    const { target } = await this.resolveServer()
    return this.adapter.fetchConfig(target, username)
  }

  async getQr(username: string): Promise<string> {
    const config = await this.getConfig(username)
    return QRCode.toDataURL(config, { type: "image/png", width: 400 })
  }
}
