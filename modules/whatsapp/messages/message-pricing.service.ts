import {
  WhatsappBillingCategory,
  type Prisma,
  type PrismaClient,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_WHATSAPP_QUOTA_CREDIT,
  resolveWhatsappCountry,
} from "./quota-credit.service"
import {
  MessageCostService,
  type MessagePricing,
} from "@/modules/billing/message-cost.service"

type QuotaCreditRate = {
  category: WhatsappBillingCategory
  country: string
  quotaCredit: Prisma.Decimal
  description: string | null
  basePrice?: Prisma.Decimal | null
  overagePrice?: Prisma.Decimal | null
  feePercent?: number
  feeAmount?: Prisma.Decimal | null
  ppnAmount?: Prisma.Decimal | null
}

export type WhatsappMessagePricing = {
  devices: Array<{
    deviceId: string
    phoneNumber: string
    country: string
    rateTier: string
    categories: Array<QuotaCreditRate & { configured: boolean }>
  }>
  overage: MessagePricing
}

export class WhatsappMessagePricingService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPricing(
    organizationId: string,
    effectiveAt?: Date
  ): Promise<WhatsappMessagePricing> {
    const targetDate = effectiveAt ?? new Date()
    const messageCostService = new MessageCostService(this.prisma)

    const [devices, overage] = await Promise.all([
      this.prisma.whatsappDevice.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true, phoneNumber: true, rates: true },
        orderBy: { createdAt: "desc" },
      }),
      messageCostService.getMessagePricing({
        organizationId,
        messageType: "template",
        effectiveAt: targetDate,
      }),
    ])

    const deviceCountries = devices.map((device) => ({
      ...device,
      country: resolveWhatsappCountry(device.phoneNumber),
      rateTier: device.rates?.trim()
        ? device.rates.trim().toUpperCase()
        : "BASE",
    }))
    const countries = [
      ...new Set(deviceCountries.map((device) => device.country)),
    ]

    const [rates, basePrices] = await Promise.all([
      countries.length
        ? this.prisma.whatsappQuotaCreditRate.findMany({
            where: {
              country: { in: countries },
              isActive: true,
              effectiveFrom: { lte: targetDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }],
            },
            orderBy: { effectiveFrom: "desc" },
          })
        : [],
      countries.length
        ? this.prisma.whatsappBasePrice.findMany({
            where: {
              country: { in: countries },
              isActive: true,
              effectiveFrom: { lte: targetDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }],
            },
            orderBy: { effectiveFrom: "desc" },
          })
        : [],
    ])

    const rateByCountryAndCategory = new Map(
      rates.map((rate) => [`${rate.country}:${rate.category}`, rate])
    )
    const basePriceByCountryAndCategory = new Map(
      basePrices.map((bp) => [`${bp.country}:${bp.category}`, bp])
    )

    return {
      devices: deviceCountries.map((device) => ({
        deviceId: device.id,
        phoneNumber: device.phoneNumber,
        country: device.country,
        rateTier: device.rateTier,
        categories: Object.values(WhatsappBillingCategory).map((category) => {
          const rate = rateByCountryAndCategory.get(
            `${device.country}:${category}`
          )
          const bp = basePriceByCountryAndCategory.get(
            `${device.country}:${category}`
          )

          const basePrice = bp?.basePrice ?? null
          let feePercent = 20
          let feeAmount = null
          let ppnAmount = null
          let overagePrice = null

          if (basePrice) {
            const feeMap: Record<string, number> = {
              BASE: 20,
              TIER_1: 15,
              TIER_2: 10,
              TIER_3: 5,
            }
            feePercent = feeMap[device.rateTier] ?? 20
            const baseNum = Number(basePrice.toString())
            const fee = Math.ceil((baseNum * feePercent) / 100)
            const ppn = Math.ceil((baseNum * 11) / 100)
            feeAmount = new Prisma.Decimal(fee)
            ppnAmount = new Prisma.Decimal(ppn)
            overagePrice = new Prisma.Decimal(baseNum + fee + ppn)
          }

          return {
            category,
            country: device.country,
            quotaCredit: rate?.quotaCredit ?? DEFAULT_WHATSAPP_QUOTA_CREDIT,
            description: rate?.description ?? null,
            configured: Boolean(rate),
            basePrice,
            overagePrice,
            feePercent,
            feeAmount,
            ppnAmount,
          }
        }),
      })),
      overage,
    }
  }
}

export const whatsappMessagePricingService = new WhatsappMessagePricingService(
  prisma
)
