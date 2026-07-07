/**
 * WhatsApp Devices — Admin API Routes Tests
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockFindMany = mock<(...args: any[]) => any>(async () => [])
const mockCount = mock<(...args: any[]) => any>(async () => 0)
const mockFindUnique = mock<(...args: any[]) => any>(async () => null)
const mockUpdate = mock<(...args: any[]) => any>(async () => ({}))
const mockCreate = mock<(...args: any[]) => any>(async () => ({}))
const mockDelete = mock<(...args: any[]) => any>(async () => ({}))
const mockBillingFindUnique = mock<(...args: any[]) => any>(async () => null)
const mockBillingCreate = mock<(...args: any[]) => any>(async () => ({
  id: "ba-1",
  balance: 0,
}))
const mockAdjustmentCreate = mock<(...args: any[]) => any>(async () => ({
  id: "adj-1",
}))
const mockTransaction = mock<(...args: any[]) => any>(
  async (fn: (tx: any) => any) =>
    fn({
      whatsappDevice: {
        findMany: mockFindMany,
        count: mockCount,
        findUnique: mockFindUnique,
        update: mockUpdate,
        create: mockCreate,
        delete: mockDelete,
      },
      billingAccount: {
        findUnique: mockBillingFindUnique,
        create: mockBillingCreate,
      },
      billingAdjustment: {
        create: mockAdjustmentCreate,
      },
    })
)

mock.module("@/lib/queue/whatsapp-template-sync", () => ({
  enqueueWhatsAppTemplateSync: mock(async () => {}),
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
      delete: mockDelete,
    },
    billingAccount: {
      findUnique: mockBillingFindUnique,
      create: mockBillingCreate,
    },
    billingAdjustment: {
      create: mockAdjustmentCreate,
    },
    $transaction: mockTransaction,
  },
}))

const mockRequireSuperAdmin = mock<(...args: any[]) => any>(async () => ({
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))

// Module under test — must be imported AFTER mocks
const { createAdminDevicesRoutes } = await import("./admin-devices.route")

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestApp(guard = mockRequireSuperAdmin) {
  return new Elysia().use(
    createAdminDevicesRoutes({ requireSuperAdmin: guard })
  )
}

const BASE = "http://localhost/admin/devices"

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

function unauthorizedContext() {
  return mockUnauthorized as any
}

function forbiddenContext() {
  return mockForbidden as any
}

function superAdminContext() {
  return mockRequireSuperAdmin
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Admin Devices Routes", () => {
  const defaultDevice = {
    id: "dev-default",
    organizationId: "org-1",
    phoneNumber: "+6280000000000",
    status: "ACTIVE" as const,
    balance: { toString: () => "0", valueOf: () => 0 },
    quotaBase: { toString: () => "1000", valueOf: () => 1000 },
    dailyLimitMessage: 0,
    whatsappBusinessAccountId: null,
    whatsappPhoneId: null,
    whatsappApplicationId: null,
    callbackUrl: null,
    expiredAt: null,
    whatsappProfile: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  }

  beforeEach(() => {
    mockFindMany.mockImplementation(async () => [])
    mockCount.mockImplementation(async () => 0)
    mockFindUnique.mockImplementation(async () => null)
    mockUpdate.mockImplementation(async () => ({}))
    mockCreate.mockImplementation(async () => ({ ...defaultDevice }))
    mockDelete.mockImplementation(async () => ({}))
    mockBillingFindUnique.mockImplementation(async () => null)
    mockBillingCreate.mockImplementation(async () => ({
      id: "ba-1",
      balance: 0,
    }))
    mockAdjustmentCreate.mockImplementation(async () => ({ id: "adj-1" }))
    superAdminContext()
  })

  // ─── GET / ──────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns 401 when not authenticated", async () => {
      const app = createTestApp(unauthorizedContext())
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when authenticated but not super admin", async () => {
      const app = createTestApp(forbiddenContext())
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
      expect(body.policyCode).toBe("SUPER_ADMIN_REQUIRED")
    })

    it("returns all devices when super admin", async () => {
      const devices = [
        {
          id: "dev-1",
          organizationId: "org-1",
          phoneNumber: "+6281234567890",
          status: "ACTIVE",
          balance: { toString: () => "100000", valueOf: () => 100000 },
          quotaBase: { toString: () => "1000", valueOf: () => 1000 },
          quotaBaseOut: 1000,
          dailyLimitMessage: 500,
          whatsappBusinessAccountId: null,
          whatsappPhoneId: null,
          whatsappApplicationId: null,
          callbackUrl: null,
          whatsappProfile: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-15"),
        },
      ]
      mockFindMany.mockImplementation(async () => devices)

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.devices).toHaveLength(1)
      expect(body.devices[0].id).toBe("dev-1")
    })

    it("returns empty list when no devices", async () => {
      mockFindMany.mockImplementation(async () => [])

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.devices).toEqual([])
    })
  })

  // ─── GET /:id ─────────────────────────────────────────────────────────────

  describe("GET /:id", () => {
    it("returns 401 when not authenticated", async () => {
      const app = createTestApp(unauthorizedContext())
      const res = await app.handle(new Request(`${BASE}/dev-1`))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when device not found", async () => {
      mockFindUnique.mockImplementation(async () => null)

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/nonexistent`))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns device detail when found", async () => {
      const device = {
        id: "dev-1",
        organizationId: "org-1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        balance: { toString: () => "250000", valueOf: () => 250000 },
        quotaBase: { toString: () => "2000", valueOf: () => 2000 },
        quotaBaseOut: 100,
        dailyLimitMessage: 500,
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
        whatsappApplicationId: "app-1",
        callbackUrl: "https://example.com/callback",
        expiredAt: null,
        whatsappProfile: { name: "Primary" },
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-15"),
      }
      mockFindUnique.mockImplementation(async () => device)

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/dev-1`))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.device.id).toBe("dev-1")
      expect(body.device.balance).toBe(250000)
      expect(body.device.whatsappProfile).toEqual({ name: "Primary" })
    })
  })

  // ─── POST / ───────────────────────────────────────────────────────────────

  describe("POST /", () => {
    it("returns 401 when not authenticated", async () => {
      const app = createTestApp(unauthorizedContext())
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      const app = createTestApp(forbiddenContext())
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 when organizationId is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const bodyText = await res.text()
      const body = bodyText ? JSON.parse(bodyText) : null

      expect(res.status).toBe(422)
      expect(body).not.toBeNull()
      expect(body!.ok).toBe(false)
      expect(body!.error).toBe("VALIDATION_ERROR")
      expect(body!.fieldErrors.organizationId).toBeDefined()
    })

    it("returns 422 when phoneNumber is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            organizationId: "org-1",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.fieldErrors.phoneNumber).toBeDefined()
    })

    it("returns 201 and creates device with minimal body", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(body.device.id).toBe("dev-default")
      expect(body.device.organizationId).toBe("org-1")
    })

    it("returns 201 and persists all optional fields", async () => {
      let capturedData: any = null
      mockCreate.mockImplementation(async (data: any) => {
        capturedData = data
        return {
          id: "dev-full",
          organizationId: data.organizationId,
          phoneNumber: data.phoneNumber,
          status: "ACTIVE",
          balance: { toString: () => "0", valueOf: () => 0 },
          quotaBase: { toString: () => "1000", valueOf: () => 1000 },
          dailyLimitMessage: 0,
          whatsappBusinessAccountId: data.whatsappBusinessAccountId,
          whatsappPhoneId: data.whatsappPhoneId,
          whatsappApplicationId: data.whatsappApplicationId,
          callbackUrl: data.callbackUrl,
          expiredAt: null,
          whatsappProfile: data.whatsappProfile,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
        }
      })

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
            displayName: "Primary Device",
            environment: "LIVE",
            whatsappBusinessAccountId: "waba-1",
            whatsappPhoneId: "phone-1",
            whatsappApplicationId: "app-1",
            callbackUrl: "https://example.com/cb",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(capturedData.data).toEqual(
        expect.objectContaining({
          organizationId: "org-1",
          phoneNumber: "+6281234567890",
          status: "ACTIVE",
          whatsappBusinessAccountId: "waba-1",
          whatsappPhoneId: "phone-1",
          whatsappApplicationId: "app-1",
          callbackUrl: "https://example.com/cb",
          whatsappProfile: { name: "Primary Device" },
        })
      )
    })

    it("returns 500 on service failure", async () => {
      mockCreate.mockImplementation(async () => {
        throw new Error("Database exploded")
      })

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            organizationId: "org-1",
            phoneNumber: "+6281234567890",
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  // ─── PATCH /:id ─────────────────────────────────────────────────────────

  describe("PATCH /:id", () => {
    it("returns 401 when not authenticated", async () => {
      const app = createTestApp(unauthorizedContext())
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: "+6289999999999" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      const app = createTestApp(forbiddenContext())
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: "+6289999999999" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 when payload is invalid", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quotaBase: -1 }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 404 when device not found", async () => {
      mockFindUnique.mockImplementation(async () => null)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/nonexistent`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: "+6289999999999" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("updates device fields successfully", async () => {
      const existingDevice = {
        id: "dev-1",
        organizationId: "org-1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        balance: { toString: () => "0", valueOf: () => 0 },
        quotaBase: { toString: () => "1000", valueOf: () => 1000 },
        quotaBaseOut: 1000,
        dailyLimitMessage: 500,
        whatsappBusinessAccountId: null,
        whatsappPhoneId: null,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        callbackUrl: null,
        expiredAt: null,
        whatsappProfile: null,
        features: null,
      }
      const updatedDevice = {
        ...existingDevice,
        phoneNumber: "+6289999999999",
        dailyLimitMessage: 1000,
        updatedAt: new Date("2025-01-15"),
      }

      mockFindUnique.mockImplementation(async () => existingDevice)
      mockUpdate.mockImplementation(async () => updatedDevice)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: "+6289999999999",
            dailyLimitMessage: 1000,
          }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.device.phoneNumber).toBe("+6289999999999")
    })

    it("deactivates device via status update", async () => {
      const existingDevice = {
        id: "dev-1",
        organizationId: "org-1",
        phoneNumber: "+6281234567890",
        status: "ACTIVE",
        balance: { toString: () => "0", valueOf: () => 0 },
        quotaBase: { toString: () => "1000", valueOf: () => 1000 },
        quotaBaseOut: 1000,
        dailyLimitMessage: 0,
        whatsappBusinessAccountId: null,
        whatsappPhoneId: null,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        callbackUrl: null,
        expiredAt: null,
        whatsappProfile: null,
        features: null,
      }
      const deactivatedDevice = {
        ...existingDevice,
        status: "NON_ACTIVE",
      }

      mockFindUnique.mockImplementation(async () => existingDevice)
      mockUpdate.mockImplementation(async () => deactivatedDevice)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "NON_ACTIVE" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.device.status).toBe("NON_ACTIVE")
    })
  })

  // ─── DELETE /:id ────────────────────────────────────────────────────────

  describe("DELETE /:id", () => {
    it("returns 401 when not authenticated", async () => {
      const app = createTestApp(unauthorizedContext())
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, { method: "DELETE" })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      const app = createTestApp(forbiddenContext())
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, { method: "DELETE" })
      )
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when device not found", async () => {
      mockFindUnique.mockImplementation(async () => null)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/nonexistent`, { method: "DELETE" })
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("deletes device successfully", async () => {
      const existingDevice = {
        id: "dev-1",
        organizationId: "org-1",
        phoneNumber: "+6281234567890",
      }
      mockFindUnique.mockImplementation(async () => existingDevice)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1`, { method: "DELETE" })
      )
      const body = await res.json()

      // Since the service uses prisma directly and we mock at module level,
      // the delete call goes through the mocked prisma
      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.message).toBe("Device deleted.")
    })
  })

  // ─── POST /:id/sync-templates ──────────────────────────────────────────

  describe("POST /:id/sync-templates", () => {
    it("returns 401 when not authenticated", async () => {
      const app = createTestApp(unauthorizedContext())
      const res = await app.handle(
        new Request(`${BASE}/dev-1/sync-templates`, {
          method: "POST",
        })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      const app = createTestApp(forbiddenContext())
      const res = await app.handle(
        new Request(`${BASE}/dev-1/sync-templates`, {
          method: "POST",
        })
      )
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when device not found", async () => {
      mockFindUnique.mockResolvedValue(null)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/nonexistent/sync-templates`, {
          method: "POST",
        })
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 400 when device has no token", async () => {
      mockFindUnique.mockResolvedValue({
        id: "dev-1",
        token: null,
        tokenEncrypted: null,
        organizationId: "org-1",
      })

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/sync-templates`, {
          method: "POST",
        })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("BAD_REQUEST")
      expect(body.message).toContain("token")
    })

    it("enqueues sync job and returns 200 when device has token", async () => {
      mockFindUnique.mockResolvedValue({
        id: "dev-1",
        token: "some-token",
        tokenEncrypted: null,
        organizationId: "org-1",
      })

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/sync-templates`, {
          method: "POST",
        })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.message).toContain("Sync")
    })
  })

  // ─── POST /:id/top-up ───────────────────────────────────────────────────

  describe("POST /:id/top-up", () => {
    it("returns 401 when not authenticated", async () => {
      const app = createTestApp(unauthorizedContext())
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, reason: "Test" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 422 when amount is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 422 when amount is zero", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 0, reason: "Test" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(422)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 404 when device not found", async () => {
      mockFindUnique.mockImplementation(async () => null)

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/nonexistent/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, reason: "Test top-up" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 400 when balance would exceed max", async () => {
      mockFindUnique.mockImplementation(async () => ({
        id: "dev-1",
        organizationId: "org-1",
        balance: { plus: () => ({ gt: () => true }) },
      }))
      mockBillingFindUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: 0,
      }))

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 500000000, reason: "Excessive" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("BALANCE_LIMIT_EXCEEDED")
    })

    it("successfully tops up device balance", async () => {
      const balanceObj = {
        value: 50000,
        plus: function (n: number) {
          this.value += n
          return { gt: () => false, toString: () => String(this.value) }
        },
        toString: () => "50000",
        valueOf: () => 50000,
      }
      const fakeDevice = {
        id: "dev-1",
        organizationId: "org-1",
        balance: balanceObj,
      }
      mockFindUnique.mockImplementation(async () => fakeDevice)
      mockBillingFindUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: 0,
      }))
      mockUpdate.mockImplementation(async () => ({
        ...fakeDevice,
        balance: { toString: () => "150000", valueOf: () => 150000 },
      }))

      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, reason: "Monthly top-up" }),
        })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.newBalance).toBe(150000)
      expect(body.amount).toBe(50000)
    })
  })
})
