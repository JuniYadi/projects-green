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

describe("wireguard.route", () => {
  let app: { handle: (request: Request) => Promise<Response> }
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
    app = new Elysia().use(wireguardRoutes)
  })

  describe("GET /portal/vpn/wireguard/peers", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthContext.current = {}
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers")
      )
      expect(res.status).toBe(401)
    })

    it("returns 403 when organization is missing", async () => {
      mockAuthContext.current = { user: { id: "user-1" }, organizationId: null }
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers")
      )
      expect(res.status).toBe(403)
    })

    it("returns 403 when user is not admin", async () => {
      mockAuthContext.current = {
        user: { id: "user-1" },
        organizationId: "org-1",
        role: "member",
        roles: ["member"],
      }
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers")
      )
      expect(res.status).toBe(403)
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

    it("returns 503 when listPeers fails", async () => {
      mockListPeers.mockRejectedValueOnce(new Error("Server offline"))
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers")
      )
      expect(res.status).toBe(503)
      const data = await res.json()
      expect(data.error).toBe("SSH_CONNECTION_FAILED")
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

    it("returns 503 when createPeer throws", async () => {
      mockCreatePeer.mockRejectedValueOnce(new Error("Creation failed"))
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "charlie" }),
        })
      )
      expect(res.status).toBe(503)
      const data = await res.json()
      expect(data.error).toBe("SSH_CONNECTION_FAILED")
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

    it("returns 503 when removePeer throws", async () => {
      mockRemovePeer.mockRejectedValueOnce(new Error("Removal failed"))
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers/bob", {
          method: "DELETE",
        })
      )
      expect(res.status).toBe(503)
      const data = await res.json()
      expect(data.error).toBe("SSH_CONNECTION_FAILED")
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

    it("returns 503 when getConfig throws", async () => {
      mockGetConfig.mockRejectedValueOnce(new Error("Read failed"))
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers/alice/config")
      )
      expect(res.status).toBe(503)
      const data = await res.json()
      expect(data.error).toBe("CONFIG_FETCH_FAILED")
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

    it("returns 500 when QR data URL format is invalid", async () => {
      mockGetQr.mockResolvedValueOnce("invalid-data-url-no-comma")
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers/alice/qr")
      )
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe("QR_GENERATION_FAILED")
    })

    it("returns 503 when getQr throws", async () => {
      mockGetQr.mockRejectedValueOnce(new Error("QR generation failed"))
      const res = await app.handle(
        new Request("http://localhost/portal/vpn/wireguard/peers/alice/qr")
      )
      expect(res.status).toBe(503)
      const data = await res.json()
      expect(data.error).toBe("QR_GENERATION_FAILED")
    })
  })
})
