import { describe, expect, it, mock, beforeAll } from "bun:test"
import type { WgPeer } from "./wireguard.types"

// ─── Mock SSH adapter ────────────────────────────────────────────────────

const mockCreatePeer = mock<(target: unknown, username: string) => Promise<{ config: string }>>()
const mockListPeers = mock<(target: unknown) => Promise<WgPeer[]>>()
const mockRemovePeer = mock<(target: unknown, username: string) => Promise<void>>()
const mockFetchConfig = mock<(target: unknown, username: string) => Promise<string>>()

const mockWireGuardSshAdapter = {
  listPeers: mockListPeers,
  createPeer: mockCreatePeer,
  removePeer: mockRemovePeer,
  fetchConfig: mockFetchConfig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validatePeer: (_target: unknown, _username: string): Promise<boolean> => Promise.resolve(false),
}

// ─── Mock Prisma ─────────────────────────────────────────────────────────

const mockPrisma = {
  vpnServer: { findFirst: mock<(args: unknown) => Promise<unknown>>() },
  vpnClient: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: mock<(args: any) => Promise<any>>(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: mock<(args: any) => Promise<any[]>>(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock<(args: any) => Promise<any>>(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateMany: mock<(args: any) => Promise<any>>(),
  },
} as const

const SAMPLE_CONFIG = `[Interface]
PrivateKey = gNfFakePrivateKeyABC123
Address = 10.0.0.2/32
DNS = 1.1.1.1

[Peer]
PublicKey = ServerPublicKeyABC123
Endpoint = 64.120.95.199:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`

const MOCK_SERVER = {
  id: "server-1",
  hostname: "wg.example.com",
  ipAddress: "64.120.95.199",
  sshPort: 22,
  sshUser: "root",
  wireGuardPort: 51820,
  wireGuardPublicKey: "serverPubKey123",
  wireGuardSubnet: "10.0.0.1/24",
  hasWireGuard: true,
  isActive: true,
  sshKey: { privateKey: "mock-encrypted-key" },
}

beforeAll(() => {
  for (const value of Object.values(mockPrisma)) {
    for (const m of Object.values(value)) {
      m.mockReset()
    }
  }
  mockCreatePeer.mockReset()
  mockListPeers.mockReset()
  mockRemovePeer.mockReset()
  mockFetchConfig.mockReset()
})

describe("WireGuardService", () => {
  it("creates new peer and returns config", async () => {
    const { WireGuardService } = await import("./wireguard.service")
    const { encryptVpnConfig } = await import("@/modules/vpn/vpn-crypto")

    mockPrisma.vpnServer.findFirst.mockResolvedValue(MOCK_SERVER)
    mockPrisma.vpnClient.findUnique.mockResolvedValue(null)
    mockCreatePeer.mockResolvedValue({ config: SAMPLE_CONFIG })

    const encryptedConfig = encryptVpnConfig(SAMPLE_CONFIG)
    mockPrisma.vpnClient.create.mockResolvedValue({
      id: "client-1",
      clientName: "test-peer",
      provider: "WIREGUARD",
      encryptedConfig,
      metadataJson: { ip: "10.0.0.2" },
      status: "ACTIVE",
      organizationId: "",
      subscriptionId: "",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      regionCode: "INDONESIA",
      createdBy: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const service = new WireGuardService(mockPrisma as never, mockWireGuardSshAdapter as never)
    const result = await service.createPeer("test-peer")

    expect(result.username).toBe("test-peer")
    expect(result.ip).toBe("10.0.0.2/32")
    expect(result.config).toContain("[Interface]")
    expect(result.qrBase64).toContain("data:image/png;base64,")
  })

  it("rejects duplicate username", async () => {
    const { WireGuardService } = await import("./wireguard.service")

    mockPrisma.vpnServer.findFirst.mockResolvedValue(MOCK_SERVER)
    mockPrisma.vpnClient.findUnique.mockResolvedValue({ id: "existing", clientName: "dup-peer" })

    const service = new WireGuardService(mockPrisma as never, mockWireGuardSshAdapter as never)
    await expect(service.createPeer("dup-peer")).rejects.toThrow("already exists")
  })

  it("lists peers from wg dump", async () => {
    const { WireGuardService } = await import("./wireguard.service")

    mockPrisma.vpnServer.findFirst.mockResolvedValue(MOCK_SERVER)
    mockListPeers.mockResolvedValue([
      { username: "peer1", ip: "10.0.0.2", status: "offline", handshake: null, rx: 0, tx: 0, endpoint: null },
      { username: "peer2", ip: "10.0.0.3", status: "online", handshake: "2026-06-22T12:00:00.000Z", rx: 1024000, tx: 2048000, endpoint: "10.0.0.2:51820" },
    ])
    mockPrisma.vpnClient.findMany.mockResolvedValue([])

    const service = new WireGuardService(mockPrisma as never, mockWireGuardSshAdapter as never)
    const peers = await service.listPeers()

    expect(peers).toHaveLength(2)
    expect(peers[0].status).toBe("offline")
    expect(peers[1].status).toBe("online")
    expect(peers[1].rx).toBe(1024000)
    expect(peers[1].tx).toBe(2048000)
  })
})
