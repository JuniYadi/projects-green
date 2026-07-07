import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

import {
  setMockAuthContext,
  mockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "@/test/workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

const mockFindMany = mock(async () => [] as any)
const mockFindManyDevices = mock(async () => [] as any)
const mockFindManyWhatsappLedger = mock(async () => [] as any)
const mockFindUniqueBillingAccount = mock(async () => null as any)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDailyCount: {
      findMany: mockFindMany,
    },
    whatsappMonthlyCount: {
      findMany: mockFindMany,
    },
    billingUsageLedger: {
      findMany: mockFindMany,
    },
    whatsappDevice: {
      findMany: mockFindManyDevices,
    },
    whatsappBillingLedger: {
      findMany: mockFindManyWhatsappLedger,
    },
    billingAccount: {
      findUnique: mockFindUniqueBillingAccount,
    },
  },
}))

// ─── Auth mock ─────────────────────────────────────────────────────────────────

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const { usageRoutes } = await import("./usage.route")

function createTestApp() {
  return new Elysia().use(usageRoutes)
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeDailyCount(overrides: Record<string, unknown> = {}) {
  return {
    id: "dc-1",
    organizationId: "org-1",
    date: new Date("2026-06-15"),
    sessionCount: 5,
    messageInboxCount: 10,
    messageOutboxCount: 20,
    messageFailedCount: 1,
    whatsappDeviceId: "dev-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMonthlyCount(overrides: Record<string, unknown> = {}) {
  return {
    id: "mc-1",
    organizationId: "org-1",
    year: 2026,
    month: 6,
    sessionCount: 100,
    messageInboxCount: 500,
    messageOutboxCount: 1000,
    messageFailedCount: 5,
    whatsappDeviceId: "dev-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeLedgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ledger-1",
    organizationId: "org-1",
    subscriptionId: "sub-1",
    period: "2026-06",
    category: "WHATSAPP_MESSAGE_OUT",
    amountIdr: new Decimal(500),
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeWhatsappLedgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wa-ledger-1",
    organizationId: "org-1",
    waMessageId: "msg-1",
    phoneNumber: "6281234567890",
    category: "UTILITY",
    quotaKey: "monthly",
    quotaValue: new Decimal(1),
    status: "CHARGED_PENDING_VERIFY",
    isReverted: false,
    revertReason: null,
    revertedAt: null,
    lastStatus: null,
    pricingBillable: null,
    pricingCategory: null,
    errorCode: null,
    errorTitle: null,
    createdAt: new Date("2026-06-15T10:00:00Z"),
    updatedAt: new Date(),
    whatsappDeviceId: "dev-1",
    ...overrides,
  }
}

describe("Usage Routes", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
    mockFindMany.mockImplementation(async () => [])
    mockFindManyDevices.mockReset()
    mockFindManyDevices.mockImplementation(async () => [])
    mockFindManyWhatsappLedger.mockReset()
    mockFindManyWhatsappLedger.mockImplementation(async () => [])
    mockFindUniqueBillingAccount.mockReset()
    mockFindUniqueBillingAccount.mockImplementation(async () => null)

    setMockAuthContext({
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  // ── Auth ─────────────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 when auth context is null", async () => {
      setMockAuthContext(null as any)

      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/overview")
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })
  })

  // ── GET /usage/overview ──────────────────────────────────────────────────

  describe("GET /usage/overview", () => {
    it("returns overview with monthly, today, cost, devices", async () => {
      let callIndex = 0
      mockFindMany.mockImplementation(async () => {
        callIndex++
        if (callIndex === 1) return [makeMonthlyCount()]
        if (callIndex === 2) return [makeDailyCount()]
        if (callIndex === 3) return [makeLedgerRow()]
        return []
      })
      mockFindManyDevices.mockImplementation(async () => [
        { id: "dev-1", phoneNumber: "6281234567890" },
      ])

      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/overview")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.month).toHaveLength(1)
      expect(body.today).toHaveLength(1)
      expect(body.cost.totalAmount).toBe(500)
      expect(body.devices).toHaveLength(1)
      expect(body.devices[0].phoneNumber).toBe("6281234567890")
    })

    it("returns empty overview when no data exists", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/overview")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.month).toEqual([])
      expect(body.today).toEqual([])
      expect(body.cost.totalAmount).toBe(0)
      expect(body.devices).toEqual([])
    })
  })

  // ── GET /usage/daily ────────────────────────────────────────────────────

  describe("GET /usage/daily", () => {
    it("returns daily counts", async () => {
      mockFindMany.mockImplementation(async () => [
        makeDailyCount({ id: "dc-1" }),
        makeDailyCount({ id: "dc-2", messageInboxCount: 15 }),
      ])

      const app = createTestApp()
      const res = await app.handle(new Request("http://localhost/usage/daily"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.counts).toHaveLength(2)
      expect(body.counts[0].id).toBe("dc-1")
    })

    it("passes query params to service", async () => {
      mockFindMany.mockImplementation(async () => [])

      const app = createTestApp()
      await app.handle(
        new Request(
          "http://localhost/usage/daily?from=2026-06-01&to=2026-06-30&deviceId=dev-1"
        )
      )

      expect(mockFindMany).toHaveBeenCalled()
    })
  })

  // ── GET /usage/monthly ──────────────────────────────────────────────────

  describe("GET /usage/monthly", () => {
    it("returns monthly counts", async () => {
      mockFindMany.mockImplementation(async () => [makeMonthlyCount()])

      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/monthly?year=2026&month=6")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.counts).toHaveLength(1)
      expect(body.counts[0].year).toBe(2026)
    })
  })

  // ── GET /usage/cost ─────────────────────────────────────────────────────

  describe("GET /usage/cost", () => {
    it("returns cost breakdown for period", async () => {
      mockFindMany.mockImplementation(async () => [
        makeLedgerRow({
          id: "l1",
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(500),
        }),
        makeLedgerRow({
          id: "l2",
          category: "WHATSAPP_MESSAGE_IN",
          amountIdr: new Decimal(300),
        }),
      ])

      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/cost?period=2026-06")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.totalAmount).toBe(800)
      expect(body.totalEntries).toBe(2)
      expect(body.byCategory).toHaveLength(2)
    })

    it("returns 422 when period is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(new Request("http://localhost/usage/cost"))

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns zero values when no records", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/cost?period=2026-06")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.totalAmount).toBe(0)
      expect(body.totalEntries).toBe(0)
      expect(body.byCategory).toEqual([])
    })
  })

  // ── GET /usage/cost-breakdown ────────────────────────────────────────────

  describe("GET /usage/cost-breakdown", () => {
    it("returns 200 with empty byDevice for no records", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/cost-breakdown?period=2026-06")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.byDevice).toEqual([])
      expect(body.totalCost).toBe(0)
      expect(body.balance).toBeNull()
    })

    it("returns cost and quota values for a device with ledger rows", async () => {
      // Set up devices
      mockFindManyDevices.mockImplementation(async () => [
        { id: "dev-1", phoneNumber: "6281234567890", quotaBase: new Decimal(100) },
      ])

      // Set up usage ledger rows (cost + messageCount, keyed by metadata.deviceId)
      mockFindMany.mockImplementation(async () => [
        makeLedgerRow({
          id: "ledger-1",
          metadata: { deviceId: "dev-1" },
          amountIdr: new Decimal(500),
        }),
        makeLedgerRow({
          id: "ledger-2",
          metadata: { deviceId: "dev-1" },
          amountIdr: new Decimal(300),
        }),
      ])

      // Set up WhatsApp billing ledger rows (quota credits, keyed by whatsappDeviceId)
      mockFindManyWhatsappLedger.mockImplementation(async () => [
        makeWhatsappLedgerRow({
          id: "wa-1",
          whatsappDeviceId: "dev-1",
          quotaValue: new Decimal(2),
          createdAt: new Date("2026-06-10T10:00:00Z"),
        }),
        makeWhatsappLedgerRow({
          id: "wa-2",
          whatsappDeviceId: "dev-1",
          quotaValue: new Decimal(1.5),
          createdAt: new Date("2026-06-15T10:00:00Z"),
        }),
      ])

      // Set up billing account
      mockFindUniqueBillingAccount.mockImplementation(async () => ({
        balance: new Decimal(1000000),
        currency: "IDR",
      }))

      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/cost-breakdown?period=2026-06")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.totalCost).toBe(800)
      const dev1 = body.byDevice.find((d: any) => d.deviceId === "dev-1")
      expect(dev1).toBeDefined()
      expect(dev1.quotaUsed).toBe(3.5)
      expect(dev1.messageCount).toBe(2)
      expect(dev1.totalCost).toBe(800)
      expect(dev1.quotaBase).toBe(100)
      expect(dev1.quotaPercent).toBeCloseTo(3.5)
      expect(body.balance).toBe(1000000)
    })

    it("returns 422 for invalid period format", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/cost-breakdown?period=2026")
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe("period query param must use YYYY-MM.")
    })

    it("uses current period when period is omitted", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/usage/cost-breakdown")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.period).toBeDefined()
    })
  })
})
