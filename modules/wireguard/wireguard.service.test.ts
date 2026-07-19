/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, describe, it, beforeEach, mock } from "bun:test"

// ── Mocks (leaf dependencies only) ──────────────────────────────────────

const mockAdapter = {
  listPeers: mock<(...args: any[]) => Promise<any[]>>(() =>
    Promise.resolve([])
  ),
  createPeer: mock<(...args: any[]) => Promise<any>>(() =>
    Promise.resolve({
      config: "[Interface]\nAddress = 10.0.0.2/32\nPrivateKey = test",
    })
  ),
  removePeer: mock<(...args: any[]) => Promise<void>>(() => Promise.resolve()),
  fetchConfig: mock<(...args: any[]) => Promise<string>>(() =>
    Promise.resolve("[Interface]\nPrivateKey = fresh")
  ),
}

mock.module("./wireguard-ssh-adapter", () => ({
  WireGuardSshAdapter: class {
    listPeers = mockAdapter.listPeers
    createPeer = mockAdapter.createPeer
    removePeer = mockAdapter.removePeer
    fetchConfig = mockAdapter.fetchConfig
  },
}))

const mockQrToDataURL = mock<(...args: any[]) => Promise<string>>(() =>
  Promise.resolve("data:image/png;base64,qrcode")
)

mock.module("qrcode", () => ({
  default: { toDataURL: mockQrToDataURL },
  toDataURL: mockQrToDataURL,
}))

const mockEncryptVpnConfig = mock<(config: string) => string>(
  (c: string) => `enc:${c}`
)
const mockDecryptVpnConfig = mock<(config: string) => string>((c: string) =>
  c.startsWith("enc:") ? c.slice(4) : c
)

mock.module("@/modules/vpn/vpn-crypto", () => ({
  encryptVpnConfig: mockEncryptVpnConfig,
  decryptVpnConfig: mockDecryptVpnConfig,
}))

// ── Imports ──────────────────────────────────────────────────────────────

const { WireGuardService } = await import("./wireguard.service")

// ── Fixtures ─────────────────────────────────────────────────────────────

function makePrisma(): Record<string, Record<string, ReturnType<typeof mock>>> {
  const findFirst = mock<(args?: any) => any>()
  const findMany = mock<(args?: any) => any>()
  const findUnique = mock<(args?: any) => any>()
  const create = mock<(args?: any) => any>()
  const updateMany = mock<(args?: any) => any>()

  const prisma = {
    vpnServer: { findFirst },
    vpnClient: { findMany, findUnique, create, updateMany },
  }

  return prisma as unknown as Record<
    string,
    Record<string, ReturnType<typeof mock>>
  >
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("WireGuardService", () => {
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    mockAdapter.listPeers.mockReset()
    mockAdapter.createPeer.mockReset()
    mockAdapter.removePeer.mockReset()
    mockAdapter.fetchConfig.mockReset()
    mockQrToDataURL.mockReset()
    mockEncryptVpnConfig.mockClear()
    mockDecryptVpnConfig.mockClear()
    prisma = makePrisma()

    // Restore default implementations after reset
    mockAdapter.createPeer.mockImplementation(() =>
      Promise.resolve({
        config: "[Interface]\nAddress = 10.0.0.2/32\nPrivateKey = test",
      })
    )
    mockQrToDataURL.mockImplementation(() =>
      Promise.resolve("data:image/png;base64,qrcode")
    )
  })

  describe("resolveServer", () => {
    it("resolves an active WireGuard server from DB", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue({
        id: "srv-1",
        hostname: "wg.example.com",
        ipAddress: "10.0.0.1",
        hasWireGuard: true,
        isActive: true,
        sshUser: "root",
        sshKey: { privateKey: "enc:ssh-key-xyz" },
      })

      const service = new WireGuardService(prisma as any)
      const result = await service.resolveServer()

      expect(result.target.host).toBe("wg.example.com")
      expect(result.target.user).toBe("root")
      expect(result.server.id).toBe("srv-1")
    })

    it("throws when no active WireGuard server found", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue(null)

      const service = new WireGuardService(prisma as any)

      expect(service.resolveServer()).rejects.toThrow(
        "No active WireGuard server found"
      )
    })
  })

  describe("listPeers", () => {
    it("returns enriched peers from adapter + DB", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue({
        id: "srv-1",
        hostname: "wg.example.com",
        ipAddress: "10.0.0.1",
        hasWireGuard: true,
        isActive: true,
        sshUser: "root",
        sshKey: { privateKey: "enc:key" },
      })

      mockAdapter.listPeers.mockResolvedValue([
        {
          username: "peer1",
          ip: "10.0.0.2",
          status: "online",
          handshake: "30s",
          rx: 1024,
          tx: 2048,
          endpoint: "203.0.113.1:51820",
        },
      ])

      prisma.vpnClient.findMany.mockResolvedValue([
        {
          clientName: "peer1",
          metadataJson: { ip: "10.0.0.2" },
        },
      ])

      const service = new WireGuardService(prisma as any)
      const peers = await service.listPeers()

      expect(peers).toHaveLength(1)
      expect(peers[0].username).toBe("peer1")
      expect(peers[0].ip).toBe("10.0.0.2")
      expect(peers[0].status).toBe("online")
    })

    it("falls back to adapter username when IP not found in DB", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue({
        id: "srv-1",
        hostname: "wg.example.com",
        ipAddress: "10.0.0.1",
        hasWireGuard: true,
        isActive: true,
        sshUser: "root",
        sshKey: { privateKey: "enc:key" },
      })

      mockAdapter.listPeers.mockResolvedValue([
        {
          username: "wg-peer-abc",
          ip: "10.0.0.3",
          status: "offline",
          handshake: null,
          rx: 0,
          tx: 0,
          endpoint: null,
        },
      ])

      prisma.vpnClient.findMany.mockResolvedValue([])

      const service = new WireGuardService(prisma as any)
      const peers = await service.listPeers()

      expect(peers[0].username).toBe("wg-peer-abc")
    })
  })

  describe("createPeer", () => {
    it("creates peer and returns result with IP, config, QR", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue({
        id: "srv-1",
        hostname: "wg.example.com",
        ipAddress: "10.0.0.1",
        hasWireGuard: true,
        isActive: true,
        sshUser: "root",
        sshKey: { privateKey: "enc:key" },
      })
      prisma.vpnClient.findUnique.mockResolvedValue(null)
      prisma.vpnClient.create.mockResolvedValue({ id: "client-1" })

      const service = new WireGuardService(prisma as any)
      const result = await service.createPeer("new-peer", "org-123")

      expect(result.username).toBe("new-peer")
      expect(result.ip).toBe("10.0.0.2/32")
      expect(result.config).toContain("[Interface]")
      expect(result.qrBase64).toContain("data:image/png")
      expect(mockEncryptVpnConfig).toHaveBeenCalled()
    })

    it("throws 409 when peer already exists", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue({
        id: "srv-1",
        hostname: "wg.example.com",
        ipAddress: "10.0.0.1",
        hasWireGuard: true,
        isActive: true,
        sshUser: "root",
        sshKey: { privateKey: "enc:key" },
      })
      prisma.vpnClient.findUnique.mockResolvedValue({ id: "existing-peer" })

      const service = new WireGuardService(prisma as any)

      expect(service.createPeer("dup-peer", "org-123")).rejects.toThrow(
        "WireGuard peer already exists"
      )
    })
  })

  describe("removePeer", () => {
    it("removes peer from adapter and marks revoked in DB", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue({
        id: "srv-1",
        hostname: "wg.example.com",
        ipAddress: "10.0.0.1",
        hasWireGuard: true,
        isActive: true,
        sshUser: "root",
        sshKey: { privateKey: "enc:key" },
      })

      const service = new WireGuardService(prisma as any)
      await service.removePeer("to-remove")

      expect(mockAdapter.removePeer).toHaveBeenCalled()
      expect(prisma.vpnClient.updateMany).toHaveBeenCalled()
    })
  })

  describe("getConfig", () => {
    it("reads from DB when encrypted config exists", async () => {
      prisma.vpnClient.findUnique.mockResolvedValue({
        encryptedConfig: "enc:[Interface]\nPrivateKey = cached",
      })

      const service = new WireGuardService(prisma as any)

      const config = await service.getConfig("cached-peer")

      expect(config).toContain("[Interface]")
      expect(config).toContain("cached")
    })

    it("falls back to adapter fetch when no DB config", async () => {
      prisma.vpnServer.findFirst.mockResolvedValue({
        id: "srv-1",
        hostname: "wg.example.com",
        ipAddress: "10.0.0.1",
        hasWireGuard: true,
        isActive: true,
        sshUser: "root",
        sshKey: { privateKey: "enc:key" },
      })
      prisma.vpnClient.findUnique.mockResolvedValue(null)

      mockAdapter.fetchConfig.mockResolvedValue(
        "[Interface]\nPrivateKey = server-fetched"
      )

      const service = new WireGuardService(prisma as any)

      const config = await service.getConfig("fresh-peer")

      expect(config).toContain("[Interface]")
      expect(mockAdapter.fetchConfig).toHaveBeenCalled()
    })
  })

  describe("getQr", () => {
    it("generates QR code from config", async () => {
      prisma.vpnClient.findUnique.mockResolvedValue({
        encryptedConfig: "enc:[Interface]\nPrivateKey = x",
      })

      const service = new WireGuardService(prisma as any)

      const qr = await service.getQr("qr-peer")

      expect(qr).toContain("data:image/png")
    })
  })
})
