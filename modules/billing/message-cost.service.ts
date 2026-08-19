import { PrismaClient, Prisma, WhatsappBillingCategory } from "@prisma/client"
import Decimal = Prisma.Decimal
import { BalanceGateService } from "./balance-gate.service"

export type MessageType = "text" | "template" | "media"

export const WHATSAPP_RATE_TIER_MARGINS: Record<string, number> = {
  BASE: 20,
  TIER_1: 15,
  TIER_2: 10,
  TIER_3: 5,
}

export const WHATSAPP_PPN_PERCENT = 11

export function calculateTieredMessageCost(
  basePrice: number | Decimal,
  rateTier = "BASE"
): {
  basePrice: Decimal
  feePercent: number
  feeAmount: Decimal
  ppnAmount: Decimal
  totalCharged: Decimal
} {
  const base =
    typeof basePrice === "number" ? basePrice : Number(basePrice.toString())
  const feePercent =
    WHATSAPP_RATE_TIER_MARGINS[rateTier.toUpperCase()] ??
    WHATSAPP_RATE_TIER_MARGINS.BASE

  const fee = Math.ceil((base * feePercent) / 100)
  const ppn = Math.ceil((base * WHATSAPP_PPN_PERCENT) / 100)
  const total = base + fee + ppn

  return {
    basePrice: new Decimal(base),
    feePercent,
    feeAmount: new Decimal(fee),
    ppnAmount: new Decimal(ppn),
    totalCharged: new Decimal(total),
  }
}

export type MessagePricing = {
  unitPrice: Decimal | null
  currency: string | null
  configured: boolean
  rateTier?: string
  feePercent?: number
  feeAmount?: Decimal | null
  ppnAmount?: Decimal | null
  basePrice?: Decimal | null
}

export class MessageCostService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Resolve the active base price for a WhatsApp billing category at a given date.
   */
  async getEffectiveBasePrice(options: {
    category: WhatsappBillingCategory
    country?: string
    effectiveAt?: Date
  }) {
    const country = options.country ?? "ID"
    const targetDate = options.effectiveAt ?? new Date()

    const specific = await this.prisma.whatsappBasePrice.findFirst({
      where: {
        category: options.category,
        country,
        isActive: true,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    })
    if (specific) return specific

    return this.prisma.whatsappBasePrice.findFirst({
      where: {
        category: options.category,
        isActive: true,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    })
  }
  async getMessagePricing(options: {
    organizationId: string
    messageType: MessageType
    deviceId?: string
    category?: WhatsappBillingCategory
    country?: string
    effectiveAt?: Date
  }): Promise<MessagePricing> {
    const category = options.category ?? "UTILITY"
    const country = options.country ?? "ID"

    let rateTier = "BASE"
    if (options.deviceId) {
      const device = await this.prisma.whatsappDevice.findUnique({
        where: { id: options.deviceId },
        select: { rates: true },
      })
      if (device?.rates?.trim()) {
        rateTier = device.rates.trim().toUpperCase()
      }
    }

    const basePriceRecord = await this.getEffectiveBasePrice({
      category,
      country,
      effectiveAt: options.effectiveAt,
    })

    if (basePriceRecord) {
      const calculated = calculateTieredMessageCost(
        basePriceRecord.basePrice,
        rateTier
      )
      return {
        unitPrice: calculated.totalCharged,
        currency: basePriceRecord.currency,
        configured: true,
        rateTier,
        feePercent: calculated.feePercent,
        feeAmount: calculated.feeAmount,
        ppnAmount: calculated.ppnAmount,
        basePrice: calculated.basePrice,
      }
    }

    // Fallback to ServicePricing if no WhatsappBasePrice is seeded
    const subscription = await this.prisma.serviceSubscription.findFirst({
      where: {
        organizationId: options.organizationId,
        package: { code: "WHATSAPP" },
        status: "ACTIVE",
      },
      include: {
        plan: { select: { resources: true } },
      },
    })

    if (!subscription) {
      return { unitPrice: null, currency: null, configured: false }
    }

    const resources = subscription.plan?.resources as
      | Record<string, unknown>
      | undefined
    if (resources && resources.unlimited === true) {
      return { unitPrice: null, currency: null, configured: false }
    }

    const balanceGate = new BalanceGateService(this.prisma)

    try {
      const pricing = await balanceGate.findPricing({
        planId: subscription.planId,
        regionId: "GLOBAL",
        type: "PAYG",
        billingMode: "PAYG",
      })

      return {
        unitPrice: pricing.unitRateMessage,
        currency: pricing.currency ?? null,
        configured:
          pricing.unitRateMessage !== null &&
          pricing.unitRateMessage !== undefined,
      }
    } catch {
      return { unitPrice: null, currency: null, configured: false }
    }
  }

  /**
   * Estimate the per-message cost for WhatsApp outbound messaging.
   */
  async estimateMessageCost(options: {
    organizationId: string
    messageType: MessageType
    deviceId?: string
    category?: WhatsappBillingCategory
    country?: string
    effectiveAt?: Date
  }): Promise<Decimal> {
    const pricing = await this.getMessagePricing(options)
    return pricing.unitPrice ?? new Decimal(0)
  }

  /**
   * Convenience wrapper that checks whether the org has sufficient
   * balance to cover the estimated cost of one message.
   */
  async checkBalanceForMessage(options: {
    organizationId: string
    messageType: MessageType
    deviceId?: string
    category?: WhatsappBillingCategory
    country?: string
    effectiveAt?: Date
  }): Promise<
    | { sufficient: true; required: Decimal; available: Decimal }
    | { sufficient: false; required: Decimal; available: Decimal }
  > {
    const estimatedCost = await this.estimateMessageCost(options)

    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: options.organizationId },
      select: { balance: true },
    })

    if (!account) {
      return {
        sufficient: false,
        required: estimatedCost,
        available: new Decimal(0),
      }
    }

    const sufficient = account.balance.gte(estimatedCost)

    return {
      sufficient,
      required: estimatedCost,
      available: account.balance,
    }
  }
}
