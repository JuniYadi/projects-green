import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { PrismaClient } from "@prisma/client"

import { createAdminVpnServersRoutes } from "./vpn-servers.route"
import { VpnServerService } from "../vpn-server.service"

type PrismaLike = Pick<PrismaClient, "vpnServer" | "vpnRegion" | "vpnSshKey">

type AnyFn = (...args: unknown[]) => unknown

const makeServer = (over: Record<string, unknown> = {}) => ({
  id: "srv-1",
  name: "ID-01",
  regionId: "reg-1",
  hostname: "vpn-id-01.example.net",
  ipAddress: null,
  sshPort: 22,
  sshKeyId: "key-1",
  sshUser: "root",
  hasOpenVpn: true,
  openVpnPort: 1194,
  hasWireGuard: false,
  wireGuardPort: null,
  hasProxy: false,
  proxyPort: null,
  health: "UNKNOWN" as const,
  isActive: true,
  latitude: -6.2088,
  longitude: 106.8456,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  region: {
    id: "reg-1",
    name: "Indonesia",
    slug: "indonesia",
    countryCode: "id",
  },
  sshKey: { id: "key-1", name: "Prod Key", fingerprint: "SHA256:abc" },
  ...over,
})

const mockConsoleError = mock<(...args: unknown[]) => void>(() => {})

const mockPrisma = {
  vpnServer: {
    findMany: mock<AnyFn>(async () => []),
    findUnique: mock<AnyFn>(async () => makeServer()),
    create: mock<AnyFn>(async () => makeServer()),
    update: mock<AnyFn>(async () => makeServer()),
    delete: mock<AnyFn>(async () => makeServer()),
  },
  vpnRegion: {
    findUnique: mock<AnyFn>(async () => ({ id: "reg-1" })),
  },
  vpnSshKey: {
    findUnique: mock<AnyFn>(async () => ({ id: "key-1" })),
  },
} as unknown as PrismaLike
// Reason: test-only stand-in for the full Prisma client.

const service = new VpnServerService(mockPrisma)

const allowedGuard = async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
})

const forbiddenGuard = async (set: { status?: number | string }) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN",
    message: "Only super administrators can manage VPN servers.",
  }
}

function createApp(deps: { service?: VpnServerService } = {}) {
  return new Elysia().use(
    createAdminVpnServersRoutes({
      requireSuperAdmin: allowedGuard,
      service: deps.service ?? service,
    })
  )
}

describe("createAdminVpnServersRoutes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    console.error = mockConsoleError
  })

  describe("PUT /admin/vpn/servers/:id", () => {
    it("updates a server with latitude and longitude", async () => {
      const app = createApp().compile()

      const response = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "ID-01",
            regionId: "reg-1",
            hostname: "vpn-id-01.example.net",
            sshPort: 22,
            sshKeyId: "key-1",
            sshUser: "root",
            isActive: true,
            latitude: -6.2088,
            longitude: 106.8456,
            openVpnPort: 1194,
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.latitude).toBe(-6.2088)
      expect(body.data.longitude).toBe(106.8456)
    })

    it("logs and returns 500 when an unexpected error occurs", async () => {
      const failingService = new VpnServerService(mockPrisma)
      failingService.update = mock(async () => {
        throw new Error("DATABASE_COLUMN_MISSING")
      })

      const app = createApp({ service: failingService }).compile()

      const response = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "ID-01",
            regionId: "reg-1",
            hostname: "vpn-id-01.example.net",
            sshPort: 22,
            sshKeyId: "key-1",
            sshUser: "root",
            isActive: true,
            latitude: -6.2088,
            longitude: 106.8456,
            openVpnPort: 1194,
          }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_ERROR")
      expect(mockConsoleError).toHaveBeenCalledTimes(1)
      const logArgs = mockConsoleError.mock.calls[0]
      expect(String(logArgs[1])).toContain("DATABASE_COLUMN_MISSING")
    })

    it("returns 403 when the actor is not a super admin", async () => {
      const app = new Elysia()
        .use(
          createAdminVpnServersRoutes({
            requireSuperAdmin: forbiddenGuard,
            service,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "ID-01",
            regionId: "reg-1",
            hostname: "vpn-id-01.example.net",
            sshPort: 22,
            sshKeyId: "key-1",
            sshUser: "root",
            isActive: true,
            openVpnPort: 1194,
          }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })
  })
})
