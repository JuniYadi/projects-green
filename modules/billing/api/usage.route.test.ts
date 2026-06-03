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

const mockAuthenticate = mock(() =>
  Promise.resolve({
    user: { id: "user-1", email: "test@example.com" },
    organizationId: "org-1",
  }),
)

describe("Usage Routes", () => {
  let routes: ReturnType<typeof createUsageRoutes>

  beforeEach(() => {
    routes = createUsageRoutes({
      usageLedgerService: mockUsageLedgerService as unknown as Parameters<typeof createUsageRoutes>[0]["usageLedgerService"],
      costingService: mockCostingService as unknown as Parameters<typeof createUsageRoutes>[0]["costingService"],
      authenticate: mockAuthenticate,
    })
    mockUsageLedgerService.getUsageByDateRange.mockClear()
    mockUsageLedgerService.getSpendByCategory.mockClear()
    mockUsageLedgerService.getTotalSpend.mockClear()
    mockUsageLedgerService.getDailyUsageTrend.mockClear()
    mockCostingService.getUsageBreakdown.mockClear()
    mockAuthenticate.mockClear()
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

  it("should return 401 when not authenticated", async () => {
    mockAuthenticate.mockResolvedValueOnce({
      user: null,
      organizationId: null,
    } as unknown as Awaited<ReturnType<typeof mockAuthenticate>>)

    const response = await routes.handle(
      new Request("http://localhost/usage")
    )

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe("UNAUTHORIZED")
  })

  it("should return 403 when no organization", async () => {
    mockAuthenticate.mockResolvedValueOnce({
      user: { id: "user-1", email: "test@example.com" },
      organizationId: null,
    } as unknown as Awaited<ReturnType<typeof mockAuthenticate>>)

    const response = await routes.handle(
      new Request("http://localhost/usage")
    )

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe("FORBIDDEN")
  })

  it("should return 422 for invalid date format", async () => {
    const response = await routes.handle(
      new Request("http://localhost/usage?from=invalid&to=2026-06-30")
    )

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe("VALIDATION_ERROR")
  })

  it("should return 422 when from date is after to date", async () => {
    const response = await routes.handle(
      new Request("http://localhost/usage?from=2026-06-30&to=2026-06-01")
    )

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe("VALIDATION_ERROR")
  })

  it("should return 422 for invalid days parameter", async () => {
    const response = await routes.handle(
      new Request("http://localhost/usage/trend?days=invalid")
    )

    expect(response.status).toBe(422)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe("VALIDATION_ERROR")
  })
})
