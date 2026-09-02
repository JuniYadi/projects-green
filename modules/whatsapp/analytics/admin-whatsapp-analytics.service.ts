import { prisma } from "@/lib/prisma"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { decryptWithAppKey } from "@/lib/whatsapp/crypto"
import { WhatsappBillingCategory, Prisma } from "@prisma/client"
import { MessageCostService } from "@/modules/billing/message-cost.service"

export const META_VAT_RATE = new Prisma.Decimal("0.11") // 11% PPN

export interface SyncPricingAnalyticsInput {
  days?: number
  startDate?: string
  endDate?: string
  deviceId?: string
}

export interface SyncPricingAnalyticsResult {
  syncedCount: number
  totalBaseCostIdr: Prisma.Decimal
  totalVatCostIdr: Prisma.Decimal
  totalCostIdr: Prisma.Decimal
  records: Array<{
    deviceId: string
    organizationId: string
    date: string
    category: WhatsappBillingCategory
    volume: number
    baseCostIdr: Prisma.Decimal
    vatCostIdr: Prisma.Decimal
    totalCostIdr: Prisma.Decimal
  }>
}

export interface FinancialSummaryDTO {
  period: {
    startDate: string
    endDate: string
  }
  kpi: {
    totalDeliveredMessages: number
    totalRevenueIdr: string
    totalMetaBaseCostIdr: string
    totalMetaVatCostIdr: string
    totalMetaNetCostIdr: string
    grossProfitIdr: string
    grossMarginPct: string
    status: "HEALTHY" | "MODERATE" | "RISK"
  }
  categoryBreakdown: Array<{
    category: WhatsappBillingCategory
    volume: number
    metaBaseCostIdr: string
    metaVatCostIdr: string
    metaTotalCostIdr: string
    revenueIdr: string
    grossProfitIdr: string
    marginPct: string
  }>
}

export interface OrgProfitabilityItemDTO {
  organizationId: string
  organizationName?: string
  deviceCount: number
  totalDelivered: number
  metaBaseCostIdr: string
  metaVatCostIdr: string
  metaTotalCostIdr: string
  revenueIdr: string
  grossProfitIdr: string
  marginPct: string
  marginStatus: "HEALTHY" | "MODERATE" | "RISK"
}

export class AdminWhatsappAnalyticsService {
  private messageCostService: MessageCostService

  constructor() {
    this.messageCostService = new MessageCostService(prisma)
  }

  /**
   * Sync Real Meta Pricing Analytics using dimensions: ["PHONE", "PRICING_CATEGORY"]
   * and store into WhatsappDailyCostReconciliation.
   */
  async syncMetaPricingAnalytics(
    input: SyncPricingAnalyticsInput = {}
  ): Promise<SyncPricingAnalyticsResult> {
    const days = input.days ?? 90
    const nowTs = Math.floor(Date.now() / 1000)
    const startTs = input.startDate
      ? Math.floor(new Date(input.startDate).getTime() / 1000)
      : nowTs - days * 24 * 3600
    const endTs = input.endDate
      ? Math.floor(new Date(input.endDate + "T23:59:59Z").getTime() / 1000)
      : nowTs

    // Find devices with WABA credentials
    const deviceWhere: Prisma.WhatsappDeviceWhereInput = {
      status: "ACTIVE",
      tokenEncrypted: { not: null },
      whatsappBusinessAccountId: { not: null },
      ...(input.deviceId ? { id: input.deviceId } : {}),
    }

    const devices = await prisma.whatsappDevice.findMany({
      where: deviceWhere,
      select: {
        id: true,
        organizationId: true,
        phoneNumber: true,
        whatsappPhoneId: true,
        whatsappBusinessAccountId: true,
        tokenEncrypted: true,
      },
    })

    let syncedCount = 0
    let totalBaseCost = new Prisma.Decimal(0)
    let totalVatCost = new Prisma.Decimal(0)
    let totalCost = new Prisma.Decimal(0)
    const records: SyncPricingAnalyticsResult["records"] = []

    // Map phone numbers for fast lookup
    const phoneToDeviceMap = new Map<string, (typeof devices)[0]>()
    for (const d of devices) {
      if (d.phoneNumber) {
        // Clean + or non-digit
        const cleanPhone = d.phoneNumber.replace(/\D/g, "")
        phoneToDeviceMap.set(cleanPhone, d)
      }
    }

    // Process each unique WABA ID
    const uniqueWabaIds = Array.from(
      new Set(
        devices
          .map((d) => d.whatsappBusinessAccountId)
          .filter((w): w is string => Boolean(w))
      )
    )

    for (const wabaId of uniqueWabaIds) {
      const sampleDevice = devices.find(
        (d) => d.whatsappBusinessAccountId === wabaId && d.tokenEncrypted
      )
      if (!sampleDevice?.tokenEncrypted) continue

      let token = ""
      try {
        token = await decryptWithAppKey(sampleDevice.tokenEncrypted)
      } catch (err) {
        console.error(`Failed to decrypt token for WABA ${wabaId}:`, err)
        continue
      }

      try {
        const url = `https://graph.facebook.com/v20.0/${wabaId}?fields=pricing_analytics.start(${startTs}).end(${endTs}).granularity(DAILY).dimensions(["PHONE","PRICING_CATEGORY"])`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const resJson = (await res.json()) as {
          error?: { message: string }
          pricing_analytics?: {
            data?: Array<{
              data_points?: Array<{
                start: number
                end: number
                phone_number?: string
                pricing_category?: string
                volume?: number
                cost?: number
              }>
            }>
          }
        }

        if (resJson.error) {
          console.error(
            `Meta pricing_analytics error on WABA ${wabaId}:`,
            resJson.error
          )
          continue
        }

        const dataPoints =
          resJson.pricing_analytics?.data?.[0]?.data_points ?? []

        for (const dp of dataPoints) {
          if (!dp.phone_number) continue
          const cleanPhone = dp.phone_number.replace(/\D/g, "")
          const matchedDevice =
            phoneToDeviceMap.get(cleanPhone) ??
            devices.find((d) => d.whatsappBusinessAccountId === wabaId)

          if (!matchedDevice) continue

          const categoryStr = (dp.pricing_category ?? "MARKETING").toUpperCase()
          const category = (
            ["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"].includes(
              categoryStr
            )
              ? categoryStr
              : "MARKETING"
          ) as WhatsappBillingCategory

          const date = new Date(dp.start * 1000)
          date.setUTCHours(0, 0, 0, 0)

          const volume = Number(dp.volume ?? 0)
          const baseCostIdr = new Prisma.Decimal(dp.cost ?? 0)
          const vatCostIdr = baseCostIdr.mul(META_VAT_RATE)
          const totalCostIdr = baseCostIdr.add(vatCostIdr)

          // Estimate revenue/allowance value from our system base prices for that category
          // Unit base price for customer
          let unitPriceIdr = new Prisma.Decimal(587)
          if (category === "UTILITY" || category === "AUTHENTICATION") {
            unitPriceIdr = new Prisma.Decimal(357)
          } else if (category === "SERVICE") {
            unitPriceIdr = new Prisma.Decimal(300)
          }
          const internalRevenueIdr = unitPriceIdr.mul(volume)
          const grossProfitIdr = internalRevenueIdr.sub(totalCostIdr)
          const grossMarginPct = internalRevenueIdr.isZero()
            ? new Prisma.Decimal(0)
            : grossProfitIdr.div(internalRevenueIdr).mul(100)

          await prisma.whatsappDailyCostReconciliation.upsert({
            where: {
              whatsappDeviceId_category_date: {
                whatsappDeviceId: matchedDevice.id,
                category,
                date,
              },
            },
            create: {
              organizationId: matchedDevice.organizationId,
              whatsappDeviceId: matchedDevice.id,
              phoneNumber: dp.phone_number,
              category,
              date,
              metaDeliveredCount: volume,
              metaBaseCostIdr: baseCostIdr,
              metaVatCostIdr: vatCostIdr,
              metaTotalCostIdr: totalCostIdr,
              localDeliveredCount: volume,
              quotaCreditsUsed: new Prisma.Decimal(volume),
              internalRevenueIdr,
              grossProfitIdr,
              grossMarginPct,
            },
            update: {
              phoneNumber: dp.phone_number,
              metaDeliveredCount: volume,
              metaBaseCostIdr: baseCostIdr,
              metaVatCostIdr: vatCostIdr,
              metaTotalCostIdr: totalCostIdr,
              internalRevenueIdr,
              grossProfitIdr,
              grossMarginPct,
            },
          })

          syncedCount++
          totalBaseCost = totalBaseCost.add(baseCostIdr)
          totalVatCost = totalVatCost.add(vatCostIdr)
          totalCost = totalCost.add(totalCostIdr)

          records.push({
            deviceId: matchedDevice.id,
            organizationId: matchedDevice.organizationId,
            date: date.toISOString().split("T")[0],
            category,
            volume,
            baseCostIdr,
            vatCostIdr,
            totalCostIdr,
          })
        }
      } catch (err) {
        console.error(`Failed to process WABA ${wabaId}:`, err)
      }
    }

    return {
      syncedCount,
      totalBaseCostIdr: totalBaseCost,
      totalVatCostIdr: totalVatCost,
      totalCostIdr: totalCost,
      records,
    }
  }

  /**
   * Get KPI Summary and Category Breakdown for a date range.
   */
  async getFinancialSummary(opts: {
    startDate?: string
    endDate?: string
    organizationId?: string
  }): Promise<FinancialSummaryDTO> {
    const start = opts.startDate
      ? new Date(opts.startDate)
      : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    start.setUTCHours(0, 0, 0, 0)

    const end = opts.endDate ? new Date(opts.endDate) : new Date()
    end.setUTCHours(23, 59, 59, 999)

    const where: Prisma.WhatsappDailyCostReconciliationWhereInput = {
      date: { gte: start, lte: end },
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    }

    const rows = await prisma.whatsappDailyCostReconciliation.findMany({
      where,
    })

    let totalDelivered = 0
    let totalBaseCost = new Prisma.Decimal(0)
    let totalVatCost = new Prisma.Decimal(0)
    let totalNetCost = new Prisma.Decimal(0)
    let totalRevenue = new Prisma.Decimal(0)

    const categoryMap = new Map<
      WhatsappBillingCategory,
      {
        volume: number
        baseCost: Prisma.Decimal
        vatCost: Prisma.Decimal
        totalCost: Prisma.Decimal
        revenue: Prisma.Decimal
      }
    >()

    const allCategories: WhatsappBillingCategory[] = [
      "MARKETING",
      "UTILITY",
      "AUTHENTICATION",
      "SERVICE",
    ]
    for (const cat of allCategories) {
      categoryMap.set(cat, {
        volume: 0,
        baseCost: new Prisma.Decimal(0),
        vatCost: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
      })
    }

    for (const r of rows) {
      totalDelivered += r.metaDeliveredCount
      totalBaseCost = totalBaseCost.add(r.metaBaseCostIdr)
      totalVatCost = totalVatCost.add(r.metaVatCostIdr)
      totalNetCost = totalNetCost.add(r.metaTotalCostIdr)
      totalRevenue = totalRevenue.add(r.internalRevenueIdr)

      const entry = categoryMap.get(r.category)
      if (entry) {
        entry.volume += r.metaDeliveredCount
        entry.baseCost = entry.baseCost.add(r.metaBaseCostIdr)
        entry.vatCost = entry.vatCost.add(r.metaVatCostIdr)
        entry.totalCost = entry.totalCost.add(r.metaTotalCostIdr)
        entry.revenue = entry.revenue.add(r.internalRevenueIdr)
      }
    }

    const grossProfit = totalRevenue.sub(totalNetCost)
    const marginPct = totalRevenue.isZero()
      ? new Prisma.Decimal(0)
      : grossProfit.div(totalRevenue).mul(100)

    let status: FinancialSummaryDTO["kpi"]["status"] = "HEALTHY"
    if (marginPct.toNumber() < 20) {
      status = "RISK"
    } else if (marginPct.toNumber() < 40) {
      status = "MODERATE"
    }

    const categoryBreakdown = allCategories.map((cat) => {
      const data = categoryMap.get(cat)!
      const catProfit = data.revenue.sub(data.totalCost)
      const catMargin = data.revenue.isZero()
        ? new Prisma.Decimal(0)
        : catProfit.div(data.revenue).mul(100)

      return {
        category: cat,
        volume: data.volume,
        metaBaseCostIdr: data.baseCost.toFixed(2),
        metaVatCostIdr: data.vatCost.toFixed(2),
        metaTotalCostIdr: data.totalCost.toFixed(2),
        revenueIdr: data.revenue.toFixed(2),
        grossProfitIdr: catProfit.toFixed(2),
        marginPct: catMargin.toFixed(2),
      }
    })

    return {
      period: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
      kpi: {
        totalDeliveredMessages: totalDelivered,
        totalRevenueIdr: totalRevenue.toFixed(2),
        totalMetaBaseCostIdr: totalBaseCost.toFixed(2),
        totalMetaVatCostIdr: totalVatCost.toFixed(2),
        totalMetaNetCostIdr: totalNetCost.toFixed(2),
        grossProfitIdr: grossProfit.toFixed(2),
        marginPct: marginPct.toFixed(2),
        status,
      },
      categoryBreakdown,
    }
  }

  /**
   * Get timeseries trends for charting.
   */
  async getTimeseriesTrends(opts: {
    startDate?: string
    endDate?: string
    organizationId?: string
  }): Promise<
    Array<{
      date: string
      deliveredMessages: number
      metaBaseCostIdr: number
      metaVatCostIdr: number
      metaTotalCostIdr: number
      revenueIdr: number
      grossProfitIdr: number
      marginPct: number
    }>
  > {
    const start = opts.startDate
      ? new Date(opts.startDate)
      : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    start.setUTCHours(0, 0, 0, 0)

    const end = opts.endDate ? new Date(opts.endDate) : new Date()
    end.setUTCHours(23, 59, 59, 999)

    const rows = await prisma.whatsappDailyCostReconciliation.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
      orderBy: { date: "asc" },
    })

    const dayMap = new Map<
      string,
      {
        volume: number
        baseCost: Prisma.Decimal
        vatCost: Prisma.Decimal
        totalCost: Prisma.Decimal
        revenue: Prisma.Decimal
      }
    >()

    for (const r of rows) {
      const dStr = r.date.toISOString().split("T")[0]
      const curr = dayMap.get(dStr) ?? {
        volume: 0,
        baseCost: new Prisma.Decimal(0),
        vatCost: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
      }
      curr.volume += r.metaDeliveredCount
      curr.baseCost = curr.baseCost.add(r.metaBaseCostIdr)
      curr.vatCost = curr.vatCost.add(r.metaVatCostIdr)
      curr.totalCost = curr.totalCost.add(r.metaTotalCostIdr)
      curr.revenue = curr.revenue.add(r.internalRevenueIdr)
      dayMap.set(dStr, curr)
    }

    return Array.from(dayMap.entries()).map(([date, val]) => {
      const profit = val.revenue.sub(val.totalCost)
      const margin = val.revenue.isZero()
        ? 0
        : profit.div(val.revenue).mul(100).toNumber()

      return {
        date,
        deliveredMessages: val.volume,
        metaBaseCostIdr: val.baseCost.toNumber(),
        metaVatCostIdr: val.vatCost.toNumber(),
        metaTotalCostIdr: val.totalCost.toNumber(),
        revenueIdr: val.revenue.toNumber(),
        grossProfitIdr: profit.toNumber(),
        marginPct: Number(margin.toFixed(2)),
      }
    })
  }

  /**
   * Get Organization Profitability Ranking / Leaderboard.
   */
  async getOrganizationProfitability(opts: {
    startDate?: string
    endDate?: string
  }): Promise<OrgProfitabilityItemDTO[]> {
    const start = opts.startDate
      ? new Date(opts.startDate)
      : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    start.setUTCHours(0, 0, 0, 0)

    const end = opts.endDate ? new Date(opts.endDate) : new Date()
    end.setUTCHours(23, 59, 59, 999)

    const rows = await prisma.whatsappDailyCostReconciliation.findMany({
      where: {
        date: { gte: start, lte: end },
      },
    })

    const orgMap = new Map<
      string,
      {
        devices: Set<string>
        delivered: number
        baseCost: Prisma.Decimal
        vatCost: Prisma.Decimal
        totalCost: Prisma.Decimal
        revenue: Prisma.Decimal
      }
    >()

    for (const r of rows) {
      const curr = orgMap.get(r.organizationId) ?? {
        devices: new Set<string>(),
        delivered: 0,
        baseCost: new Prisma.Decimal(0),
        vatCost: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
      }
      curr.devices.add(r.whatsappDeviceId)
      curr.delivered += r.metaDeliveredCount
      curr.baseCost = curr.baseCost.add(r.metaBaseCostIdr)
      curr.vatCost = curr.vatCost.add(r.metaVatCostIdr)
      curr.totalCost = curr.totalCost.add(r.metaTotalCostIdr)
      curr.revenue = curr.revenue.add(r.internalRevenueIdr)
      orgMap.set(r.organizationId, curr)
    }

    const results: OrgProfitabilityItemDTO[] = []

    for (const [orgId, val] of orgMap.entries()) {
      const profit = val.revenue.sub(val.totalCost)
      const margin = val.revenue.isZero()
        ? new Prisma.Decimal(0)
        : profit.div(val.revenue).mul(100)

      let marginStatus: OrgProfitabilityItemDTO["marginStatus"] = "HEALTHY"
      if (margin.toNumber() < 20) {
        marginStatus = "RISK"
      } else if (margin.toNumber() < 40) {
        marginStatus = "MODERATE"
      }

      results.push({
        organizationId: orgId,
        deviceCount: val.devices.size,
        totalDelivered: val.delivered,
        metaBaseCostIdr: val.baseCost.toFixed(2),
        metaVatCostIdr: val.vatCost.toFixed(2),
        metaTotalCostIdr: val.totalCost.toFixed(2),
        revenueIdr: val.revenue.toFixed(2),
        grossProfitIdr: profit.toFixed(2),
        marginPct: margin.toFixed(2),
        marginStatus,
      })
    }

    // Sort by total cost / volume descending
    return results.sort(
      (a, b) => Number(b.metaTotalCostIdr) - Number(a.metaTotalCostIdr)
    )
  }

  /**
   * Get Device Breakdown for a specific organization.
   */
  async getOrganizationDeviceBreakdown(
    organizationId: string,
    opts: { startDate?: string; endDate?: string } = {}
  ) {
    const start = opts.startDate
      ? new Date(opts.startDate)
      : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    start.setUTCHours(0, 0, 0, 0)

    const end = opts.endDate ? new Date(opts.endDate) : new Date()
    end.setUTCHours(23, 59, 59, 999)

    const rows = await prisma.whatsappDailyCostReconciliation.findMany({
      where: {
        organizationId,
        date: { gte: start, lte: end },
      },
    })

    const deviceMap = new Map<
      string,
      {
        phoneNumber: string | null
        delivered: number
        baseCost: Prisma.Decimal
        vatCost: Prisma.Decimal
        totalCost: Prisma.Decimal
        revenue: Prisma.Decimal
        categories: Record<string, number>
      }
    >()

    for (const r of rows) {
      const curr = deviceMap.get(r.whatsappDeviceId) ?? {
        phoneNumber: r.phoneNumber,
        delivered: 0,
        baseCost: new Prisma.Decimal(0),
        vatCost: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
        categories: {},
      }
      curr.delivered += r.metaDeliveredCount
      curr.baseCost = curr.baseCost.add(r.metaBaseCostIdr)
      curr.vatCost = curr.vatCost.add(r.metaVatCostIdr)
      curr.totalCost = curr.totalCost.add(r.metaTotalCostIdr)
      curr.revenue = curr.revenue.add(r.internalRevenueIdr)
      curr.categories[r.category] =
        (curr.categories[r.category] ?? 0) + r.metaDeliveredCount
      deviceMap.set(r.whatsappDeviceId, curr)
    }

    return Array.from(deviceMap.entries()).map(([deviceId, val]) => {
      const profit = val.revenue.sub(val.totalCost)
      const margin = val.revenue.isZero()
        ? new Prisma.Decimal(0)
        : profit.div(val.revenue).mul(100)

      return {
        deviceId,
        phoneNumber: val.phoneNumber,
        deliveredMessages: val.delivered,
        metaBaseCostIdr: val.baseCost.toFixed(2),
        metaVatCostIdr: val.vatCost.toFixed(2),
        metaTotalCostIdr: val.totalCost.toFixed(2),
        revenueIdr: val.revenue.toFixed(2),
        grossProfitIdr: profit.toFixed(2),
        marginPct: margin.toFixed(2),
        categories: val.categories,
      }
    })
  }
}
