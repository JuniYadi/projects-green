import { describe, expect, it, mock, beforeAll } from "bun:test"
import type { ElysiaApp } from "@/lib/api"
import type { SshTarget } from "@/modules/vpn/provisioning/vpn-server-ssh-executor"

// WireGuard server mock target
const MOCK_TARGET: SshTarget = {
  host: "wg.example.com",
  user: "root",
  encryptedPrivateKey: "mock-encrypted-key",
}

// ─── Mock SSH adapter ────────────────────────────────────────────────────

const mockCreatePeer = mock<(target: SshTarget, username: string) => Promise<{ config: string }>>()
const mockListPeers = mock<(target: SshTarget) => Promise<any[]>>()
const mockRemovePeer = mock<(target: SshTarget, username: string) => Promise<void>>()
const mockFetchConfig = mock<(target: SshTarget, username: string) => Promise<string>>()

const mockWireGuardSshAdapter = {
  listPeers: mockListPeers,
  createPeer: mockCreatePeer,
  removePeer: mockRemovePeer,
  fetchConfig: mockFetchConfig,
  validatePeer: mock<(target: SshTarget, username: string) => Promise<boolean>>(),
}

// ─── Mock Prisma ─────────────────────────────────────────────────────────

const mockVpnClientFindUnique = mock<(args: any) => Promise<any>>()
const mockVpnClientFindMany = mock<(args: any) => Promise<any[]>>()
const mockVpnClientCreate = mock<(args: any) => Promise<any>>()
const mockVpnClientUpdateMany = mock<(args: any) => Promise<any>>()
const mockVpnServerFindFirst = mock<(args: any) => Promise<any>>()

const SAMPLE_CONFIG = `[Interface]
PrivateKey = gNfFakePrivateKeyABC123
Address = 10.0.0.2/32
DNS = 1.1.1.1

[Peer]
PublicKey = ServerPublicKeyABC123
Endpoint = 64.120.95.199:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`

const SAMPLE_WG_DUMP = `serverPubKey\tnull\tnull\tnull\toff\tnull\tnull\tnull
peerPubKey1\tnull\t10.0.0.1:51820\t10.0.0.2/32,fc00::1/128\t0\t0\t0\toff
peerPubKey2\tnull\t10.0.0.2:51820\t10.0.0.3/32\t1234567890\t1024000\t2048000\toff`

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
  // Reset all mocks
  mockVpnServerFindFirst.mockReset()
  mockVpnClientFindUnique.mockReset()
  mockVpnClientFindMany.mockReset()
  mockVpnClientCreate.mockReset()
  mockVpnClientUpdateMany.mockReset()
  mockCreatePeer.mockReset()
  mockListPeers.mockReset()
  mockRemovePeer.mockReset()
  mockFetchConfig.mockReset()
})

// We skip the full Elysia app test and test the service logic directly.
// ponytail: testing via service layer is faster and doesn't need app bootstrap.

describe("WireGuardService", () => {
  it("creates new peer and returns config", async () => {
    const { WireGuardService } = await import("./wireguard.service")
    const { encryptVpnConfig } = await import("@/modules/vpn/vpn-crypto")

    mockVpnServerFindFirst.mockResolvedValue(MOCK_SERVER)
    mockVpnClientFindUnique.mockResolvedValue(null) // no duplicate
    mockCreatePeer.mockResolvedValue({ config: SAMPLE_CONFIG })

    const encryptedConfig = encryptVpnConfig(SAMPLE_CONFIG)
    const createdClient = {
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
    }
    mockVpnClientCreate.mockResolvedValue(createdClient)

    const service = new WireGuardService(
      { vpnServer: { findFirst: mockVpnServerFindFirst },
        vpnClient: { findUnique: mockVpnClientFindUnique, findMany: mockVpnClientFindMany, create: mockVpnClientCreate, updateMany: mockVpnClientUpdateMany } } as any,
      mockWireGuardSshAdapter as any
    )

    const result = await service.createPeer("test-peer")

    expect(result.username).toBe("test-peer")
    expect(result.ip).toBe("10.0.0.2/32")
    expect(result.config).toContain("[Interface]")
    expect(result.qrBase64).toContain("data:image/png;base64,")
  })

  it("rejects duplicate username", async () => {
    const { WireGuardService } = await import("./wireguard.service")

    mockVpnServerFindFirst.mockResolvedValue(MOCK_SERVER)
    mockVpnClientFindUnique.mockResolvedValue({ id: "existing", clientName: "dup-peer" })

    const service = new WireGuardService(
      { vpnServer: { findFirst: mockVpnServerFindFirst },
        vpnClient: { findUnique: mockVpnClientFindUnique, findMany: mockVpnClientFindMany, create: mockVpnClientCreate, updateMany: mockVpnClientUpdateMany } } as any,
      mockWireGuardSshAdapter as any
    )

    await expect(service.createPeer("dup-peer")).rejects.toThrow("already exists")
  })

  it("lists peers from wg dump", async () => {
    const { WireGuardService } = await import("./wireguard.service")

    mockVpnServerFindFirst.mockResolvedValue(MOCK_SERVER)
    mockListPeers.mockResolvedValue([
      { username: "peer1", ip: "10.0.0.2", status: "offline", handshake: null, rx: 0, tx: 0, endpoint: null },
      { username: "peer2", ip: "10.0.0.3", status: "online", handshake: "2026-06-22T12:00:00.000Z", rx: 1024000, tx: 2048000, endpoint: "10.0.0.2:51820" },
    ])
    mockVpnClientFindMany.mockResolvedValue([])

    const service = new WireGuardService(
      { vpnServer: { findFirst: mockVpnServerFindFirst },
        vpnClient: { findUnique: mockVpnClientFindUnique, findMany: mockVpnClientFindMany, create: mockVpnClientCreate, updateMany: mockVpnClientUpdateMany } } as any,
      mockWireGuardSshAdapter as any
    )

    const peers = await service.listPeers()
    expect(peers).toHaveLength(2)
    expect(peers[0].status).toBe("offline")
    expect(peers[1].status).toBe("online")
    expect(peers[1].rx).toBe(1024000)
    expect(peers[1].tx).toBe(2048000)
  })
})
