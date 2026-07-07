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
    period: string,
    opts: { deviceId?: string } = {}
  ): Promise<CostBreakdownResponseDTO> {
    const now = new Date()
    const [year, month] = period.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = now.getUTCDate()
    const isCurrentPeriod = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1
    const daysElapsed = isCurrentPeriod ? today : daysInMonth
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed)

    const deviceWhere = opts.deviceId
      ? { organizationId, id: opts.deviceId }
      : { organizationId }
    const devices = await prisma.whatsappDevice.findMany({
      where: deviceWhere,
      select: { id: true, phoneNumber: true, quotaBase: true },
    })

    // Fetch ledger rows (cost in IDR) via typed query
    const ledgerRows = await prisma.billingUsageLedger.findMany({
      where: {
        organizationId,
        period,
        category: { in: WHATSAPP_CATEGORIES },
      },
    })

    // Fetch WhatsApp billing ledger rows (quota credits)
    const whatsappLedgerRows = await prisma.whatsappBillingLedger.findMany({
      where: {
        organizationId,
        isReverted: false,
        createdAt: {
          gte: new Date(`${period}-01`),
          lt: new Date(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`),
        },
      },
    })

    // Build device cost map from BillingUsageLedger (IDR cost + message count)
    const deviceCostMap = new Map<string, { total: number; byCat: Map<string, { count: number; total: number }>; messageCount: number }>()
    for (const row of ledgerRows) {
      const metadata = row.metadata as Record<string, unknown> | null
      const rowDeviceId = typeof metadata?.deviceId === "string" ? metadata.deviceId : "unknown"
      if (opts.deviceId && rowDeviceId !== opts.deviceId) continue
      if (!deviceCostMap.has(rowDeviceId)) {
        deviceCostMap.set(rowDeviceId, { total: 0, byCat: new Map(), messageCount: 0 })
      }
      const entry = deviceCostMap.get(rowDeviceId)!
      const amount = toNum(row.amountIdr)
      entry.total += amount
      entry.messageCount += 1
      const cat = row.category ?? "UNKNOWN"
      const catEntry = entry.byCat.get(cat) ?? { count: 0, total: 0 }
      catEntry.count += 1
      catEntry.total += amount
      entry.byCat.set(cat, catEntry)
    }

    // Build device quota map from WhatsappBillingLedger (quota credits, keyed by whatsappDeviceId)
    const deviceQuotaMap = new Map<string, number>()
    for (const row of whatsappLedgerRows) {
      const rowDeviceId = row.whatsappDeviceId ?? "unknown"
      if (opts.deviceId && rowDeviceId !== opts.deviceId) continue
      const quotaVal = toNum(row.quotaValue)
      deviceQuotaMap.set(rowDeviceId, (deviceQuotaMap.get(rowDeviceId) ?? 0) + quotaVal)
    }

    // Build per-device breakdown — union of known devices and ledger device IDs
    const deviceIdsFromLedger = Array.from(deviceCostMap.keys())
    const byDevice: DeviceCostBreakdownDTO[] = devices.map((dev) => {
      const costs = deviceCostMap.get(dev.id) ?? { total: 0, byCat: new Map(), messageCount: 0 }
      const quotaBase = toNum(dev.quotaBase)
      const quotaUsed = deviceQuotaMap.get(dev.id) ?? 0
      const quotaPercent = quotaBase > 0 ? Math.min(100, (quotaUsed / quotaBase) * 100) : 0
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
        quotaUsed,
        quotaPercent,
      }
    })

    // Add ledger-only device IDs (not in device table)
    for (const ledgerDevId of deviceIdsFromLedger) {
      if (devices.some((d) => d.id === ledgerDevId)) continue
      const costs = deviceCostMap.get(ledgerDevId)!
      byDevice.push({
        deviceId: ledgerDevId,
        phoneNumber: null,
        totalCost: costs.total,
        byCategory: Array.from(costs.byCat.entries()).map(([category, data]) => ({
          category,
          count: data.count,
          totalCost: data.total,
        })),
        messageCount: costs.messageCount,
        quotaBase: 0,
        quotaUsed: deviceQuotaMap.get(ledgerDevId) ?? 0,
        quotaPercent: 0,
      })
    }

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
