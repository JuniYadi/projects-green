import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Elysia } from "elysia"

const mockGetFinancialSummary = mock()
const mockGetTimeseriesTrends = mock()
const mockGetMonthlyTrends = mock()
const mockGetOrganizationProfitability = mock()
const mockGetOrganizationDeviceBreakdown = mock()
const mockSyncMetaPricingAnalytics = mock()
const mockRequireSuperAdmin = mock()

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => ({ user: { id: "user_1" } })),
  getWorkOS: () => ({
    organizations: {},
    userManagement: {},
  }),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => "super_admin"),
}))

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

mock.module("../admin-whatsapp-analytics.service", () => ({
  AdminWhatsappAnalyticsService: class {
    getFinancialSummary = mockGetFinancialSummary
    getTimeseriesTrends = mockGetTimeseriesTrends
    getMonthlyTrends = mockGetMonthlyTrends
    getOrganizationProfitability = mockGetOrganizationProfitability
    getOrganizationDeviceBreakdown = mockGetOrganizationDeviceBreakdown
    syncMetaPricingAnalytics = mockSyncMetaPricingAnalytics
  },
}))

describe("adminWhatsappAnalyticsRoutes", () => {
  let app: { handle: (req: Request) => Promise<Response> }

  beforeEach(async () => {
    mockGetFinancialSummary.mockClear()
    mockGetTimeseriesTrends.mockClear()
    mockGetMonthlyTrends.mockClear()
    mockGetOrganizationProfitability.mockClear()
    mockGetOrganizationDeviceBreakdown.mockClear()
    mockSyncMetaPricingAnalytics.mockClear()
    mockRequireSuperAdmin.mockClear()

    mockRequireSuperAdmin.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      platformRole: "super_admin",
    })

    const { adminWhatsappAnalyticsRoutes } =
      await import("./admin-whatsapp-analytics.route")
    app = new Elysia().use(adminWhatsappAnalyticsRoutes)
  })

  it("returns 401/403 when user is not superadmin", async () => {
    mockRequireSuperAdmin.mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "You must be signed in.",
    })

    const res = await app.handle(
      new Request("http://localhost/admin/whatsapp/analytics/summary")
    )
    const json = (await res.json()) as { ok: boolean; error: string }

    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("GET /admin/whatsapp/analytics/summary returns financial summary", async () => {
    mockGetFinancialSummary.mockResolvedValueOnce({
      period: { startDate: "2026-08-01", endDate: "2026-08-31" },
      kpi: { totalDeliveredMessages: 10, totalRevenueIdr: "1000" },
    })

    const res = await app.handle(
      new Request("http://localhost/admin/whatsapp/analytics/summary?days=30")
    )
    const json = (await res.json()) as {
      ok: boolean
      data: { kpi: { totalDeliveredMessages: number } }
    }

    expect(json.ok).toBe(true)
    expect(json.data.kpi.totalDeliveredMessages).toBe(10)
    expect(mockGetFinancialSummary).toHaveBeenCalledWith({
      days: 30,
      startDate: undefined,
      endDate: undefined,
      organizationId: undefined,
    })
  })

  it("GET /admin/whatsapp/analytics/trends returns timeseries trends", async () => {
    mockGetTimeseriesTrends.mockResolvedValueOnce([
      { date: "2026-08-15", deliveredMessages: 5, grossProfitIdr: 500 },
    ])

    const res = await app.handle(
      new Request("http://localhost/admin/whatsapp/analytics/trends?days=7")
    )
    const json = (await res.json()) as {
      ok: boolean
      data: Array<{ date: string }>
    }

    expect(json.ok).toBe(true)
    expect(json.data.length).toBe(1)
    expect(json.data[0].date).toBe("2026-08-15")
  })

  it("GET /admin/whatsapp/analytics/monthly-trends returns monthly trends", async () => {
    const dummyMonthly = [
      {
        month: "2026-08",
        deliveredMessages: 100,
        metaTotalCostIdr: 50000,
        revenueIdr: 70000,
        grossProfitIdr: 20000,
        marginPct: 28.57,
      },
    ]
    mockGetMonthlyTrends.mockResolvedValueOnce(dummyMonthly)

    const res = await app.handle(
      new Request(
        "http://localhost/admin/whatsapp/analytics/monthly-trends?months=12&organizationId=org_1"
      )
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: typeof dummyMonthly
    }
    expect(json.ok).toBe(true)
    expect(json.data).toEqual(dummyMonthly)
    expect(mockGetMonthlyTrends).toHaveBeenCalledWith({
      months: 12,
      organizationId: "org_1",
    })
  })

  it("GET /admin/whatsapp/analytics/organizations returns org leaderboard", async () => {
    mockGetOrganizationProfitability.mockResolvedValueOnce([
      { organizationId: "org-1", marginPct: "45.00" },
    ])

    const res = await app.handle(
      new Request(
        "http://localhost/admin/whatsapp/analytics/organizations?days=60"
      )
    )
    const json = (await res.json()) as {
      ok: boolean
      data: Array<{ organizationId: string }>
    }

    expect(json.ok).toBe(true)
    expect(json.data[0].organizationId).toBe("org-1")
  })

  it("GET /admin/whatsapp/analytics/organizations/:id returns details and devices", async () => {
    mockGetFinancialSummary.mockResolvedValueOnce({
      kpi: { totalRevenueIdr: "5000" },
    })
    mockGetOrganizationDeviceBreakdown.mockResolvedValueOnce([
      { deviceId: "dev-1", deliveredMessages: 10 },
    ])

    const res = await app.handle(
      new Request(
        "http://localhost/admin/whatsapp/analytics/organizations/org-123?days=30"
      )
    )
    const json = (await res.json()) as {
      ok: boolean
      data: { summary: unknown; devices: Array<{ deviceId: string }> }
    }

    expect(json.ok).toBe(true)
    expect(json.data.devices.length).toBe(1)
    expect(json.data.devices[0].deviceId).toBe("dev-1")
  })

  it("POST /admin/whatsapp/analytics/sync triggers Meta pricing sync", async () => {
    const { Prisma } = await import("@prisma/client")
    mockSyncMetaPricingAnalytics.mockResolvedValueOnce({
      syncedCount: 5,
      totalBaseCostIdr: new Prisma.Decimal("1000"),
      totalVatCostIdr: new Prisma.Decimal("110"),
      totalCostIdr: new Prisma.Decimal("1110"),
      records: [{}, {}, {}, {}, {}],
    })

    const res = await app.handle(
      new Request("http://localhost/admin/whatsapp/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      })
    )
    const json = (await res.json()) as {
      ok: boolean
      data: { syncedCount: number; totalCostIdr: string }
    }

    expect(json.ok).toBe(true)
    expect(json.data.syncedCount).toBe(5)
    expect(json.data.totalCostIdr).toBe("1110.00")
  })
})
