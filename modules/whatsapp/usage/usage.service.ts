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
    // Query BillingAdjustment for WHATSAPP source in the period
    const account = await prisma.billingAccount.findUnique({
      where: { organizationId },
      select: { id: true },
    })

    const adjustments = account
      ? await prisma.billingAdjustment.findMany({
          where: {
            billingAccountId: account.id,
            createdAt: {
              gte: new Date(`${period}-01`),
              lt: new Date(
                Number(period.split("-")[1]) === 12
                  ? Number(period.split("-")[0]) + 1
                  : Number(period.split("-")[0]),
                Number(period.split("-")[1]) === 12
                  ? 0
                  : Number(period.split("-")[1]),
                1
              ),
            },
          },
        })
      : []

    const whatsappAdjustments = adjustments.filter((adj) => {
      const meta = adj.metadataJson as Record<string, unknown> | null
      return meta?.source === "WHATSAPP"
    })

    let total = 0
    for (const adj of whatsappAdjustments) {
      total += toNum(adj.amount)
    }

    return {
      totalAmount: total,
      totalEntries: whatsappAdjustments.length,
      byCategory: [], // Category breakdown requires WhatsappBillingLedger; not included in summary
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
    period: string,
    opts: { deviceId?: string } = {}
  ): Promise<CostBreakdownResponseDTO> {
    const now = new Date()
    const [year, month] = period.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = now.getUTCDate()
    const isCurrentPeriod =
      year === now.getUTCFullYear() && month === now.getUTCMonth() + 1
    const daysElapsed = isCurrentPeriod ? today : daysInMonth
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed)

    const deviceWhere = opts.deviceId
      ? { organizationId, id: opts.deviceId }
      : { organizationId }
    const devices = await prisma.whatsappDevice.findMany({
      where: deviceWhere,
      select: {
        id: true,
        phoneNumber: true,
        quotaBase: true,
        quotaBaseOut: true,
        addonQuota: true,
        addonQuotaTotal: true,
      },
    })

    // ── Cost source: BillingAdjustment with source=WHATSAPP ─────────────
    const account = await prisma.billingAccount.findUnique({
      where: { organizationId },
      select: { id: true, balance: true, currency: true },
    })

    const costAdjustments = account
      ? await prisma.billingAdjustment.findMany({
          where: {
            billingAccountId: account.id,
            createdAt: {
              gte: new Date(`${period}-01`),
              lt: new Date(
                month === 12 ? year + 1 : year,
                month === 12 ? 0 : month,
                1
              ),
            },
          },
        })
      : []

    // Filter to only WhatsApp source adjustments (stored in metadataJson)
    const whatsappAdjustments = costAdjustments.filter((adj) => {
      const meta = adj.metadataJson as Record<string, unknown> | null
      return meta?.source === "WHATSAPP"
    })
    // Build per-device cost map from BillingAdjustment (totalCost only)
    const deviceCostMap = new Map<string, { total: number }>()
    for (const adj of whatsappAdjustments) {
      const meta = adj.metadataJson as Record<string, unknown> | null
      const rowDeviceId =
        typeof meta?.deviceId === "string" ? meta.deviceId : "unknown"
      if (opts.deviceId && rowDeviceId !== opts.deviceId) continue
      const entry = deviceCostMap.get(rowDeviceId) ?? { total: 0 }
      entry.total += toNum(adj.amount)
      deviceCostMap.set(rowDeviceId, entry)
    }

    // ── Category source: WhatsappBillingLedger ─────────────────────────
    const whatsappLedgerRows = await prisma.whatsappBillingLedger.findMany({
      where: {
        organizationId,
        isReverted: false,
        createdAt: {
          gte: new Date(`${period}-01`),
          lt: new Date(
            month === 12 ? year + 1 : year,
            month === 12 ? 0 : month,
            1
          ),
        },
      },
    })

    // Build per-device category breakdown from WhatsappBillingLedger
    const deviceCategoryMap = new Map<
      string,
      Map<string, { count: number; total: number }>
    >()
    for (const row of whatsappLedgerRows) {
      const rowDeviceId = row.whatsappDeviceId ?? "unknown"
      if (opts.deviceId && rowDeviceId !== opts.deviceId) continue
      if (!deviceCategoryMap.has(rowDeviceId)) {
        deviceCategoryMap.set(rowDeviceId, new Map())
      }
      const catMap = deviceCategoryMap.get(rowDeviceId)!
      const cat = row.category ?? "UNKNOWN"
      const catEntry = catMap.get(cat) ?? { count: 0, total: 0 }
      catEntry.count += 1
      catEntry.total += toNum(row.quotaValue)
      catMap.set(cat, catEntry)
    }

    // ── Build per-device breakdown ──────────────────────────────────────
    const byDevice: DeviceCostBreakdownDTO[] = devices.map((dev) => {
      const costs = deviceCostMap.get(dev.id) ?? { total: 0 }
      const catMap = deviceCategoryMap.get(dev.id) ?? new Map()
      const quotaBase = toNum(dev.quotaBase)
      const quotaBaseOut = toNum(dev.quotaBaseOut)
      const addonQuota = toNum(dev.addonQuota)
      const addonQuotaTotal = toNum(dev.addonQuotaTotal)
      const quotaUsed =
        quotaBase - quotaBaseOut + (addonQuotaTotal - addonQuota)
      const totalQuota = quotaBase + addonQuotaTotal
      const quotaPercent =
        totalQuota > 0 ? Math.min(100, (quotaUsed / totalQuota) * 100) : 0
      return {
        deviceId: dev.id,
        phoneNumber: dev.phoneNumber,
        totalCost: costs.total,
        byCategory: Array.from(catMap.entries()).map(([category, data]) => ({
          category,
          count: data.count,
          totalCost: data.total,
        })),
        messageCount: Array.from(catMap.values()).reduce(
          (sum, c) => sum + c.count,
          0
        ),
        quotaBase,
        quotaBaseOut,
        addonQuota,
        addonQuotaTotal,
        quotaUsed,
        quotaPercent,
      }
    })

    const totalCost = byDevice.reduce((s, d) => s + d.totalCost, 0)
    const projectedCost =
      isCurrentPeriod && daysElapsed > 0
        ? (totalCost / daysElapsed) * daysInMonth
        : totalCost

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
