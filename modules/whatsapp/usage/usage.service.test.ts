import { beforeEach, describe, expect, it, mock } from "bun:test"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

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

const { WhatsappUsageService } = await import("./usage.service")

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

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("WhatsappUsageService", () => {
  let service: InstanceType<typeof WhatsappUsageService>

  beforeEach(() => {
    service = new WhatsappUsageService()
    mockFindMany.mockReset()
    mockFindMany.mockImplementation(async () => [])
    mockFindManyDevices.mockReset()
    mockFindManyDevices.mockImplementation(async () => [])
    mockFindManyWhatsappLedger.mockReset()
    mockFindManyWhatsappLedger.mockImplementation(async () => [])
    mockFindUniqueBillingAccount.mockReset()
    mockFindUniqueBillingAccount.mockImplementation(async () => null)
  })

  // ── getDailyCounts ────────────────────────────────────────────────────────

  describe("getDailyCounts", () => {
    it("queries with organizationId only when no opts", async () => {
      mockFindMany.mockImplementation(async () => [makeDailyCount()])

      const result = await service.getDailyCounts("org-1")

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("dc-1")
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { date: "asc" },
      })
    })

    it("queries with date range filter", async () => {
      await service.getDailyCounts("org-1", {
        from: "2026-06-01",
        to: "2026-06-30",
      })

      const call = (mockFindMany.mock.calls[0] as any[])[0]
      expect(call.where.organizationId).toBe("org-1")
      expect(call.where.date).toEqual({
        gte: new Date("2026-06-01"),
        lte: new Date("2026-06-30"),
      })
    })

    it("queries with deviceId filter", async () => {
      await service.getDailyCounts("org-1", { deviceId: "dev-1" })

      const call = (mockFindMany.mock.calls[0] as any[])[0]
      expect(call.where.whatsappDeviceId).toBe("dev-1")
    })

    it("returns empty array when no records", async () => {
      const result = await service.getDailyCounts("org-1")
      expect(result).toEqual([])
    })
  })

  // ── getMonthlyCounts ─────────────────────────────────────────────────────

  describe("getMonthlyCounts", () => {
    it("queries with organizationId only when no opts", async () => {
      mockFindMany.mockImplementation(async () => [makeMonthlyCount()])

      const result = await service.getMonthlyCounts("org-1")

      expect(result).toHaveLength(1)
      expect(result[0].year).toBe(2026)
    })

    it("queries with year and month filter", async () => {
      await service.getMonthlyCounts("org-1", { year: 2026, month: 6 })

      const call = (mockFindMany.mock.calls[0] as any[])[0]
      expect(call.where.year).toBe(2026)
      expect(call.where.month).toBe(6)
    })

    it("queries with deviceId filter", async () => {
      await service.getMonthlyCounts("org-1", { deviceId: "dev-1" })

      const call = (mockFindMany.mock.calls[0] as any[])[0]
      expect(call.where.whatsappDeviceId).toBe("dev-1")
    })
  })

  // ── getCostSummary ───────────────────────────────────────────────────────

  describe("getCostSummary", () => {
    it("returns total amount and per-category breakdown", async () => {
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
        makeLedgerRow({
          id: "l3",
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(200),
        }),
      ])

      const result = await service.getCostSummary("org-1", "2026-06")

      expect(result.totalAmount).toBe(1000)
      expect(result.totalEntries).toBe(3)
      expect(result.byCategory).toHaveLength(2)

      const outCat = result.byCategory.find(
        (c) => c.category === "WHATSAPP_MESSAGE_OUT"
      )
      expect(outCat).toBeDefined()
      expect(outCat!.count).toBe(2)
      expect(outCat!.totalCost).toBe(700)

      const inCat = result.byCategory.find(
        (c) => c.category === "WHATSAPP_MESSAGE_IN"
      )
      expect(inCat).toBeDefined()
      expect(inCat!.count).toBe(1)
      expect(inCat!.totalCost).toBe(300)
    })

    it("returns zero values when no records", async () => {
      const result = await service.getCostSummary("org-1", "2026-06")

      expect(result.totalAmount).toBe(0)
      expect(result.totalEntries).toBe(0)
      expect(result.byCategory).toEqual([])
    })
  })

  // ── getCategoryBreakdown ─────────────────────────────────────────────────

  describe("getCategoryBreakdown", () => {
    it("groups entries by category", async () => {
      mockFindMany.mockImplementation(async () => [
        makeLedgerRow({
          id: "l1",
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(100),
        }),
        makeLedgerRow({
          id: "l2",
          category: "WHATSAPP_MESSAGE_IN",
          amountIdr: new Decimal(200),
        }),
        makeLedgerRow({
          id: "l3",
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(150),
        }),
      ])

      const result = await service.getCategoryBreakdown("org-1", "2026-06")

      expect(result).toHaveLength(2)

      const outCat = result.find((c) => c.category === "WHATSAPP_MESSAGE_OUT")
      expect(outCat!.count).toBe(2)
      expect(outCat!.totalCost).toBe(250)

      const inCat = result.find((c) => c.category === "WHATSAPP_MESSAGE_IN")
      expect(inCat!.count).toBe(1)
      expect(inCat!.totalCost).toBe(200)
    })

    it("returns empty array when no records", async () => {
      const result = await service.getCategoryBreakdown("org-1", "2026-06")
      expect(result).toEqual([])
    })
  })

  // ── getUsageOverview ─────────────────────────────────────────────────────

  describe("getUsageOverview", () => {
    it("combines monthly counts, today counts, cost, and devices", async () => {
      const monthlyRow = makeMonthlyCount({
        id: "mc-1",
        whatsappDeviceId: "dev-1",
        messageInboxCount: 50,
        messageOutboxCount: 100,
        sessionCount: 10,
        messageFailedCount: 2,
      })
      const todayRow = makeDailyCount({
        id: "dc-today",
        whatsappDeviceId: "dev-1",
      })
      const ledgerRow = makeLedgerRow()

      // First call: monthlyCounts, second: todayCounts, third:
      // costSummary findMany, fourth: devices
      let callIndex = 0
      mockFindMany.mockImplementation(async () => {
        callIndex++
        if (callIndex === 1) return [monthlyRow]
        if (callIndex === 2) return [todayRow]
        if (callIndex === 3) return [ledgerRow]
        return []
      })

      mockFindManyDevices.mockImplementation(async () => [
        { id: "dev-1", phoneNumber: "6281234567890" },
      ])

      const result = await service.getUsageOverview("org-1")

      // Monthly counts
      expect(result.month).toHaveLength(1)
      expect(result.month[0].messageOutboxCount).toBe(100)

      // Today counts
      expect(result.today).toHaveLength(1)
      expect(result.today[0].id).toBe("dc-today")

      // Cost
      expect(result.cost.totalAmount).toBe(500)
      expect(result.cost.totalEntries).toBe(1)

      // Devices
      expect(result.devices).toHaveLength(1)
      expect(result.devices[0].deviceId).toBe("dev-1")
      expect(result.devices[0].phoneNumber).toBe("6281234567890")
      expect(result.devices[0].messageOutboxCount).toBe(100)
    })

    it("returns empty arrays when no records exist", async () => {
      const result = await service.getUsageOverview("org-1")

      expect(result.month).toEqual([])
      expect(result.today).toEqual([])
      expect(result.cost.totalAmount).toBe(0)
      expect(result.cost.totalEntries).toBe(0)
      expect(result.devices).toEqual([])
    })
  })

  // ── getCostBreakdown ────────────────────────────────────────────────────

  describe("getCostBreakdown", () => {
    it("returns empty byDevice when no records", async () => {
      const result = await service.getCostBreakdown("org-1", "2026-06")

      expect(result.period).toBe("2026-06")
      expect(result.byDevice).toEqual([])
      expect(result.totalCost).toBe(0)
      expect(result.balance).toBeNull()
    })

    it("returns cost and quota values for a device with ledger rows", async () => {
      // Set up devices
      mockFindManyDevices.mockImplementation(async () => [
        {
          id: "dev-1",
          phoneNumber: "6281234567890",
          quotaBase: new Decimal(100),
        },
      ])

      // Set up usage ledger rows (for cost + messageCount, keyed by metadata.deviceId)
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

      // Set up WhatsApp billing ledger rows (for quota credits, keyed by whatsappDeviceId)
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

      const result = await service.getCostBreakdown("org-1", "2026-06")

      // Cost should come from BillingUsageLedger
      expect(result.totalCost).toBe(800)
      // Quota used should come from WhatsappBillingLedger.quotaValue
      const dev1 = result.byDevice.find((d) => d.deviceId === "dev-1")
      expect(dev1).toBeDefined()
      expect(dev1!.quotaUsed).toBe(3.5)
      expect(dev1!.messageCount).toBe(2)
      expect(dev1!.totalCost).toBe(800)
      expect(dev1!.quotaBase).toBe(100)
      expect(dev1!.quotaPercent).toBeCloseTo(3.5)
      expect(result.balance).toBe(1000000)
    })

    it("groups unknown devices when both device IDs are absent", async () => {
      mockFindManyDevices.mockImplementation(async () => [])

      // metadata.deviceId absent → cost map key = "unknown"
      mockFindMany.mockImplementation(async () => [
        makeLedgerRow({
          id: "ledger-1",
          metadata: null, // no deviceId in metadata → maps to "unknown"
          amountIdr: new Decimal(200),
        }),
      ])

      // whatsappDeviceId null → quota map key = "unknown"
      mockFindManyWhatsappLedger.mockImplementation(async () => [
        makeWhatsappLedgerRow({
          id: "wa-1",
          whatsappDeviceId: null,
          quotaValue: new Decimal(1.25),
          createdAt: new Date("2026-06-10T10:00:00Z"),
        }),
      ])

      const result = await service.getCostBreakdown("org-1", "2026-06")

      // Both maps use "unknown" as key, so they join
      expect(result.byDevice).toHaveLength(1)
      expect(result.byDevice[0].deviceId).toBe("unknown")
      expect(result.byDevice[0].quotaUsed).toBeCloseTo(1.25)
    })

    it("returns null balance when billing account is missing", async () => {
      mockFindManyDevices.mockImplementation(async () => [
        { id: "dev-1", phoneNumber: "6281234567890", quotaBase: new Decimal(100) },
      ])
      mockFindMany.mockImplementation(async () => [])
      mockFindManyWhatsappLedger.mockImplementation(async () => [])
      mockFindUniqueBillingAccount.mockImplementation(async () => null)

      const result = await service.getCostBreakdown("org-1", "2026-06")

      expect(result.balance).toBeNull()
    })
  })
})
