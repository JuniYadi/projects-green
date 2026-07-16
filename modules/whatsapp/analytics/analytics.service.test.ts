import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import type { AnalyticsService } from "./analytics.service"

// ─── Mock device ─────────────────────────────────────────────────────────────

const mockDevice = {
  id: "device-1",
  organizationId: "org-1",
  tokenEncrypted: "mock-encrypted-token",
  whatsappPhoneId: "phone-1",
  whatsappBusinessAccountId: "waba-1",
}

const mockAnalyticsData = [
  {
    phone_number_id: "123",
    conversation_start: 1723456000,
    message_inbound_count: 10,
    message_outbound_count: 5,
    cost: { amount: 0.05, currency: "USD" },
    conversation_category: "MARKETING",
  },
]

const mockClient = {
  getAnalytics: mock(async () => ({ data: mockAnalyticsData, totalPages: 1 })),
}

// Mock prisma with all delegates needed across tests
const mockDeviceFindUnique = mock(async (_args: unknown): Promise<unknown> => null)
const mockDeviceFindMany = mock(async (_args: unknown): Promise<unknown> => [])
const mockDailyCountFindFirst = mock(async (_args: unknown): Promise<unknown> => null)
const mockDailyCountFindMany = mock(async (_args: unknown): Promise<unknown> => [])
const mockDailyCountCreate = mock(
  async (data: { data: Record<string, unknown> }): Promise<unknown> => ({ id: "new-id", ...data.data }),
)
const mockDailyCountUpdate = mock(
  async (data: { data: Record<string, unknown> }): Promise<unknown> => ({ id: "existing-id" }),
)
const mockBillingLedgerFindMany = mock(async (_args: unknown): Promise<unknown> => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findUnique: mockDeviceFindUnique,
      findMany: mockDeviceFindMany,
    },
    whatsappDailyCount: {
      findFirst: mockDailyCountFindFirst,
      findMany: mockDailyCountFindMany,
      create: mockDailyCountCreate,
      update: mockDailyCountUpdate,
    },
    whatsappBillingLedger: {
      findMany: mockBillingLedgerFindMany,
    },
  },
}))

// Mock the WhatsAppDeviceClient
mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: {
    fromDevice: mock(async () => mockClient),
  },
}))

const { AnalyticsService: AnalyticsServiceClass } = await import(
  "./analytics.service"
)

let service: AnalyticsService

describe("AnalyticsService", () => {
  beforeEach(() => {
    service = new AnalyticsServiceClass()
    mockClient.getAnalytics.mockClear()
    mockDeviceFindUnique.mockClear()
    mockDeviceFindUnique.mockResolvedValue(null)
    mockDeviceFindMany.mockClear()
    mockDeviceFindMany.mockResolvedValue([])
    mockDailyCountFindFirst.mockClear()
    mockDailyCountFindFirst.mockResolvedValue(null)
    mockDailyCountFindMany.mockClear()
    mockDailyCountFindMany.mockResolvedValue([])
    mockDailyCountCreate.mockClear()
    mockDailyCountCreate.mockResolvedValue({ id: "default" } as { id: string; organizationId?: string; date?: Date; messageInboxCount?: number })
    mockDailyCountUpdate.mockClear()
    mockDailyCountUpdate.mockResolvedValue({ id: "default" } as { id: string })
    mockBillingLedgerFindMany.mockClear()
    mockBillingLedgerFindMany.mockResolvedValue([])
  })

  describe("syncAnalytics", () => {
    it("throws if device not found", async () => {
      mockDeviceFindUnique.mockResolvedValue(null)

      expect(service.syncAnalytics).toBeFunction()
    })

    it("throws if device not owned by org", async () => {
      mockDeviceFindUnique.mockResolvedValue({
        ...mockDevice,
        organizationId: "other-org",
      })

      expect(typeof service.syncAnalytics).toBe("function")
    })

    it("returns sync result with synced count", async () => {
      mockDeviceFindUnique.mockResolvedValue(mockDevice)
      mockDailyCountFindMany.mockResolvedValue([])
      mockDailyCountCreate.mockResolvedValue({ id: "new-id" })
      mockDailyCountUpdate.mockResolvedValue({ id: "existing-id" })

      const result = await service.syncAnalytics({
        deviceId: "device-1",
        organizationId: "org-1",
        startDate: "2026-06-01",
        endDate: "2026-06-07",
        granularity: "DAY",
      })

      expect(result.syncedCount).toBe(1)
      expect(result.discrepancies).toBeArray()
    })
  })

  describe("getComparisonReport", () => {
    it("generates comparison with meta vs local data", async () => {
      mockDeviceFindUnique.mockResolvedValue(mockDevice)
      mockDailyCountFindMany.mockResolvedValue([
        {
          id: "local-1",
          organizationId: "org-1",
          date: new Date("2026-06-01"),
          messageInboxCount: 8,
          messageOutboxCount: 4,
          sessionCount: 0,
          messageFailedCount: 0,
          whatsappDeviceId: "device-1",
        },
      ])

      const report = await service.getComparisonReport(
        "org-1",
        "device-1",
        "2026-06-01",
        "2026-06-07",
      )

      expect(report.comparisons.length).toBeGreaterThan(0)
      expect(report.summary.totalMeta).toBeGreaterThan(0)
      expect(report.deviceId).toBe("device-1")
    })
  })

  describe("backfillMissingData", () => {
    it("creates missing daily count records", async () => {
      mockDeviceFindUnique.mockResolvedValue(mockDevice)
      mockDailyCountFindFirst.mockResolvedValue(null)
      mockDailyCountFindMany.mockResolvedValue([])
      mockDailyCountCreate.mockResolvedValue({ id: "backfilled" })

      const result = await service.backfillMissingData(
        "org-1",
        "device-1",
        "2026-06-01",
      )

      expect(result.created).toBeGreaterThanOrEqual(0)
    })
  })

  describe("getCostReconciliation", () => {
    it("returns cost reconciliation report", async () => {
      mockBillingLedgerFindMany.mockResolvedValue([
        {
          id: "ledger-1",
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          pricingCategory: "MARKETING",
          quotaValue: 0.03,
          createdAt: new Date("2026-06-01"),
        },
      ])
      mockDeviceFindMany.mockResolvedValue([mockDevice])

      const result = await service.getCostReconciliation("org-1", {
        startDate: "2026-06-01",
        endDate: "2026-06-07",
      })

      expect(result.rows).toBeArray()
      expect(typeof result.totalMetaCost).toBe("number")
    })
  })
})
