import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  AdminWhatsappAnalyticsService,
  META_VAT_RATE,
} from "./admin-whatsapp-analytics.service"

// Mock prisma
const mockFindMany = mock()
const mockUpsert = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDailyCostReconciliation: {
      findMany: mockFindMany,
      upsert: mockUpsert,
    },
    whatsappDevice: {
      findMany: mock(),
    },
  },
}))

describe("AdminWhatsappAnalyticsService", () => {
  let service: AdminWhatsappAnalyticsService

  beforeEach(() => {
    mockFindMany.mockClear()
    mockUpsert.mockClear()
    service = new AdminWhatsappAnalyticsService()
  })

  it("calculates 11% PPN correctly via META_VAT_RATE constant", () => {
    expect(META_VAT_RATE.toString()).toBe("0.11")
    const baseCost = new Prisma.Decimal("1000")
    const vat = baseCost.mul(META_VAT_RATE)
    expect(vat.toString()).toBe("110")
    const total = baseCost.add(vat)
    expect(total.toString()).toBe("1110")
  })

  it("computes financial KPI summary with healthy profit margin", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        category: "MARKETING",
        metaDeliveredCount: 10,
        metaBaseCostIdr: new Prisma.Decimal("5863.30"),
        metaVatCostIdr: new Prisma.Decimal("644.96"),
        metaTotalCostIdr: new Prisma.Decimal("6508.26"),
        internalRevenueIdr: new Prisma.Decimal("12000.00"),
      },
      {
        category: "UTILITY",
        metaDeliveredCount: 5,
        metaBaseCostIdr: new Prisma.Decimal("1783.25"),
        metaVatCostIdr: new Prisma.Decimal("196.16"),
        metaTotalCostIdr: new Prisma.Decimal("1979.41"),
        internalRevenueIdr: new Prisma.Decimal("3500.00"),
      },
    ])

    const summary = await service.getFinancialSummary({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    })

    expect(summary.kpi.totalDeliveredMessages).toBe(15)
    expect(summary.kpi.totalRevenueIdr).toBe("15500.00")
    expect(summary.kpi.totalMetaNetCostIdr).toBe("8487.67")
    expect(summary.kpi.grossProfitIdr).toBe("7012.33")
    expect(summary.kpi.status).toBe("HEALTHY")
    expect(summary.categoryBreakdown.length).toBe(4)
  })

  it("returns timeseries trends correctly grouped by date", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        date: new Date("2026-08-15T00:00:00Z"),
        metaDeliveredCount: 2,
        metaBaseCostIdr: new Prisma.Decimal("1000"),
        metaVatCostIdr: new Prisma.Decimal("110"),
        metaTotalCostIdr: new Prisma.Decimal("1110"),
        internalRevenueIdr: new Prisma.Decimal("2000"),
      },
    ])

    const trends = await service.getTimeseriesTrends({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    })

    expect(trends.length).toBe(1)
    expect(trends[0].date).toBe("2026-08-15")
    expect(trends[0].deliveredMessages).toBe(2)
    expect(trends[0].metaTotalCostIdr).toBe(1110)
    expect(trends[0].revenueIdr).toBe(2000)
    expect(trends[0].grossProfitIdr).toBe(890)
    expect(trends[0].marginPct).toBe(44.5)
  })

  it("ranks organizations by profitability", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        metaDeliveredCount: 10,
        metaBaseCostIdr: new Prisma.Decimal("5000"),
        metaVatCostIdr: new Prisma.Decimal("550"),
        metaTotalCostIdr: new Prisma.Decimal("5550"),
        internalRevenueIdr: new Prisma.Decimal("10000"),
      },
    ])

    const orgs = await service.getOrganizationProfitability({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    })

    expect(orgs.length).toBe(1)
    expect(orgs[0].organizationId).toBe("org-1")
    expect(orgs[0].deviceCount).toBe(1)
    expect(orgs[0].totalDelivered).toBe(10)
    expect(orgs[0].metaTotalCostIdr).toBe("5550.00")
    expect(orgs[0].revenueIdr).toBe("10000.00")
    expect(orgs[0].grossProfitIdr).toBe("4450.00")
    expect(orgs[0].marginPct).toBe("44.50")
    expect(orgs[0].marginStatus).toBe("HEALTHY")
  })
})
