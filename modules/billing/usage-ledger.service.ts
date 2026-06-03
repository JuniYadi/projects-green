import { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal
import { UsageLedgerEntry } from "./types"

export interface RatedUsage {
  subscriptionId: string
  category: string | null
  rawAmountIdr: Decimal
  cappedAmountIdr: Decimal
  meterType: string
  meterValue: number
}

/**
 * Usage Ledger Service
 *
 * Callers: invoke recordUsage after deductMessageQuota to record the billable
 * event. This is intentionally a separate call so callers can batch or skip
 * ledger recording without blocking the quota check/deduct flow.
 */
export class UsageLedgerService {
  constructor(private prisma: PrismaClient) {}

  async recordUsage(params: {
    organizationId: string
    subscriptionId: string
    period: string
    entry: UsageLedgerEntry
  }): Promise<{
    id: string
    organizationId: string
    subscriptionId: string
    period: string
    category: string | null
    amountIdr: Decimal | null
    metadata: Prisma.InputJsonValue | null
    createdAt: Date
  }> {
    return this.prisma.usageLedger.create({
      data: {
        organizationId: params.organizationId,
        subscriptionId: params.subscriptionId,
        period: params.period,
        category: params.entry.category,
        amountIdr: params.entry.amountIdr,
        metadata: params.entry.metadata ?? undefined,
      },
    })
  }

  async getSpendByCategory(
    organizationId: string,
    period: string,
  ): Promise<{ category: string | null; totalIdr: Decimal }[]> {
    const result = await this.prisma.usageLedger.groupBy({
      by: ["category"],
      where: {
        organizationId,
        period,
      },
      _sum: {
        amountIdr: true,
      },
      orderBy: {
        _sum: {
          amountIdr: "desc",
        },
      },
    })

    return result.map((row) => ({
      category: row.category,
      totalIdr: row._sum.amountIdr ?? new Decimal(0),
    }))
  }

  async getLedgerEntries(
    organizationId: string,
    period: string,
    category?: string,
  ): Promise<
    {
      id: string
      organizationId: string
      subscriptionId: string
      period: string
      category: string | null
      amountIdr: Decimal | null
      metadata: Prisma.InputJsonValue | null
      createdAt: Date
    }[]
  > {
    return this.prisma.usageLedger.findMany({
      where: {
        organizationId,
        period,
        ...(category ? { category } : {}),
      },
      include: {
        subscription: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    })
  }

  async getTotalSpend(organizationId: string, period: string): Promise<Decimal> {
    const result = await this.prisma.usageLedger.aggregate({
      where: {
        organizationId,
        period,
      },
      _sum: {
        amountIdr: true,
      },
    })

    return result._sum.amountIdr ?? new Decimal(0)
  }

  async generateRatedUsage(
    organizationId: string,
    period: string,
  ): Promise<RatedUsage[]> {
    const entries = await this.prisma.usageLedger.findMany({
      where: {
        organizationId,
        period,
      },
      include: {
        subscription: {
          include: {
            pricing: {
              select: {
                monthlyCapIdr: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    // Group by subscriptionId + category
    const groups = new Map<string, { rawAmountIdr: Decimal; subscriptionId: string; category: string | null; monthlyCapIdr: Decimal | null | undefined }>()

    for (const entry of entries) {
      const key = `${entry.subscriptionId}::${entry.category ?? ""}`
      const existing = groups.get(key)

      const monthlyCapIdr = entry.subscription.pricing?.monthlyCapIdr
      const entryAmount = entry.amountIdr ?? new Decimal(0)

      if (existing) {
        existing.rawAmountIdr = existing.rawAmountIdr.plus(entryAmount)
      } else {
        groups.set(key, {
          subscriptionId: entry.subscriptionId,
          category: entry.category ?? null,
          rawAmountIdr: entryAmount,
          monthlyCapIdr,
        })
      }
    }

    const ratedUsageList: RatedUsage[] = []

    for (const group of groups.values()) {
      const rawAmountIdr = group.rawAmountIdr
      let cappedAmountIdr = rawAmountIdr

      // Apply monthly cap if set
      if (group.monthlyCapIdr !== null && group.monthlyCapIdr !== undefined && rawAmountIdr.gt(group.monthlyCapIdr)) {
        cappedAmountIdr = group.monthlyCapIdr
      }

      // Convert Decimal to number for meterValue
      const meterValue = Number(rawAmountIdr.toString())

      ratedUsageList.push({
        subscriptionId: group.subscriptionId,
        category: group.category,
        rawAmountIdr,
        cappedAmountIdr,
        meterType: "usage",
        meterValue,
      })
    }

    return ratedUsageList
  }

  async getUsageByDateRange(
    organizationId: string,
    from: string,
    to: string,
    category?: string,
  ): Promise<
    {
      id: string
      organizationId: string
      subscriptionId: string
      period: string
      category: string | null
      amountIdr: Decimal | null
      metadata: Prisma.InputJsonValue | null
      createdAt: Date
    }[]
  > {
    return this.prisma.usageLedger.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
        ...(category ? { category } : {}),
      },
      include: {
        subscription: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    })
  }

  async getDailyUsageTrend(
    organizationId: string,
    days: number = 30,
  ): Promise<{ date: string; amount: Decimal }[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const entries = await this.prisma.usageLedger.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    const dailyMap = new Map<string, Decimal>()

    for (const entry of entries) {
      const dateStr = entry.createdAt.toISOString().split("T")[0]
      const existing = dailyMap.get(dateStr) ?? new Decimal(0)
      dailyMap.set(dateStr, existing.plus(entry.amountIdr ?? 0))
    }

    return Array.from(dailyMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }))
  }
}