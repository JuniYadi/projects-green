import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  AdminWhatsappAnalyticsService,
  META_VAT_RATE,
} from "./admin-whatsapp-analytics.service"

// Mock prisma
const mockFindMany = mock()
const mockUpsert = mock()
const mockDeviceFindMany = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDailyCostReconciliation: {
      findMany: mockFindMany,
      upsert: mockUpsert,
    },
    whatsappDevice: {
      findMany: mockDeviceFindMany,
    },
  },
}))

mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWithAppKey: mock().mockResolvedValue("test-token"),
}))

describe("AdminWhatsappAnalyticsService", () => {
  let service: AdminWhatsappAnalyticsService
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockFindMany.mockClear()
    mockUpsert.mockClear()
    mockDeviceFindMany.mockClear()
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
      days: 30,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    })

    expect(summary.kpi.totalDeliveredMessages).toBe(15)
    expect(summary.kpi.totalRevenueIdr).toBe("15500.00")
    expect(summary.kpi.totalMetaNetCostIdr).toBe("8487.67")
    expect(summary.kpi.grossProfitIdr).toBe("7012.33")
    expect(summary.kpi.grossMarginPct).toBe("45.24")
    expect(summary.kpi.status).toBe("HEALTHY")
    expect(summary.categoryBreakdown.length).toBe(4)
  })

  it("computes financial KPI summary with zero revenue and moderate/risk status", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        category: "SERVICE",
        metaDeliveredCount: 1,
        metaBaseCostIdr: new Prisma.Decimal("300"),
        metaVatCostIdr: new Prisma.Decimal("33"),
        metaTotalCostIdr: new Prisma.Decimal("333"),
        internalRevenueIdr: new Prisma.Decimal("0"),
      },
    ])

    const summary = await service.getFinancialSummary({})

    expect(summary.kpi.totalDeliveredMessages).toBe(1)
    expect(summary.kpi.totalRevenueIdr).toBe("0.00")
    expect(summary.kpi.status).toBe("RISK")
  })

  it("computes financial KPI summary with moderate status (margin 30%)", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        category: "SERVICE",
        metaDeliveredCount: 1,
        metaBaseCostIdr: new Prisma.Decimal("630"),
        metaVatCostIdr: new Prisma.Decimal("70"),
        metaTotalCostIdr: new Prisma.Decimal("700"),
        internalRevenueIdr: new Prisma.Decimal("1000"),
      },
    ])

    const summary = await service.getFinancialSummary({})
    expect(summary.kpi.status).toBe("MODERATE")
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
      days: 30,
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

  it("ranks organizations by profitability with moderate/risk margin", async () => {
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
      {
        organizationId: "org-2",
        whatsappDeviceId: "dev-2",
        metaDeliveredCount: 5,
        metaBaseCostIdr: new Prisma.Decimal("3000"),
        metaVatCostIdr: new Prisma.Decimal("330"),
        metaTotalCostIdr: new Prisma.Decimal("3330"),
        internalRevenueIdr: new Prisma.Decimal("4000"), // margin ~ 16.75% -> RISK
      },
      {
        organizationId: "org-3",
        whatsappDeviceId: "dev-3",
        metaDeliveredCount: 2,
        metaBaseCostIdr: new Prisma.Decimal("600"),
        metaVatCostIdr: new Prisma.Decimal("66"),
        metaTotalCostIdr: new Prisma.Decimal("666"),
        internalRevenueIdr: new Prisma.Decimal("1000"), // margin ~ 33.4% -> MODERATE
      },
    ])

    const orgs = await service.getOrganizationProfitability({
      days: 30,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    })

    expect(orgs.length).toBe(3)
    expect(orgs[0].organizationId).toBe("org-1")
    expect(orgs[0].marginStatus).toBe("HEALTHY")
    const org2 = orgs.find((o) => o.organizationId === "org-2")
    const org3 = orgs.find((o) => o.organizationId === "org-3")
    expect(org2?.marginStatus).toBe("RISK")
    expect(org3?.marginStatus).toBe("MODERATE")
  })

  it("returns organization device breakdown with categories", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        phoneNumber: "+62812345678",
        category: "MARKETING",
        metaDeliveredCount: 4,
        metaBaseCostIdr: new Prisma.Decimal("2345.32"),
        metaVatCostIdr: new Prisma.Decimal("257.98"),
        metaTotalCostIdr: new Prisma.Decimal("2603.30"),
        internalRevenueIdr: new Prisma.Decimal("5000.00"),
      },
      {
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        phoneNumber: "+62812345678",
        category: "UTILITY",
        metaDeliveredCount: 2,
        metaBaseCostIdr: new Prisma.Decimal("713.30"),
        metaVatCostIdr: new Prisma.Decimal("78.46"),
        metaTotalCostIdr: new Prisma.Decimal("791.76"),
        internalRevenueIdr: new Prisma.Decimal("1000.00"),
      },
    ])

    const devices = await service.getOrganizationDeviceBreakdown("org-1", {
      days: 30,
    })

    expect(devices.length).toBe(1)
    expect(devices[0].deviceId).toBe("dev-1")
    expect(devices[0].deliveredMessages).toBe(6)
    expect(devices[0].categories.MARKETING).toBe(4)
    expect(devices[0].categories.UTILITY).toBe(2)
  })

  it("syncMetaPricingAnalytics fetches and upserts Meta pricing data points", async () => {
    mockDeviceFindMany.mockResolvedValueOnce([
      {
        id: "dev-1",
        organizationId: "org-1",
        phoneNumber: "+62812345678",
        whatsappPhoneId: "phone-1",
        whatsappBusinessAccountId: "waba-1",
        tokenEncrypted: "v1.iv.cipher",
      },
    ])

    globalThis.fetch = mock().mockResolvedValueOnce({
      json: async () => ({
        pricing_analytics: {
          data: [
            {
              data_points: [
                {
                  start: 1783357200,
                  end: 1783443600,
                  phone_number: "62812345678",
                  pricing_category: "MARKETING",
                  volume: 2,
                  cost: 1172.66,
                },
                {
                  start: 1783357200,
                  end: 1783443600,
                  phone_number: "62812345678",
                  pricing_category: "UTILITY",
                  volume: 1,
                  cost: 356.65,
                },
                {
                  start: 1783357200,
                  end: 1783443600,
                  phone_number: "62812345678",
                  pricing_category: "SERVICE",
                  volume: 1,
                  cost: 300.0,
                },
              ],
            },
          ],
        },
      }),
    }) as unknown as typeof fetch

    const result = await service.syncMetaPricingAnalytics({
      days: 7,
    })

    expect(result.syncedCount).toBe(3)
    expect(mockUpsert).toHaveBeenCalledTimes(3)
    globalThis.fetch = originalFetch
  })
})
