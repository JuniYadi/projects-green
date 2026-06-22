import { describe, expect, it, mock, beforeEach } from "bun:test"

// ─── Mocks ──────────────────────────────────────────────────────────────
//
// Per AGENTS.md: never mock a sibling service module. We mock only
// `@/lib/prisma` (a leaf dependency) and inject a fake `requireSuperAdmin`
// guard through the route factory's `deps` parameter.

const mockPrisma = {
  vpnAuditLog: {
    findMany: mock(),
    count: mock(),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { createAdminVpnAuditRoutes } from "./admin-vpn-audit.route"
import type {
  AdminActorContext,
  AdminApiError,
} from "@/modules/admin/api/admin.guards"

const okAdmin: AdminActorContext = {
  ok: true,
  userId: "admin-1",
  platformRole: "super_admin",
}

// The factory returns an Elysia instance with prefix "/admin/vpn/audit" baked
// in, so standalone tests must request the full prefixed path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildApp = (guardImpl: any = async () => okAdmin) =>
  createAdminVpnAuditRoutes({ requireSuperAdmin: guardImpl })

const BASE = "http://localhost/admin/vpn/audit"

const sampleRows = [
  {
    id: "log_1",
    serverAccountId: "srv_abc",
    deviceId: null,
    userId: null,
    adminId: "admin-1",
    action: "PROVISIONING_SUCCESS",
    step: null,
    status: null,
    message: null,
    errorMessage: null,
    durationMs: null,
    organizationId: null,
    subscriptionId: null,
    serverId: null,
    correlationId: null,
    requestPayload: null,
    responsePayload: null,
    details: { serverName: "vpn-sgp-01", durationMs: 1500 },
    ip: "10.0.0.1",
    userAgent: "curl/8",
    createdAt: new Date("2026-06-22T10:00:00.000Z"),
  },
  {
    id: "log_2",
    serverAccountId: "srv_def",
    deviceId: "dev_xyz",
    userId: "user-1",
    adminId: null,
    action: "PROVISIONING_STEP",
    step: "ssh_connecting",
    status: "FAILED",
    message: null,
    errorMessage: null,
    durationMs: null,
    organizationId: null,
    subscriptionId: null,
    serverId: null,
    correlationId: null,
    requestPayload: null,
    responsePayload: null,
    details: { step: "ssh_connecting", status: "FAILED", error: "timeout" },
    ip: "10.0.0.2",
    userAgent: "node",
    createdAt: new Date("2026-06-22T11:00:00.000Z"),
  },
]

beforeEach(() => {
  mockPrisma.vpnAuditLog.findMany.mockReset()
  mockPrisma.vpnAuditLog.count.mockReset()
  mockPrisma.vpnAuditLog.findMany.mockResolvedValue([])
  mockPrisma.vpnAuditLog.count.mockResolvedValue(0)
})

describe("GET /admin/vpn/audit", () => {
  it("returns paginated audit entries mapped through the list DTO", async () => {
    mockPrisma.vpnAuditLog.findMany.mockResolvedValue(sampleRows)
    mockPrisma.vpnAuditLog.count.mockResolvedValue(2)

    const app = buildApp()
    const res = await app.handle(new Request(BASE + "/"))

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(2)
    // DTO shape: list-friendly fields, not raw Prisma rows
    expect(body.data[0]).toMatchObject({
      id: "log_1",
      action: "PROVISIONING_SUCCESS",
      serverAccountId: "srv_abc",
      adminId: "admin-1",
      ip: "10.0.0.1",
    })
    expect(body.data[0].createdAt).toBe("2026-06-22T10:00:00.000Z")
    expect(body.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 2,
      totalPages: 1,
    })

    // Default ordering is newest-first
    const findArgs = mockPrisma.vpnAuditLog.findMany.mock.calls[0][0] as {
      orderBy: Record<string, string>
      skip: number
      take: number
    }
    expect(findArgs.orderBy).toEqual({ createdAt: "desc" })
    expect(findArgs.skip).toBe(0)
    expect(findArgs.take).toBe(50)
  })

  it("applies action filter via the `action` query param", async () => {
    const app = buildApp()
    await app.handle(
      new Request(BASE + "/?action=PROVISIONING_FAILED")
    )

    const where = mockPrisma.vpnAuditLog.findMany.mock.calls[0][0].where
    expect(where.action).toBe("PROVISIONING_FAILED")
  })

  it("applies status filter via an OR clause covering column and details JSON", async () => {
    const app = buildApp()
    await app.handle(new Request(BASE + "/?status=FAILED"))

    const where = mockPrisma.vpnAuditLog.findMany.mock.calls[0][0].where
    expect(Array.isArray(where.OR)).toBe(true)
    const orStr = JSON.stringify(where.OR)
    expect(orStr).toContain('"status"')
    expect(orStr).toContain("FAILED")
    expect(orStr).toContain("details")
    expect(orStr).toContain("path")
  })

  it("merges status OR with free-text q search without clobbering", async () => {
    const app = buildApp()
    await app.handle(new Request(BASE + "/?status=FAILED&q=srv_abc"))

    const where = mockPrisma.vpnAuditLog.findMany.mock.calls[0][0].where
    // OR must include both the status clauses and the q clauses (4 column
    // clauses + 1 JSON details clause + 2 status clauses = 7 total).
    expect(Array.isArray(where.OR)).toBe(true)
    expect(where.OR.length).toBeGreaterThanOrEqual(6)
    const orStr = JSON.stringify(where.OR)
    expect(orStr).toContain("srv_abc")
    expect(orStr).toContain("contains")
    expect(orStr).toContain("string_contains")
  })

  it("applies date range filter via from/to", async () => {
    const app = buildApp()
    await app.handle(
      new Request(
        BASE + "/?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z"
      )
    )

    const where = mockPrisma.vpnAuditLog.findMany.mock.calls[0][0].where
    expect(where.createdAt).toBeDefined()
    expect(where.createdAt.gte).toEqual(new Date("2026-06-01T00:00:00Z"))
    expect(where.createdAt.lte).toEqual(new Date("2026-06-30T23:59:59Z"))
  })

  it("respects page and limit and computes totalPages", async () => {
    mockPrisma.vpnAuditLog.count.mockResolvedValue(120)

    const app = buildApp()
    const res = await app.handle(
      new Request(BASE + "/?page=3&limit=50")
    )
    const body = await res.json()

    expect(body.pagination).toEqual({
      page: 3,
      limit: 50,
      total: 120,
      totalPages: 3,
    })

    const findArgs = mockPrisma.vpnAuditLog.findMany.mock.calls[0][0] as {
      skip: number
      take: number
    }
    expect(findArgs.skip).toBe(100)
    expect(findArgs.take).toBe(50)
  })

  it("rejects limit above the 100 max via schema validation", async () => {
    const app = buildApp()
    const res = await app.handle(new Request(BASE + "/?limit=999"))

    // Elysia's schema validator rejects the out-of-range limit before the
    // handler runs — so Prisma is never queried.
    expect(res.status).toBe(422)
    expect(mockPrisma.vpnAuditLog.findMany).not.toHaveBeenCalled()
  })

  it("returns the guard's error payload when requireSuperAdmin rejects", async () => {
    // The real guard sets `set.status` and returns an AdminApiError. We
    // simulate that via the injected dep.
    const unauth: AdminApiError = {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required",
    }
    const app = buildApp(async () => unauth)

    const res = await app.handle(new Request(BASE + "/"))

    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
    expect(mockPrisma.vpnAuditLog.findMany).not.toHaveBeenCalled()
  })
})

describe("GET /admin/vpn/audit/accounts/:saId (unchanged behaviour)", () => {
  it("still returns per-account entries mapped through the lean DTO", async () => {
    mockPrisma.vpnAuditLog.findMany.mockResolvedValue([sampleRows[0]])
    mockPrisma.vpnAuditLog.count.mockResolvedValue(1)

    const app = buildApp()
    const res = await app.handle(
      new Request(BASE + "/accounts/srv_abc?type=all")
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    // The per-account route uses the lean DTO (includes new audit columns)
    expect(Object.keys(body.data[0]).sort()).toEqual(
      ["action", "createdAt", "details", "durationMs", "errorMessage", "id", "message", "status", "step"].sort()
    )
  })
})
