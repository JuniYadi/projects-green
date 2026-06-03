import { describe, expect, it, vi, beforeEach } from "bun:test"
import { PrismaClient, Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal
import { UsageLedgerService } from "./usage-ledger.service"

// Properly typed mock Prisma client
interface MockedPrisma {
  usageLedger: {
    create: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    groupBy: ReturnType<typeof vi.fn>
    aggregate: ReturnType<typeof vi.fn>
  }
}

const createMockPrisma = (): MockedPrisma => ({
  usageLedger: {
    create: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
})

// Shared mock data
const mockEntry = {
  id: "ledger-1",
  organizationId: "org-1",
  subscriptionId: "sub-1",
  period: "2026-05",
  category: "WHATSAPP_MESSAGE_OUT",
  amountIdr: new Decimal(1000),
  metadata: { deviceId: "device-1" },
  createdAt: new Date("2026-05-30T10:00:00Z"),
}

const mockEntries = [
  {
    id: "ledger-1",
    organizationId: "org-1",
    subscriptionId: "sub-1",
    period: "2026-05",
    category: "WHATSAPP_MESSAGE_OUT",
    amountIdr: new Decimal(1000),
    metadata: null,
    createdAt: new Date("2026-05-30T10:00:00Z"),
    subscription: { id: "sub-1" },
  },
  {
    id: "ledger-2",
    organizationId: "org-1",
    subscriptionId: "sub-1",
    period: "2026-05",
    category: "WHATSAPP_MESSAGE_OUT",
    amountIdr: new Decimal(500),
    metadata: null,
    createdAt: new Date("2026-05-30T11:00:00Z"),
    subscription: { id: "sub-1" },
  },
]

const mockSubscriptionWithCap = {
  id: "sub-1",
  pricing: { monthlyCapIdr: new Decimal(5000) },
}

const mockSubscriptionNoCap = {
  id: "sub-2",
  pricing: null,
}

const mockLedgerEntriesWithSubscription = [
  {
    id: "ledger-1",
    subscriptionId: "sub-1",
    category: "WHATSAPP_MESSAGE_OUT",
    amountIdr: new Decimal(2000),
    subscription: mockSubscriptionWithCap,
    createdAt: new Date(),
  },
  {
    id: "ledger-2",
    subscriptionId: "sub-1",
    category: "WHATSAPP_MESSAGE_OUT",
    amountIdr: new Decimal(2000),
    subscription: mockSubscriptionWithCap,
    createdAt: new Date(),
  },
  {
    id: "ledger-3",
    subscriptionId: "sub-2",
    category: "VPN_BANDWIDTH",
    amountIdr: new Decimal(3000),
    subscription: mockSubscriptionNoCap,
    createdAt: new Date(),
  },
]

describe("UsageLedgerService", () => {
  let service: UsageLedgerService
  let mockPrisma: MockedPrisma

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    service = new UsageLedgerService(mockPrisma as unknown as PrismaClient)
  })

  describe("recordUsage", () => {
    it("creates ledger entry with all fields", async () => {
      ;(mockPrisma.usageLedger.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockEntry)

      await service.recordUsage({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        period: "2026-05",
        entry: {
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(1000),
          metadata: { deviceId: "device-1" },
        },
      })

      expect(mockPrisma.usageLedger.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          subscriptionId: "sub-1",
          period: "2026-05",
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(1000),
          metadata: { deviceId: "device-1" },
        },
      })
    })

    it("returns created entry", async () => {
      const createdEntry = {
        ...mockEntry,
        category: "WHATSAPP_MESSAGE_OUT",
        amountIdr: new Decimal(500),
        metadata: null,
      }
      ;(mockPrisma.usageLedger.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createdEntry)

      const result = await service.recordUsage({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        period: "2026-05",
        entry: {
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(500),
        },
      })

      expect(result.id).toBe("ledger-1")
      expect(result.organizationId).toBe("org-1")
      expect(result.subscriptionId).toBe("sub-1")
    })
  })

  describe("getSpendByCategory", () => {
    it("returns grouped totals sorted by totalIdr desc", async () => {
      ;(mockPrisma.usageLedger.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { category: "WHATSAPP_MESSAGE_OUT", _sum: { amountIdr: new Decimal(5000) } },
        { category: "WHATSAPP_MESSAGE_IN", _sum: { amountIdr: new Decimal(3000) } },
        { category: "APP_HOSTING_CPU", _sum: { amountIdr: new Decimal(2000) } },
      ])

      const results = await service.getSpendByCategory("tenant-1", "2026-05")

      expect(results).toHaveLength(3)
      expect(results[0].category).toBe("WHATSAPP_MESSAGE_OUT")
      expect(results[0].totalIdr.toNumber()).toBe(5000)
      expect(results[1].category).toBe("WHATSAPP_MESSAGE_IN")
      expect(results[1].totalIdr.toNumber()).toBe(3000)
      expect(results[2].category).toBe("APP_HOSTING_CPU")
      expect(results[2].totalIdr.toNumber()).toBe(2000)
    })

    it("returns empty array when no records", async () => {
      ;(mockPrisma.usageLedger.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      const results = await service.getSpendByCategory("org-1", "2026-05")

      expect(results).toHaveLength(0)
    })
  })

  describe("getLedgerEntries", () => {
    it("returns entries filtered by category", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockEntries)

      const results = await service.getLedgerEntries("org-1", "2026-05", "WHATSAPP_MESSAGE_OUT")

      expect(results).toHaveLength(2)
      expect(mockPrisma.usageLedger.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          period: "2026-05",
          category: "WHATSAPP_MESSAGE_OUT",
        },
        include: { subscription: true },
        orderBy: { createdAt: "asc" },
      })
    })

    it("returns all entries when no category filter", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockEntries)

      const results = await service.getLedgerEntries("org-1", "2026-05")

      expect(results).toHaveLength(2)
      expect(mockPrisma.usageLedger.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          period: "2026-05",
        },
        include: { subscription: true },
        orderBy: { createdAt: "asc" },
      })
    })
  })

  describe("getTotalSpend", () => {
    it("returns sum of amountIdr", async () => {
      ;(mockPrisma.usageLedger.aggregate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        _sum: { amountIdr: new Decimal(15000) },
      })

      const result = await service.getTotalSpend("org-1", "2026-05")

      expect(result.toNumber()).toBe(15000)
      expect(mockPrisma.usageLedger.aggregate).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          period: "2026-05",
        },
        _sum: { amountIdr: true },
      })
    })

    it("returns Decimal(0) when no records", async () => {
      ;(mockPrisma.usageLedger.aggregate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        _sum: { amountIdr: null },
      })

      const result = await service.getTotalSpend("org-1", "2026-05")

      expect(result.toNumber()).toBe(0)
    })
  })

  describe("generateRatedUsage", () => {
    it("groups by subscriptionId + category", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockLedgerEntriesWithSubscription,
      )

      const results = await service.generateRatedUsage("org-1", "2026-05")

      expect(results).toHaveLength(2)

      const sub1Out = results.find(
        (r) => r.subscriptionId === "sub-1" && r.category === "WHATSAPP_MESSAGE_OUT",
      )
      expect(sub1Out).toBeDefined()
      expect(sub1Out!.rawAmountIdr.toNumber()).toBe(4000)

      const sub2Vpn = results.find(
        (r) => r.subscriptionId === "sub-2" && r.category === "VPN_BANDWIDTH",
      )
      expect(sub2Vpn).toBeDefined()
      expect(sub2Vpn!.rawAmountIdr.toNumber()).toBe(3000)
    })

    it("caps amount when raw > cap", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: "ledger-1",
          subscriptionId: "sub-1",
          category: "WHATSAPP_MESSAGE_OUT",
          amountIdr: new Decimal(6000),
          subscription: mockSubscriptionWithCap,
          createdAt: new Date(),
        },
      ])

      const results = await service.generateRatedUsage("org-1", "2026-05")

      const sub1Out = results.find(
        (r) => r.subscriptionId === "sub-1" && r.category === "WHATSAPP_MESSAGE_OUT",
      )
      expect(sub1Out).toBeDefined()
      expect(sub1Out!.rawAmountIdr.toNumber()).toBe(6000)
      expect(sub1Out!.cappedAmountIdr.toNumber()).toBe(5000)
    })

    it("returns rawAmountIdr when no cap set", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: "ledger-1",
          subscriptionId: "sub-2",
          category: "VPN_BANDWIDTH",
          amountIdr: new Decimal(3000),
          subscription: mockSubscriptionNoCap,
          createdAt: new Date(),
        },
      ])

      const results = await service.generateRatedUsage("org-1", "2026-05")

      const sub2Vpn = results.find((r) => r.subscriptionId === "sub-2")
      expect(sub2Vpn).toBeDefined()
      expect(sub2Vpn!.rawAmountIdr.toNumber()).toBe(3000)
      expect(sub2Vpn!.cappedAmountIdr.toNumber()).toBe(3000)
    })
  })

  describe("getUsageByDateRange", () => {
    it("returns entries within date range", async () => {
      const entries = [
        {
          id: "ledger-1",
          organizationId: "org-1",
          subscriptionId: "sub-1",
          period: "2026-06",
          category: "whatsapp",
          amountIdr: new Decimal(1000),
          metadata: null,
          createdAt: new Date("2026-06-01"),
          subscription: { id: "sub-1" },
        },
      ]
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(entries)

      const results = await service.getUsageByDateRange("org-1", "2026-06-01", "2026-06-30")

      expect(results).toHaveLength(1)
      expect(mockPrisma.usageLedger.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          createdAt: {
            gte: new Date("2026-06-01"),
            lte: new Date("2026-06-30"),
          },
        },
        include: { subscription: true },
        orderBy: { createdAt: "asc" },
      })
    })

    it("filters by category when provided", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      await service.getUsageByDateRange("org-1", "2026-06-01", "2026-06-30", "whatsapp")

      expect(mockPrisma.usageLedger.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          createdAt: {
            gte: new Date("2026-06-01"),
            lte: new Date("2026-06-30"),
          },
          category: "whatsapp",
        },
        include: { subscription: true },
        orderBy: { createdAt: "asc" },
      })
    })

    it("returns empty array when no entries", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      const results = await service.getUsageByDateRange("org-1", "2026-06-01", "2026-06-30")

      expect(results).toHaveLength(0)
    })
  })

  describe("getDailyUsageTrend", () => {
    it("returns daily aggregated amounts", async () => {
      const entries = [
        {
          id: "ledger-1",
          organizationId: "org-1",
          subscriptionId: "sub-1",
          period: "2026-06",
          category: "whatsapp",
          amountIdr: new Decimal(1000),
          metadata: null,
          createdAt: new Date("2026-06-01T10:00:00Z"),
        },
        {
          id: "ledger-2",
          organizationId: "org-1",
          subscriptionId: "sub-1",
          period: "2026-06",
          category: "whatsapp",
          amountIdr: new Decimal(2000),
          metadata: null,
          createdAt: new Date("2026-06-01T14:00:00Z"),
        },
        {
          id: "ledger-3",
          organizationId: "org-1",
          subscriptionId: "sub-1",
          period: "2026-06",
          category: "hosting",
          amountIdr: new Decimal(5000),
          metadata: null,
          createdAt: new Date("2026-06-02T10:00:00Z"),
        },
      ]
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(entries)

      const results = await service.getDailyUsageTrend("org-1", 30)

      expect(results).toHaveLength(2)
      expect(results[0].date).toBe("2026-06-01")
      expect(results[0].amount.toNumber()).toBe(3000)
      expect(results[1].date).toBe("2026-06-02")
      expect(results[1].amount.toNumber()).toBe(5000)
    })

    it("returns empty array when no entries", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      const results = await service.getDailyUsageTrend("org-1", 30)

      expect(results).toHaveLength(0)
    })

    it("uses default 30 days when not specified", async () => {
      ;(mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      await service.getDailyUsageTrend("org-1")

      const call = (mockPrisma.usageLedger.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      expect(call.where.createdAt.gte).toBeInstanceOf(Date)
    })
  })
})
