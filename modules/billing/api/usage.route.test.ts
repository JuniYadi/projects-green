import { describe, it, expect, mock, beforeEach } from "bun:test"
import { createUsageRoutes } from "./usage.route"

const mockUsageLedgerService = {
  getUsageByDateRange: mock(() => Promise.resolve([])),
  getSpendByCategory: mock(() => Promise.resolve([])),
  getTotalSpend: mock(() => Promise.resolve(0)),
  getDailyUsageTrend: mock(() => Promise.resolve([])),
}

const mockCostingService = {
  getUsageBreakdown: mock(() => Promise.resolve([])),
}

describe("Usage Routes", () => {
  let routes: ReturnType<typeof createUsageRoutes>

  beforeEach(() => {
    routes = createUsageRoutes({
      usageLedgerService: mockUsageLedgerService as unknown as Parameters<typeof createUsageRoutes>[0]["usageLedgerService"],
      costingService: mockCostingService as unknown as Parameters<typeof createUsageRoutes>[0]["costingService"],
    })
    mockUsageLedgerService.getUsageByDateRange.mockClear()
    mockUsageLedgerService.getSpendByCategory.mockClear()
    mockUsageLedgerService.getTotalSpend.mockClear()
    mockUsageLedgerService.getDailyUsageTrend.mockClear()
    mockCostingService.getUsageBreakdown.mockClear()
  })

  it("should return current period usage", async () => {
    mockUsageLedgerService.getSpendByCategory.mockResolvedValue([
      { category: "whatsapp", totalIdr: 5000 },
    ] as never[])
    mockUsageLedgerService.getTotalSpend.mockResolvedValue(5000)

    const response = await routes.handle(
      new Request("http://localhost/usage")
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.breakdown).toHaveLength(1)
  })

  it("should return usage by date range", async () => {
    mockUsageLedgerService.getUsageByDateRange.mockResolvedValue([
      {
        id: "1",
        category: "whatsapp",
        amountIdr: 1000,
        createdAt: new Date(),
      },
    ] as never[])

    const response = await routes.handle(
      new Request("http://localhost/usage?from=2026-06-01&to=2026-06-30")
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.entries).toHaveLength(1)
  })

  it("should return usage breakdown by service", async () => {
    mockCostingService.getUsageBreakdown.mockResolvedValue([
      {
        category: "whatsapp",
        quantity: 100,
        totalCost: 5000,
        percentage: 50,
      },
      {
        category: "hosting",
        quantity: 50,
        totalCost: 5000,
        percentage: 50,
      },
    ] as never[])

    const response = await routes.handle(
      new Request("http://localhost/usage/breakdown")
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.breakdown).toHaveLength(2)
  })

  it("should return daily usage trend", async () => {
    mockUsageLedgerService.getDailyUsageTrend.mockResolvedValue([
      { date: "2026-06-01", amount: 1000 },
      { date: "2026-06-02", amount: 2000 },
    ] as never[])

    const response = await routes.handle(
      new Request("http://localhost/usage/trend?days=7")
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.trend).toHaveLength(2)
    expect(data.data.days).toBe(7)
  })
})
