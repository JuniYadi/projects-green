import { prisma } from "@/lib/prisma"
import {
  USAGE_CATEGORY_WHATSAPP_IN,
  USAGE_CATEGORY_WHATSAPP_OUT,
} from "@/modules/billing/constants"
import type {
  CostSummaryDTO,
  CategoryBreakdownDTO,
  DeviceUsageSummaryDTO,
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
}

export const whatsappUsageService = new WhatsappUsageService()
