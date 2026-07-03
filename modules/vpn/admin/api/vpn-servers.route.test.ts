import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type { PrismaClient } from "@prisma/client"

import { createAdminVpnServersRoutes, TEST_RATE_LIMIT_MS } from "./vpn-servers.route"
import { VpnServerService } from "../vpn-server.service"
import type { VpnServerScanner } from "../vpn-health.service"
import type { ScanResult } from "../vpn-connection-scanner"

// ---------------------------------------------------------------------------
// Shared server factory — produces a fully-populated server record.
// ---------------------------------------------------------------------------

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
  sshKey: {
    id: "key-1",
    name: "Prod Key",
    fingerprint: "SHA256:abc",
    encryptedPrivateKey: "enc-key",
  },
  ...over,
})

const mockConsoleError = mock<(...args: unknown[]) => void>(() => {})

// ---------------------------------------------------------------------------
// SSH executor mock — responses consumed in order by Promise.all
// ---------------------------------------------------------------------------

interface SshResult {
  stdout: string
  stderr: string
  exitCode: number
}

let sshResponses: SshResult[] = []
let sshCallIndex = 0
const mockSshExecutorExec = mock<() => Promise<SshResult>>(async () => {
  const result = sshResponses[sshCallIndex] ?? { stdout: "", stderr: "", exitCode: 0 }
  sshCallIndex++
  return result
})

// ---------------------------------------------------------------------------
// OpenVPN adapter mock
// ---------------------------------------------------------------------------

let openVpnResponses: ScanResult[][] = []
let openVpnCallIndex = 0
const mockOpenVpnListClients = mock<() => Promise<ScanResult[]>>(async () => {
  const result = openVpnResponses[openVpnCallIndex] ?? []
  openVpnCallIndex++
  return result
})

// ---------------------------------------------------------------------------
// Sync job mock
// ---------------------------------------------------------------------------

let syncJobResponses: boolean[] = []
let syncJobCallIndex = 0
const mockSyncJobDispatch = mock<() => Promise<boolean>>(async () => {
  const result = syncJobResponses[syncJobCallIndex] ?? true
  syncJobCallIndex++
  return result
})

// ---------------------------------------------------------------------------
// Audit log mock
// ---------------------------------------------------------------------------

const mockAuditLog = mock<() => Promise<void>>(async () => {})

// ---------------------------------------------------------------------------
// Module-level response queues for prisma — reassigned in beforeEach so the
// mock.module callback (which captures the variable by reference) always gets
// the fresh state on the next call.
// ---------------------------------------------------------------------------

let vpnServerFindManyQueue: unknown[] = []
let vpnServerFindUniqueValue: unknown = makeServer()
let vpnServerCreateValue: unknown = makeServer()
let vpnServerUpdateValue: unknown = makeServer()
let vpnServerDeleteValue: unknown = {}

mock.module("@/lib/prisma", () => ({
  prisma: {
    vpnServer: {
      findMany: mock<() => unknown>(async () => vpnServerFindManyQueue),
      findUnique: mock<() => unknown>(async () => vpnServerFindUniqueValue),
      create: mock<() => unknown>(async () => vpnServerCreateValue),
      update: mock<() => unknown>(async () => vpnServerUpdateValue),
      delete: mock<() => unknown>(async () => vpnServerDeleteValue),
    },
    vpnRegion: {
      findUnique: mock<() => unknown>(async () => ({ id: "reg-1" })),
    },
    vpnSshKey: {
      findUnique: mock<() => unknown>(async () => ({ id: "key-1" })),
    },
  } as unknown as PrismaClient,
}))

mock.module("@/modules/vpn/provisioning/vpn-server-ssh-executor", () => ({
  VpnServerSshExecutor: class {
    exec = mockSshExecutorExec
  },
}))

mock.module("@/modules/vpn/openvpn/openvpn-ssh-adapter", () => ({
  OpenVpnSshAdapter: class {
    listClients = mockOpenVpnListClients
  },
}))

mock.module("@/lib/queue/vpn-server-sync", () => ({
  VpnServerSyncJob: class {
    static dispatch = mockSyncJobDispatch
  },
}))

mock.module("@/lib/audit.service", () => ({
  logAuditEvent: mockAuditLog,
}))

// ---------------------------------------------------------------------------
// Service — built from the mocked prisma, injected into all routes so the
// real @/lib/prisma module is bypassed entirely.
// ---------------------------------------------------------------------------

const service = new VpnServerService(
  // @ts-ignore — testing against the mocked module
  undefined as unknown as PrismaClient
)

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const allowedGuard = async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
})

const forbiddenGuard = async (set: { status?: number | string }) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    message: "Only super administrators can manage VPN servers.",
  }
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function createApp(deps: {
  now?: () => number
  scanConnection?: VpnServerScanner
} = {}) {
  return new Elysia().use(
    createAdminVpnServersRoutes({
      requireSuperAdmin: allowedGuard,
      service,
      now: deps.now,
      scanConnection: deps.scanConnection,
    })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAdminVpnServersRoutes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    console.error = mockConsoleError
    // Reset closure-level call counters — NOT cleared by mock.clearAllMocks()
    sshResponses = []
    sshCallIndex = 0
    openVpnResponses = []
    openVpnCallIndex = 0
    syncJobResponses = []
    syncJobCallIndex = 0
    // Reassign arrays so the next call to findMany sees the fresh empty queue
    vpnServerFindManyQueue = []
    vpnServerFindUniqueValue = makeServer()
  })

  // ── GET /admin/vpn/servers ───────────────────────────────────────────────

  describe("GET /admin/vpn/servers", () => {
    it("returns a list of servers", async () => {
      vpnServerFindManyQueue.push(makeServer(), makeServer({ id: "srv-2", name: "SG-01" }))
      const app = createApp().compile()

      const res = await app.handle(new Request("http://localhost/admin/vpn/servers"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(2)
    })

    it("filters servers by regionId query param", async () => {
      vpnServerFindManyQueue.push(
        makeServer({
          id: "srv-jkt",
          regionId: "reg-jakarta",
          region: { id: "reg-jakarta", name: "Jakarta", slug: "jakarta", countryCode: "id" },
        }),
        makeServer({
          id: "srv-sg",
          regionId: "reg-singapore",
          region: { id: "reg-singapore", name: "Singapore", slug: "singapore", countryCode: "sg" },
        })
      )
      const app = createApp().compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers?regionId=reg-jakarta")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.some((s: { region?: { id: string } }) => s.region?.id === "reg-jakarta")).toBe(true)
    })

    it("filters servers by search query param", async () => {
      vpnServerFindManyQueue.push(
        makeServer({
          id: "srv-1",
          hostname: "vpn-id-01.example.net",
          region: { id: "reg-1", name: "Indonesia", slug: "indonesia", countryCode: "id" },
        })
      )
      const app = createApp().compile()

      // Real service uses mode:"insensitive"; mock returns as-is, so match exact case
      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers?search=vpn-id-01")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.some((s: { hostname: string }) => s.hostname.includes("vpn-id-01"))).toBe(true)
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

      const res = await app.handle(new Request("http://localhost/admin/vpn/servers"))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })
  })

  // ── POST /admin/vpn/servers ─────────────────────────────────────────────

  describe("POST /admin/vpn/servers", () => {
    const validBody = {
      name: "ID-01",
      regionId: "reg-1",
      hostname: "vpn-id-01.example.net",
      sshPort: 22,
      sshKeyId: "key-1",
      sshUser: "root",
      isActive: true,
      latitude: -6.2088,
      longitude: 106.8456,
      hasOpenVpn: true,
      openVpnPort: 1194,
    }
    it("creates a server and returns 201", async () => {
      // Override service.create to bypass the prisma dependency chain (assertNameAvailable
      // calls findUnique which depends on vpnServerFindUniqueValue state).
      const svc = new VpnServerService(
        // @ts-ignore
        undefined as unknown as PrismaClient
      )
      svc.create = mock<() => Promise<unknown>>(async () => makeServer({ id: "srv-new" }))

      const app = new Elysia().use(
        createAdminVpnServersRoutes({
          requireSuperAdmin: allowedGuard,
          service: svc,
        })
      ).compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        })
      )

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.id).toBe("srv-new")
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

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        })
      )

      expect(res.status).toBe(403)
    })
  })

  // ── PUT /admin/vpn/servers/:id ───────────────────────────────────────────

  describe("PUT /admin/vpn/servers/:id", () => {
    it("updates a server with latitude and longitude", async () => {
      vpnServerUpdateValue = makeServer({ latitude: -6.2088, longitude: 106.8456 })
      const app = createApp().compile()

      const res = await app.handle(
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

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.latitude).toBe(-6.2088)
      expect(body.data.longitude).toBe(106.8456)
    })

    it("logs and returns 500 when an unexpected error occurs", async () => {
      const failingService = new VpnServerService(
        // @ts-ignore
        undefined as unknown as PrismaClient
      )
      failingService.update = mock<() => Promise<never>>(async () => {
        throw new Error("DATABASE_COLUMN_MISSING")
      })

      const app = new Elysia().use(
        createAdminVpnServersRoutes({
          requireSuperAdmin: allowedGuard,
          service: failingService,
        })
      ).compile()

      const res = await app.handle(
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

      expect(res.status).toBe(500)
      const body = await res.json()
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

      const res = await app.handle(
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

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })
  })

  // ── DELETE /admin/vpn/servers/:id ────────────────────────────────────────

  describe("DELETE /admin/vpn/servers/:id", () => {
    it("deletes a server and returns ok", async () => {
      vpnServerDeleteValue = {}
      const app = createApp().compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
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

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(403)
    })
  })

  // ── GET /admin/vpn/servers/:id ───────────────────────────────────────────

  describe("GET /admin/vpn/servers/:id", () => {
    it("returns a server by id", async () => {
      const app = createApp().compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.id).toBe("srv-1")
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

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1")
      )

      expect(res.status).toBe(403)
    })
  })

  // ── GET /admin/vpn/servers/:id/metrics ───────────────────────────────────

  describe("GET /admin/vpn/servers/:id/metrics", () => {
    beforeEach(() => {
      sshResponses = []
      sshCallIndex = 0
    })

    it("returns parsed metrics from SSH executor", async () => {
      // 7 SSH calls: uptime -p, vnstat -d --json, vnstat -m --json,
      // ps (cpu), ps (memory), nproc+/proc/stat, free -b
      sshResponses = [
        { stdout: "up 5 hours", stderr: "", exitCode: 0 },
        {
          stdout: JSON.stringify({
            interfaces: [{
              traffic: {
                day: [{ date: { year: 2026, month: 7, day: 1 }, rx: 1_000_000, tx: 500_000, total: 1_500_000 }],
              },
            }],
          }),
          stderr: "",
          exitCode: 0,
        },
        {
          stdout: JSON.stringify({
            interfaces: [{
              traffic: {
                month: [{ date: { year: 2026, month: 7 }, rx: 10_000_000, tx: 5_000_000, total: 15_000_000 }],
              },
            }],
          }),
          stderr: "",
          exitCode: 0,
        },
        { stdout: "PID COMMAND %CPU %MEM\n123 nginx 1.2 0.5", stderr: "", exitCode: 0 },
        { stdout: "PID COMMAND %CPU %MEM\n456 python 0.8 1.2", stderr: "", exitCode: 0 },
        { stdout: "8\ncpu  1000 200 300 400 500 600 700", stderr: "", exitCode: 0 },
        { stdout: "Mem: 16000000 8000000 8000000", stderr: "", exitCode: 0 },
      ]

      const app = createApp().compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/metrics")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.uptime).toBe("up 5 hours")
      expect(body.data.resources.cpu.totalCores).toBe(8)
      expect(body.data.resources.memory.total).toBe(16_000_000)
      expect(body.data.traffic.daily).toHaveLength(1)
      expect(body.data.traffic.monthly).toHaveLength(1)
      expect(body.data.traffic.daily[0].rx).toBe(1_000_000)
      expect(body.data.traffic.monthly[0].total).toBe(15_000_000)
      expect(body.data.processes.cpu).toHaveLength(1)
      expect(body.data.processes.cpu[0].command).toBe("nginx")
      expect(body.data.processes.memory).toHaveLength(1)
      expect(body.data.processes.memory[0].command).toBe("python")
      expect(body.data.collectedAt).toBeDefined()
    })

    it("gracefully handles null exec results when SSH commands fail", async () => {
      sshResponses = Array(7).fill(null).map(() => ({
        stdout: "", stderr: "SSH error", exitCode: 1,
      }))

      const app = createApp().compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/metrics")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.traffic.daily).toEqual([])
      expect(body.data.traffic.monthly).toEqual([])
      expect(body.data.resources.cpu.usedPercent).toBeNull()
      expect(body.data.resources.cpu.totalCores).toBeNull()
      expect(body.data.resources.memory.total).toBeNull()
      expect(body.data.processes.cpu).toEqual([])
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

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/metrics")
      )

      expect(res.status).toBe(403)
    })
  })

  // ── GET /admin/vpn/servers/:id/openvpn-users ─────────────────────────────

  describe("GET /admin/vpn/servers/:id/openvpn-users", () => {
    beforeEach(() => {
      openVpnResponses = []
      openVpnCallIndex = 0
    })

    it("returns a list of OpenVPN users from the SSH adapter", async () => {
      const mockUsers = [
        { commonName: "user-1", realAddress: "1.2.3.4:51901", connectedSince: 1700000000 },
        { commonName: "user-2", realAddress: "5.6.7.8:51902", connectedSince: 1700001000 },
      ]
      openVpnResponses = [mockUsers as unknown as ScanResult[]]

      const app = createApp().compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/openvpn-users")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toEqual(mockUsers)
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

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/openvpn-users")
      )

      expect(res.status).toBe(403)
    })
  })

  // ── POST /admin/vpn/servers/:id/sync-protocols ───────────────────────────

  describe("POST /admin/vpn/servers/:id/sync-protocols", () => {
    beforeEach(() => {
      syncJobResponses = []
      syncJobCallIndex = 0
    })

    it("dispatches a sync job and logs an audit event", async () => {
      syncJobResponses = [true]

      const app = createApp().compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/sync-protocols", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.queued).toBe(true)
      expect(body.correlationId).toBe("vpn-sync-srv-1")
      expect(mockSyncJobDispatch).toHaveBeenCalledTimes(1)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
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

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/sync-protocols", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
    })
  })

  // ── POST /admin/vpn/servers/:id/test ─────────────────────────────────────

  describe("POST /admin/vpn/servers/:id/test", () => {
    it("runs the connection scan and returns the result", async () => {
      // Fresh mock per test to avoid shared call-index state
      let scanCallIndex = 0
      const scanMock = mock<() => Promise<ScanResult>>(async () => {
        scanCallIndex++
        return { healthy: true, latencyMs: 42 } as ScanResult
      })

      const app = createApp({
        scanConnection: scanMock as unknown as VpnServerScanner,
      }).compile()

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/test", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.healthy).toBe(true)
      expect(body.data.latencyMs).toBe(42)
    })

    it("returns 429 when test is called again within the rate limit window", async () => {
      let nowValue = 1_000_000
      const now = mock<() => number>(() => nowValue)
      let scanCallIndex = 0
      const scanMock = mock<() => Promise<ScanResult>>(async () => {
        scanCallIndex++
        return { healthy: true, latencyMs: 10 } as ScanResult
      })

      const app = createApp({
        now,
        scanConnection: scanMock as unknown as VpnServerScanner,
      }).compile()

      const res1 = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/test", { method: "POST" })
      )
      expect(res1.status).toBe(200)

      // Advance clock to just inside the rate limit window
      nowValue = 1_000_000 + TEST_RATE_LIMIT_MS - 1

      const res2 = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/test", { method: "POST" })
      )

      expect(res2.status).toBe(429)
      const body = await res2.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("RATE_LIMITED")
    })

    it("allows a second test after the rate limit window passes", async () => {
      let nowValue = 1_000_000
      const now = mock<() => number>(() => nowValue)
      let scanCallIndex = 0
      const scanMock = mock<() => Promise<ScanResult>>(async () => {
        scanCallIndex++
        return { healthy: true, latencyMs: scanCallIndex } as ScanResult
      })

      const app = createApp({
        now,
        scanConnection: scanMock as unknown as VpnServerScanner,
      }).compile()

      const res1 = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/test", { method: "POST" })
      )
      expect(res1.status).toBe(200)

      // Advance clock past the rate limit window
      nowValue = 1_000_000 + TEST_RATE_LIMIT_MS + 1

      const res2 = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/test", { method: "POST" })
      )
      expect(res2.status).toBe(200)
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

      const res = await app.handle(
        new Request("http://localhost/admin/vpn/servers/srv-1/test", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
    })
  })
})
