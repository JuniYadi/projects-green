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
 * TODO: Integrate with QuotaGateService.deductMessageQuota
 * After incrementing counters, record the billable event:
 *   await usageLedgerService.recordUsage({
 *     tenantId: subscription.tenantId,
 *     subscriptionId: subscription.id,
 *     period: "YYYY-MM",
 *     entry: { category: "WHATSAPP_MESSAGE_OUT", amountIdr: ..., metadata: ... }
 *   })
 *
 * This is intentionally left as a separate call so callers can batch or skip
 * ledger recording without blocking the quota check/deduct flow.
 */
export class UsageLedgerService {
  constructor(private prisma: PrismaClient) {}

  async recordUsage(params: {
    tenantId: string
    subscriptionId: string
    period: string
    entry: UsageLedgerEntry
  }): Promise<{
    id: string
    tenantId: string
    subscriptionId: string
    period: string
    category: string | null
    amountIdr: Decimal | null
    metadata: Prisma.InputJsonValue | null
    createdAt: Date
  }> {
    return this.prisma.usageLedger.create({
      data: {
        tenantId: params.tenantId,
        subscriptionId: params.subscriptionId,
        period: params.period,
        category: params.entry.category,
        amountIdr: params.entry.amountIdr,
        metadata: params.entry.metadata ?? undefined,
      },
    })
  }

  async getSpendByCategory(
    tenantId: string,
    period: string,
  ): Promise<{ category: string | null; totalIdr: Decimal }[]> {
    const result = await this.prisma.usageLedger.groupBy({
      by: ["category"],
      where: {
        tenantId,
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
    tenantId: string,
    period: string,
    category?: string,
  ): Promise<
    {
      id: string
      tenantId: string
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
        tenantId,
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

  async getTotalSpend(tenantId: string, period: string): Promise<Decimal> {
    const result = await this.prisma.usageLedger.aggregate({
      where: {
        tenantId,
        period,
      },
      _sum: {
        amountIdr: true,
      },
    })

    return result._sum.amountIdr ?? new Decimal(0)
  }

  async generateRatedUsage(
    tenantId: string,
    period: string,
  ): Promise<RatedUsage[]> {
    const entries = await this.prisma.usageLedger.findMany({
      where: {
        tenantId,
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
}