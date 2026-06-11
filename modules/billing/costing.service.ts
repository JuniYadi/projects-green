import { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal
import { CostingResult, UsageBreakdown } from "./types"
import { STORAGE_RATE_PER_GB_MONTH_IDR } from "./constants"

export class CostingService {
  constructor(private prisma: PrismaClient) {}

  async calculateWhatsAppCost(params: {
    organizationId: string
    subscriptionId: string
    messageType: string
    region: string
    quantity: number
  }): Promise<CostingResult> {
    const subscription = await this.prisma.serviceSubscription.findUnique({
      where: { id: params.subscriptionId },
      include: { pricing: true },
    })

    if (!subscription?.pricing?.unitRateMessage) {
      return {
        category: "whatsapp",
        quantity: params.quantity,
        unitPrice: new Decimal(0),
        totalCost: new Decimal(0),
        serviceType: "WHATSAPP",
      }
    }

    const unitPrice = new Decimal(subscription.pricing.unitRateMessage)
    const totalCost = unitPrice.mul(params.quantity)

    return {
      category: "whatsapp",
      quantity: params.quantity,
      unitPrice,
      totalCost,
      serviceType: "WHATSAPP",
    }
  }

  async calculateHostingCost(params: {
    organizationId: string
    subscriptionId: string
    vcpuHours: number
    memoryGbHours: number
    storageGbMonths: number
  }): Promise<CostingResult> {
    const subscription = await this.prisma.serviceSubscription.findUnique({
      where: { id: params.subscriptionId },
      include: { pricing: true },
    })

    if (!subscription?.pricing) {
      return {
        category: "hosting",
        quantity: params.vcpuHours + params.memoryGbHours + params.storageGbMonths,
        unitPrice: new Decimal(0),
        totalCost: new Decimal(0),
        serviceType: "APP_HOSTING",
      }
    }

    const cpuCost = new Decimal(subscription.pricing.unitRateCpu ?? 0).mul(params.vcpuHours)
    const memCost = new Decimal(subscription.pricing.unitRateMem ?? 0).mul(params.memoryGbHours)
    const storageCost = new Decimal(STORAGE_RATE_PER_GB_MONTH_IDR).mul(params.storageGbMonths)

    const totalCost = cpuCost.plus(memCost).plus(storageCost)

    return {
      category: "hosting",
      quantity: params.vcpuHours + params.memoryGbHours + params.storageGbMonths,
      unitPrice: new Decimal(0),
      totalCost,
      serviceType: "APP_HOSTING",
    }
  }

  async getUsageBreakdown(
    organizationId: string,
    period: string,
  ): Promise<UsageBreakdown[]> {
    const entries = await this.prisma.billingUsageLedger.findMany({
      where: {
        organizationId,
        period,
      },
    })

    const categoryMap = new Map<string, { totalCost: Decimal; entryCount: number }>()

    for (const entry of entries) {
      const category = entry.category ?? "unknown"
      const existing = categoryMap.get(category) ?? { totalCost: new Decimal(0), entryCount: 0 }
      existing.totalCost = existing.totalCost.plus(entry.amountIdr ?? 0)
      existing.entryCount += 1
      categoryMap.set(category, existing)
    }

    const totalSpend = Array.from(categoryMap.values()).reduce(
      (sum, val) => sum.plus(val.totalCost),
      new Decimal(0),
    )

    const breakdown: UsageBreakdown[] = []

    for (const [category, data] of categoryMap.entries()) {
      const percentage = totalSpend.gt(0)
        ? data.totalCost.div(totalSpend).mul(100).toNumber()
        : 0

      breakdown.push({
        category,
        quantity: data.entryCount,
        totalCost: data.totalCost,
        percentage,
      })
    }

    return breakdown.sort((a, b) => b.totalCost.minus(a.totalCost).toNumber())
  }
}
