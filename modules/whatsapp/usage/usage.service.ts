import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  USAGE_CATEGORY_WHATSAPP_IN,
  USAGE_CATEGORY_WHATSAPP_OUT,
} from "@/modules/billing/constants"
import type {
  CostSummaryDTO,
  CategoryBreakdownDTO,
  DeviceUsageSummaryDTO,
  CostBreakdownResponseDTO,
  DeviceCostBreakdownDTO,
} from "./usage.dto"

const WHATSAPP_CATEGORIES = [
  USAGE_CATEGORY_WHATSAPP_IN,
  USAGE_CATEGORY_WHATSAPP_OUT,
]

function toNum(v: any): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  if (typeof v === "object" && typeof v.toNumber === "function") {
    return v.toNumber()
  }
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

type DateRangeOpts = {
  from?: string
  to?: string
  deviceId?: string
}

type MonthRangeOpts = {
  year?: number
  month?: number
  deviceId?: string
}

export class WhatsappUsageService {
  /**
   * Query WhatsappDailyCount with date range and optional device filter.
   */
  async getDailyCounts(organizationId: string, opts: DateRangeOpts = {}) {
    const where: Record<string, unknown> = { organizationId }

    if (opts.from || opts.to) {
      const dateFilter: Record<string, Date> = {}
      if (opts.from) dateFilter.gte = new Date(opts.from)
      if (opts.to) dateFilter.lte = new Date(opts.to)
      where.date = dateFilter
    }

    if (opts.deviceId) {
      where.whatsappDeviceId = opts.deviceId
    }

    return prisma.whatsappDailyCount.findMany({
      where,
      orderBy: { date: "asc" },
    })
  }

  /**
   * Query WhatsappMonthlyCount with year/month range and optional device
   * filter.
   */
  async getMonthlyCounts(organizationId: string, opts: MonthRangeOpts = {}) {
    const where: Record<string, unknown> = { organizationId }

    if (opts.year) {
      where.year = opts.year
    }
    if (opts.month) {
      where.month = opts.month
    }
    if (opts.deviceId) {
      where.whatsappDeviceId = opts.deviceId
    }

    return prisma.whatsappMonthlyCount.findMany({
      where,
      orderBy: [{ year: "asc" }, { month: "asc" }],
    })
  }

  /**
   * Aggregate cost from BillingUsageLedger for WhatsApp categories in a
   * given period. Returns total amount and per-category breakdown.
   */
  async getCostSummary(
    organizationId: string,
    period: string
  ): Promise<CostSummaryDTO> {
    const rows = await prisma.billingUsageLedger.findMany({
      where: {
        organizationId,
        category: { in: WHATSAPP_CATEGORIES },
        period,
      },
    })

    let total = 0
    const categoryMap = new Map<string, { count: number; total: number }>()

    for (const row of rows) {
      const amount = toNum(row.amountIdr)
      total += amount

      const cat = row.category ?? "UNKNOWN"
      const existing = categoryMap.get(cat)
      if (existing) {
        existing.count++
        existing.total += amount
      } else {
        categoryMap.set(cat, { count: 1, total: amount })
      }
    }

    const byCategory: CategoryBreakdownDTO[] = []
    for (const [category, data] of categoryMap) {
      byCategory.push({
        category,
        count: data.count,
        totalCost: data.total,
      })
    }

    return {
      totalAmount: total,
      totalEntries: rows.length,
      byCategory,
    }
  }

  /**
   * Group BillingUsageLedger entries by category for a period.
   */
  async getCategoryBreakdown(
    organizationId: string,
    period: string
  ): Promise<CategoryBreakdownDTO[]> {
    const rows = await prisma.billingUsageLedger.findMany({
      where: {
        organizationId,
        category: { in: WHATSAPP_CATEGORIES },
        period,
      },
    })

    const categoryMap = new Map<string, { count: number; total: number }>()

    for (const row of rows) {
      const amount = toNum(row.amountIdr)
      const cat = row.category ?? "UNKNOWN"
      const existing = categoryMap.get(cat)
      if (existing) {
        existing.count++
        existing.total += amount
      } else {
        categoryMap.set(cat, { count: 1, total: amount })
      }
    }

    const result: CategoryBreakdownDTO[] = []
    for (const [category, data] of categoryMap) {
      result.push({
        category,
        count: data.count,
        totalCost: data.total,
      })
    }

    return result
  }

  /**
   * Combine current month counts, cost, and device summary into a single
   * dashboard-friendly response.
   */
  async getUsageOverview(organizationId: string) {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1
    const todayStr = now.toISOString().split("T")[0]
    const period = `${year}-${String(month).padStart(2, "0")}`

    // Fetch monthly counts for current month
    const monthlyCounts = await prisma.whatsappMonthlyCount.findMany({
      where: { organizationId, year, month },
      orderBy: { createdAt: "asc" },
    })

    // Fetch daily counts for today
    const todayCounts = await prisma.whatsappDailyCount.findMany({
      where: {
        organizationId,
        date: new Date(todayStr),
      },
      orderBy: { createdAt: "asc" },
    })

    // Fetch cost summary for current period
    const cost = await this.getCostSummary(organizationId, period)

    // Build device summary from monthly counts
    const deviceIds = [...new Set(monthlyCounts.map((r) => r.whatsappDeviceId))]

    // Lookup device phone numbers
    const deviceMap = new Map<string | null, string | null>()
    if (deviceIds.length > 0) {
      const filteredIds = deviceIds.filter((id): id is string => id !== null)
      if (filteredIds.length > 0) {
        const devices = await prisma.whatsappDevice.findMany({
          where: {
            id: { in: filteredIds },
            organizationId,
          },
          select: { id: true, phoneNumber: true },
        })
        for (const d of devices) {
          deviceMap.set(d.id, d.phoneNumber)
        }
      }
    }

    const devices: DeviceUsageSummaryDTO[] = monthlyCounts.map((m) => ({
      deviceId: m.whatsappDeviceId,
      phoneNumber: deviceMap.get(m.whatsappDeviceId) ?? null,
      messageInboxCount: m.messageInboxCount,
      messageOutboxCount: m.messageOutboxCount,
      sessionCount: m.sessionCount,
      messageFailedCount: m.messageFailedCount,
    }))

    return { month: monthlyCounts, today: todayCounts, cost, devices }
  }

  /**
   * Get per-device cost breakdown with forecast for a period.
   * Forecast: linear extrapolation from current spend.
   */
  async getCostBreakdown(
    organizationId: string,
    period: string
  ): Promise<CostBreakdownResponseDTO> {
    const now = new Date()
    const [year, month] = period.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = now.getUTCDate()
    const isCurrentPeriod = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1
    const daysElapsed = isCurrentPeriod ? today : daysInMonth
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed)

    // Fetch all devices for org
    const devices = await prisma.whatsappDevice.findMany({
      where: { organizationId },
      select: { id: true, phoneNumber: true, quotaBaseOut: true, quotaBase: true },
    })

    // Fetch ledger entries grouped by device
    // ponytail: using category filter via raw query to avoid Prisma type issues
    const periodStart = new Date(`${period}-01`)
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const ledgerRows = await prisma.$queryRaw<Array<{
      whatsappDeviceId: string | null
      category: string
      totalAmount: bigint | number
      entryCount: bigint | number
    }>>`
      SELECT
        "whatsappDeviceId",
        "category",
        COALESCE(SUM("quotaValue"), 0) as "totalAmount",
        COUNT(*) as "entryCount"
      FROM "WhatsappBillingLedger"
      WHERE "organizationId" = ${organizationId}
        AND "category" IN ('WHATSAPP_MESSAGE_IN', 'WHATSAPP_MESSAGE_OUT')
        AND "createdAt" >= ${periodStart}
        AND "createdAt" < ${periodEnd}
      GROUP BY "whatsappDeviceId", "category"
    `

    // Build device cost map
    const deviceCostMap = new Map<string, { total: number; byCat: Map<string, { count: number; total: number }>; messageCount: number }>()
    for (const row of ledgerRows) {
      const devId = row.whatsappDeviceId ?? "unknown"
      if (!deviceCostMap.has(devId)) {
        deviceCostMap.set(devId, { total: 0, byCat: new Map(), messageCount: 0 })
      }
      const entry = deviceCostMap.get(devId)!
      const amount = Number(row.totalAmount)
      const count = Number(row.entryCount)
      entry.total += amount
      entry.messageCount += count
      const cat = row.category ?? "UNKNOWN"
      const catEntry = entry.byCat.get(cat) ?? { count: 0, total: 0 }
      catEntry.count += count
      catEntry.total += amount
      entry.byCat.set(cat, catEntry)
    }

    // Build per-device breakdown
    const byDevice: DeviceCostBreakdownDTO[] = devices.map((dev) => {
      const costs = deviceCostMap.get(dev.id) ?? { total: 0, byCat: new Map(), messageCount: 0 }
      const quotaBase = toNum(dev.quotaBaseOut)
      const quotaPercent = quotaBase > 0 ? Math.min(100, (costs.messageCount / quotaBase) * 100) : 0
      return {
        deviceId: dev.id,
        phoneNumber: dev.phoneNumber,
        totalCost: costs.total,
        byCategory: Array.from(costs.byCat.entries()).map(([category, data]) => ({
          category,
          count: data.count,
          totalCost: data.total,
        })),
        messageCount: costs.messageCount,
        quotaBase,
        quotaUsed: costs.messageCount,
        quotaPercent,
      }
    })

    const totalCost = byDevice.reduce((s, d) => s + d.totalCost, 0)
    const projectedCost = isCurrentPeriod && daysElapsed > 0
      ? (totalCost / daysElapsed) * daysInMonth
      : totalCost

    // Get billing account for balance
    const account = await prisma.billingAccount.findUnique({
      where: { organizationId },
      select: { balance: true, currency: true },
    })

    return {
      period,
      totalCost,
      projectedCost: Math.round(projectedCost * 100) / 100,
      forecast: {
        daysElapsed,
        daysRemaining,
        currentCost: totalCost,
        projectedMonthlyCost: Math.round(projectedCost * 100) / 100,
      },
      byDevice,
      balance: account ? toNum(account.balance) : null,
      currency: account?.currency ?? "IDR",
    }
  }
}

export const whatsappUsageService = new WhatsappUsageService()
