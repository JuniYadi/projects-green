import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockAuthContext = {
  current: {
    user: { id: "user-1" },
    organizationId: "org-1",
    role: "admin",
    roles: ["admin"],
  } as unknown,
}

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: async () => mockAuthContext.current,
}))

const mockListPeers = mock(() => Promise.resolve([]))
const mockCreatePeer = mock(() => Promise.resolve({}))
const mockRemovePeer = mock(() => Promise.resolve())
const mockGetConfig = mock(() => Promise.resolve("[Interface]\nPrivateKey=xyz"))
const mockGetQr = mock(() =>
  Promise.resolve(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  )
)

mock.module("../wireguard.service", () => ({
  WireGuardService: class {
    listPeers = mockListPeers
    createPeer = mockCreatePeer
    removePeer = mockRemovePeer
    getConfig = mockGetConfig
    getQr = mockGetQr
  },
}))

mock.module("../wireguard-ssh-adapter", () => ({
  WireGuardSshAdapter: class {},
}))

const { wireguardRoutes } = await import("./wireguard.route")

function createTestApp() {
  return new Elysia().use(wireguardRoutes)
}

describe("wireguard.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = {
      user: { id: "user-1" },
      organizationId: "org-1",
      role: "admin",
      roles: ["admin"],
    }
    mockListPeers.mockClear()
    mockCreatePeer.mockClear()
    mockRemovePeer.mockClear()
    mockGetConfig.mockClear()
    mockGetQr.mockClear()
    app = createTestApp()
  })

  describe("GET /portal/vpn/wireguard/peers", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthContext.current = {}

      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers")
      )

      expect(res.status).toBe(401)
    })

    it("lists peers for authorized admin", async () => {
      mockListPeers.mockResolvedValueOnce([
        { id: "peer-1", username: "alice", ip: "10.0.0.2" },
      ] as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        peers: [{ id: "peer-1", username: "alice", ip: "10.0.0.2" }],
      })
    })
  })

  describe("POST /portal/vpn/wireguard/peers", () => {
    it("adds a new peer", async () => {
      mockCreatePeer.mockResolvedValueOnce({
        id: "peer-2",
        username: "bob",
        config: "[Interface]...",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "bob" }),
        })
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe("peer-2")
      expect(mockCreatePeer).toHaveBeenCalledWith("bob", "org-1")
    })
  })

  describe("DELETE /portal/vpn/wireguard/peers/:username", () => {
    it("revokes peer", async () => {
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers/bob", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true })
      expect(mockRemovePeer).toHaveBeenCalledWith("bob")
    })
  })

  describe("GET /portal/vpn/wireguard/peers/:username/config", () => {
    it("returns client wireguard config file as attachment", async () => {
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers/alice/config")
      )

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain("[Interface]")
    })
  })

  describe("GET /portal/vpn/wireguard/peers/:username/qr", () => {
    it("returns QR code image/png", async () => {
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers/alice/qr")
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toBe("image/png")
    })
  })
})
