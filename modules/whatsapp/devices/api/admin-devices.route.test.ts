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
const mockBillingFindUnique = mock<(...args: any[]) => any>(async () => null)
const mockBillingCreate = mock<(...args: any[]) => any>(async () => ({ id: "ba-1", balance: 0 }))
const mockAdjustmentCreate = mock<(...args: any[]) => any>(async () => ({ id: "adj-1" }))
const mockTransaction = mock<(...args: any[]) => any>(async (fn: (tx: any) => any) =>
  fn({
    whatsappDevice: {
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    billingAccount: {
      findUnique: mockBillingFindUnique,
      create: mockBillingCreate,
    },
    billingAdjustment: {
      create: mockAdjustmentCreate,
    },
  }),
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
      update: mockUpdate,
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

const mockAuth = { user: { id: "user-1", email: "admin@test.com" } }

type AuthFn = () => Promise<{ user: { id: string; email?: string | null } | null }>

const mockAuthenticate: AuthFn = mock(() => Promise.resolve(mockAuth))

const mockGetRole = mock<(...args: any[]) => any>((_userId: string) => Promise.resolve("super_admin"))

// Module under test — must be imported AFTER mocks
const { createAdminDevicesRoutes } = await import("./admin-devices.route")

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestApp() {
  return new Elysia().use(
    createAdminDevicesRoutes({
      authenticate: mockAuthenticate,
      getRole: mockGetRole,
    }),
  )
}

const BASE = "http://localhost/admin/devices"

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Admin Devices Routes", () => {
  beforeEach(() => {
    mockFindMany.mockImplementation(async () => [])
    mockCount.mockImplementation(async () => 0)
    mockFindUnique.mockImplementation(async () => null)
    mockUpdate.mockImplementation(async () => ({}))
    mockBillingFindUnique.mockImplementation(async () => null)
    mockBillingCreate.mockImplementation(async () => ({ id: "ba-1", balance: 0 }))
    mockAdjustmentCreate.mockImplementation(async () => ({ id: "adj-1" }))
    ;(mockAuthenticate as any).mockImplementation(async () => mockAuth)
    ;(mockGetRole as any).mockImplementation(
      async (_userId: string) => "super_admin",
    )
  })

  // ─── GET / ──────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns 401 when not authenticated", async () => {
      ;(mockAuthenticate as any).mockImplementation(async () => ({ user: null }))

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super_admin", async () => {
      ;(mockGetRole as any).mockImplementation(
        async (_userId: string) => "admin",
      )

      const app = createTestApp()
      const res = await app.handle(new Request(`${BASE}/`))
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns all devices for super_admin", async () => {
      const devices = [
        {
          id: "dev-1",
          organizationId: "org-1",
          phoneNumber: "+6281234567890",
          status: "ACTIVE",
          balance: 100000,
          quotaBase: 1000,
          dailyLimitMessage: 500,
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

  // ─── GET /:id ───────────────────────────────────────────────────────────────

  describe("GET /:id", () => {
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
        balance: 250000,
        quotaBase: 2000,
        quotaBaseIn: 100,
        quotaBaseOut: 100,
        dailyLimitMessage: 500,
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
        callbackUrl: "https://example.com/callback",
        expiredAt: null,
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
    })
  })

  // ─── POST /:id/top-up ──────────────────────────────────────────────────────

  describe("POST /:id/top-up", () => {
    it("returns 422 when amount is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request(`${BASE}/dev-1/top-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
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
        }),
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
        }),
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
        }),
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
        }),
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.newBalance).toBe(150000)
      expect(body.amount).toBe(50000)
    })
  })
})
