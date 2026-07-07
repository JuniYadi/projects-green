import { describe, expect, it, mock, beforeEach } from "bun:test"

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockPrisma = {
  whatsappAuditLog: {
    findMany: mock(),
    count: mock(),
  },
  whatsappDevice: {
    findUnique: mock(),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { createWhatsappAuditRoutes, consoleWhatsappAuditRoutes } from "./whatsapp-audit.route"
import { type AdminActorContext } from "@/modules/admin/api/admin.guards"

const okAdmin: AdminActorContext = {
  ok: true,
  userId: "admin-1",
  platformRole: "super_admin",
}

const buildApp = (guardImpl: any = async () => okAdmin) =>
  createWhatsappAuditRoutes({ requireSuperAdmin: guardImpl })


// ─── Console audit route helpers ─────────────────────────────────────────--

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => {
    const ctx = mockResolveAuthContext.current
    if (!ctx) return null
    return ctx
  },
}))

const mockResolveAuthContext: { current: any } = { current: null }

const CONSOLE_BASE = "http://localhost/audit"

const buildConsoleApp = () => {
  const { Elysia } = require("elysia")
  return new Elysia().use(consoleWhatsappAuditRoutes)
}
const BASE = "http://localhost/admin/whatsapp/audit"

const sampleRows = [
  {
    id: "log_1",
    organizationId: "org-1",
    deviceId: "dev-1",
    adminId: "admin-1",
    correlationId: null,
    action: "TEMPLATE_SYNC_REQUESTED",
    status: "OK",
    message: "Sync enqueued",
    errorMessage: null,
    details: null,
    durationMs: null,
    ip: "10.0.0.1",
    userAgent: "curl/8",
    createdAt: new Date("2026-06-22T10:00:00.000Z"),
  },
]

beforeEach(() => {
  mockPrisma.whatsappAuditLog.findMany.mockReset()
  mockPrisma.whatsappAuditLog.count.mockReset()
  mockPrisma.whatsappDevice.findUnique.mockReset()
})

// ─── Helpers ────────────────────────────────────────────────────────────

const mockUnauthorized = (set: any) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to perform this action.",
  }
}

const mockForbidden = (set: any) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    policyCode: "SUPER_ADMIN_REQUIRED" as const,
    message: "This action requires super admin access.",
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("Admin WhatsApp Audit Routes", () => {
  // ── GET / (global) ──────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns 401 when not authenticated", async () => {
      const app = buildApp(mockUnauthorized)
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()
      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      const app = buildApp(mockForbidden)
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()
      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns paginated audit entries through DTO", async () => {
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe("log_1")
      expect(body.data[0].action).toBe("TEMPLATE_SYNC_REQUESTED")
      expect(body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
    })

    it("returns empty list when no entries", async () => {
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(0)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue([])

      const app = buildApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json() as any

      expect(body.ok).toBe(true)
      expect(body.data).toEqual([])
      expect(body.pagination.total).toBe(0)
    })

    it("applies action filter", async () => {
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildApp()
      const res = await app.handle(
        new Request(`${BASE}/?action=TEMPLATE_SYNC_REQUESTED`)
      )
      const body = await res.json() as any

      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })

    it("applies status filter", async () => {
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildApp()
      const res = await app.handle(new Request(`${BASE}/?status=OK`))
      const body = await res.json() as any

      expect(body.ok).toBe(true)
    })

    it("applies date range filter", async () => {
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildApp()
      const res = await app.handle(
        new Request(`${BASE}/?from=2026-06-01&to=2026-06-30`)
      )
      const body = await res.json() as any

      expect(body.ok).toBe(true)
    })

    it("applies free-text search", async () => {
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildApp()
      const res = await app.handle(new Request(`${BASE}/?q=sync`))
      const body = await res.json() as any

      expect(body.ok).toBe(true)
    })
  })

  // ── GET /devices/:deviceId (per-device) ──────────────────────────────

  describe("GET /devices/:deviceId", () => {
    it("returns 404 when device not found", async () => {
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.handle(new Request(`${BASE}/devices/nonexistent`))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns filtered audit entries for device", async () => {
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "dev-1",
        organizationId: "org-1",
      })
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildApp()
      const res = await app.handle(new Request(`${BASE}/devices/dev-1`))
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].deviceId).toBe("dev-1")
    })

    it("returns 401 when not authenticated", async () => {
      const app = buildApp(mockUnauthorized)
      const res = await app.handle(new Request(`${BASE}/devices/dev-1`))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
    })
  })
})
describe("Console WhatsApp Audit Routes", () => {
  beforeEach(() => {
    mockPrisma.whatsappAuditLog.findMany.mockReset()
    mockPrisma.whatsappAuditLog.count.mockReset()
    mockPrisma.whatsappDevice.findUnique.mockReset()

    mockResolveAuthContext.current = {
      type: "workos",
      userId: "user-1",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    }
  })

  describe("GET /audit", () => {
    it("returns 401 when not authenticated", async () => {
      mockResolveAuthContext.current = null
      const app = buildConsoleApp()
      const res = await app.handle(new Request(`${CONSOLE_BASE}/`))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when no organization", async () => {
      mockResolveAuthContext.current = {
        type: "workos",
        userId: "user-1",
        organizationId: null,
        orgRole: "admin",
        platformRole: "none",
      }
      const app = buildConsoleApp()
      const res = await app.handle(new Request(`${CONSOLE_BASE}/`))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns org-scoped audit entries", async () => {
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildConsoleApp()
      const res = await app.handle(new Request(`${CONSOLE_BASE}/`))
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe("log_1")
      // Verify org-scoped query
      expect(mockPrisma.whatsappAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-1" }),
        })
      )
    })
  })

  describe("GET /audit/devices/:deviceId", () => {
    it("returns 404 when device not found", async () => {
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue(null)

      const app = buildConsoleApp()
      const res = await app.handle(new Request(`${CONSOLE_BASE}/devices/nonexistent`))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 403 for cross-org device", async () => {
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "dev-other",
        organizationId: "org-other",
      })

      const app = buildConsoleApp()
      const res = await app.handle(new Request(`${CONSOLE_BASE}/devices/dev-other`))
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns org-scoped device audit entries", async () => {
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "dev-1",
        organizationId: "org-1",
      })
      mockPrisma.whatsappAuditLog.count.mockResolvedValue(1)
      mockPrisma.whatsappAuditLog.findMany.mockResolvedValue(sampleRows)

      const app = buildConsoleApp()
      const res = await app.handle(new Request(`${CONSOLE_BASE}/devices/dev-1`))
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })
})
