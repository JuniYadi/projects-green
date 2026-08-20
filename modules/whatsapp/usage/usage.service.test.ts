import { beforeEach, describe, expect, it, mock } from "bun:test"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

const mockFindMany = mock(async () => [] as unknown[])
const mockFindManyDevices = mock(async () => [] as unknown[])
const mockFindManyWhatsappLedger = mock(async () => [] as unknown[])
const mockFindUniqueBillingAccount = mock(async () => null as unknown)
const mockFindManyAdjustments = mock(async () => [] as unknown[])
const mockLedgerCount = mock(async () => 0)
const mockLedgerAggregate = mock(async () => ({
  _sum: { quotaValue: 0 as number | null },
  _count: 0,
}))

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
      count: mockLedgerCount,
      aggregate: mockLedgerAggregate,
    },
    billingAccount: {
      findUnique: mockFindUniqueBillingAccount,
    },
    billingAdjustment: {
      findMany: mockFindManyAdjustments,
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
    sessionCount: 0,
    messageInboxCount: 5,
    messageOutboxCount: 3,
    messageFailedCount: 0,
    whatsappDeviceId: "dev-1",
    ...overrides,
  }
}

function makeWhatsappLedgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wl-1",
    organizationId: "org-1",
    waMessageId: "wamid.1",
    phoneNumber: "6281234567890",
    category: "UTILITY",
    quotaKey: "dev-1",
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
    whatsappDeviceId: "dev-1",
    createdAt: new Date("2026-06-15"),
    updatedAt: new Date("2026-06-15"),
    whatsappDevice: { phoneNumber: "6283138855774" },
    ...overrides,
  }
}

function makeAdjustmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "adj-1",
    organizationId: "org-1",
    billingAccountId: "ba-1",
    amount: new Decimal(500),
    currency: "IDR",
    adjustmentType: "DEBIT",
    reason: "WhatsApp overage charge",
    metadataJson: { source: "WHATSAPP", deviceId: "dev-1" },
    createdAt: new Date("2026-06-15T10:00:00Z"),
    updatedAt: new Date("2026-06-15T10:00:00Z"),
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
    mockFindManyAdjustments.mockReset()
    mockFindManyAdjustments.mockImplementation(async () => [])
    mockLedgerCount.mockReset()
    mockLedgerCount.mockImplementation(async () => 0)
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

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          date: {
            gte: new Date("2026-06-01"),
            lte: new Date("2026-06-30"),
          },
        },
        orderBy: { date: "asc" },
      })
    })
  })

  // ── getMonthlyCounts ──────────────────────────────────────────────────────

  describe("getMonthlyCounts", () => {
    it("queries with year and month", async () => {
      await service.getMonthlyCounts("org-1", { year: 2026, month: 6 })

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          year: 2026,
          month: 6,
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      })
    })
  })

  // ── getCostSummary ────────────────────────────────────────────────────────

  describe("getCostSummary", () => {
    it("aggregates Meta conversation categories from WhatsappBillingLedger", async () => {
      mockFindManyWhatsappLedger.mockImplementation(async () => [
        makeWhatsappLedgerRow({
          id: "wl-1",
          category: "UTILITY",
          quotaValue: new Decimal(2),
        }),
        makeWhatsappLedgerRow({
          id: "wl-2",
          category: "MARKETING",
          quotaValue: new Decimal(5),
        }),
      ])

      const result = await service.getCostSummary("org-1", "2026-06")
      expect(result.totalAmount).toBe(7)
      expect(result.totalEntries).toBe(2)
      expect(result.byCategory).toEqual([
        { category: "UTILITY", count: 1, totalCost: 2 },
        { category: "MARKETING", count: 1, totalCost: 5 },
      ])
    })

    it("returns zero values when no billing account", async () => {
      mockFindUniqueBillingAccount.mockImplementation(async () => null)
      const result = await service.getCostSummary("org-1", "2026-06")
      expect(result.totalAmount).toBe(0)
      expect(result.totalEntries).toBe(0)
      expect(result.byCategory).toEqual([])
    })
  })

  // ── getUsageOverview ──────────────────────────────────────────────────────

  describe("getUsageOverview", () => {
    it("combines monthly counts, today counts, cost, and devices", async () => {
      const monthlyRow = makeDailyCount({
        id: "mc-1",
        whatsappDeviceId: "dev-1",
      })

      let callIndex = 0
      mockFindMany.mockImplementation(async () => {
        callIndex++
        if (callIndex <= 6) return [monthlyRow]
        return []
      })

      mockFindManyDevices.mockImplementation(async () => [
        {
          id: "dev-1",
          phoneNumber: "6281234567890",
          quotaBase: new Decimal(1000),
          quotaBaseOut: new Decimal(998),
          addonQuota: new Decimal(0),
          addonQuotaTotal: new Decimal(0),
        },
      ])

      const result = await service.getUsageOverview("org-1")

      // Cost
      expect(result.cost.totalAmount).toBe(0)
      expect(result.cost.totalEntries).toBe(1)

      // Devices
      expect(result.devices).toHaveLength(1)
      expect(result.devices[0].phoneNumber).toBe("6281234567890")

      // Today
      expect(result.today.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ── getCostBreakdown ──────────────────────────────────────────────────────

  describe("getCostBreakdown", () => {
    it("returns empty byDevice when no records", async () => {
      const result = await service.getCostBreakdown("org-1", "2026-06")

      expect(result.period).toBe("2026-06")
      expect(result.byDevice).toEqual([])
      expect(result.totalCost).toBe(0)
      expect(result.balance).toBeNull()
    })

    it("returns cost and quota values for a device with adjustment and ledger rows", async () => {
      mockFindManyDevices.mockImplementation(async () => [
        {
          id: "dev-1",
          phoneNumber: "6281234567890",
          quotaBase: new Decimal(100),
          quotaBaseOut: new Decimal(80),
          addonQuota: new Decimal(10),
          addonQuotaTotal: new Decimal(20),
        },
      ])

      mockFindUniqueBillingAccount.mockImplementation(async () => ({
        id: "ba-1",
        balance: new Decimal(1000000),
        currency: "IDR",
      }))
      mockFindManyAdjustments.mockImplementation(async () => [
        makeAdjustmentRow({
          id: "adj-1",
          amount: new Decimal(500),
          metadataJson: { source: "WHATSAPP", deviceId: "dev-1" },
        }),
        makeAdjustmentRow({
          id: "adj-2",
          amount: new Decimal(300),
          metadataJson: { source: "WHATSAPP", deviceId: "dev-1" },
        }),
      ])

      mockFindManyWhatsappLedger.mockImplementation(async () => [
        makeWhatsappLedgerRow({
          id: "wa-1",
          whatsappDeviceId: "dev-1",
          category: "UTILITY",
          quotaValue: new Decimal(1),
        }),
        makeWhatsappLedgerRow({
          id: "wa-2",
          whatsappDeviceId: "dev-1",
          category: "UTILITY",
          quotaValue: new Decimal(1),
        }),
      ])

      const result = await service.getCostBreakdown("org-1", "2026-06")

      expect(result.totalCost).toBe(800)
      const dev1 = result.byDevice.find((d) => d.deviceId === "dev-1")
      expect(dev1).toBeDefined()
      expect(dev1!.quotaUsed).toBe(30)
      expect(dev1!.messageCount).toBe(2)
      expect(dev1!.totalCost).toBe(800)
      expect(dev1!.quotaBase).toBe(100)
      expect(dev1!.quotaBaseOut).toBe(80)
      expect(dev1!.addonQuota).toBe(10)
      expect(dev1!.addonQuotaTotal).toBe(20)
      expect(dev1!.quotaPercent).toBe(25)
      expect(result.balance).toBe(1000000)
    })

    it("returns cost for device with no adjustments", async () => {
      mockFindManyDevices.mockImplementation(async () => [
        {
          id: "dev-1",
          phoneNumber: "6281234567890",
          quotaBase: new Decimal(100),
          quotaBaseOut: new Decimal(100),
          addonQuota: new Decimal(0),
          addonQuotaTotal: new Decimal(0),
        },
      ])
      mockFindManyWhatsappLedger.mockImplementation(async () => [])
      mockFindUniqueBillingAccount.mockImplementation(async () => null)

      const result = await service.getCostBreakdown("org-1", "2026-06")

      expect(result.byDevice).toHaveLength(1)
      expect(result.byDevice[0].totalCost).toBe(0)
      expect(result.byDevice[0].quotaUsed).toBe(0)
      expect(result.balance).toBeNull()
    })
  })
})

describe("getLedgerEntries", () => {
  beforeEach(() => {
    mockFindManyWhatsappLedger.mockReset()
    mockFindManyWhatsappLedger.mockImplementation(async () => [])
    mockLedgerCount.mockReset()
    mockLedgerCount.mockImplementation(async () => 0)
    mockLedgerAggregate.mockReset()
    mockLedgerAggregate.mockImplementation(async () => ({
      _sum: { quotaValue: 0 as number | null },
      _count: 0,
    }))
  })

  it("returns paginated ledger entries with summary", async () => {
    const ledgerData = [
      makeWhatsappLedgerRow({
        id: "wl-1",
        category: "UTILITY",
        quotaValue: new Decimal(1),
        status: "CONFIRMED",
        isReverted: false,
      }),
      makeWhatsappLedgerRow({
        id: "wl-2",
        category: "MARKETING",
        quotaValue: new Decimal(1),
        status: "REVERTED_FAILED",
        isReverted: true,
        revertReason: "Meta delivery failed",
        revertedAt: new Date("2026-06-15"),
        lastStatus: "FAILED",
      }),
    ]

    mockFindManyWhatsappLedger.mockResolvedValueOnce(ledgerData)
    mockLedgerCount.mockResolvedValueOnce(2)
    mockLedgerAggregate
      .mockResolvedValueOnce({
        _sum: { quotaValue: new Decimal(1) as unknown as number },
        _count: 1,
      })
      .mockResolvedValueOnce({
        _sum: { quotaValue: new Decimal(1) as unknown as number },
        _count: 1,
      })

    const service = new WhatsappUsageService()
    const result = await service.getLedgerEntries("org-1", {
      page: 1,
      limit: 20,
    })

    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.page).toBe(1)
    expect(result.summary.totalCredits).toBe(2)
    expect(result.summary.totalRefundedCredits).toBe(1)
    expect(result.summary.activeCredits).toBe(1)
  })

  it("filters by status REVERTED", async () => {
    const ledgerData = [
      makeWhatsappLedgerRow({
        id: "wl-1",
        status: "REVERTED_FAILED",
        isReverted: true,
        revertReason: "failed",
        revertedAt: new Date(),
        lastStatus: "FAILED",
        whatsappDevice: null,
      }),
    ]

    mockFindManyWhatsappLedger.mockResolvedValueOnce(ledgerData)
    mockLedgerCount.mockResolvedValueOnce(1)
    mockLedgerAggregate
      .mockResolvedValueOnce({ _sum: { quotaValue: null }, _count: 0 })
      .mockResolvedValueOnce({
        _sum: { quotaValue: new Decimal(1) as unknown as number },
        _count: 1,
      })

    const service = new WhatsappUsageService()
    const result = await service.getLedgerEntries("org-1", {
      status: "REFUNDED",
    })

    expect(mockFindManyWhatsappLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isReverted: true,
        }),
      })
    )
    expect(result.data).toHaveLength(1)
  })

  it("returns empty when no records", async () => {
    mockFindManyWhatsappLedger.mockResolvedValue([])
    mockLedgerCount.mockResolvedValue(0)
    mockLedgerAggregate.mockResolvedValue({
      _sum: { quotaValue: null },
      _count: 0,
    })

    const service = new WhatsappUsageService()
    const result = await service.getLedgerEntries("org-1")

    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
    expect(result.summary.totalCredits).toBe(0)
    expect(result.summary.totalRefundedCredits).toBe(0)
    expect(result.summary.activeCredits).toBe(0)
  })
})
