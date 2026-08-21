import {
  WhatsappBillingCategory,
  Prisma,
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
  currency?: string | null
  basePrice?: Prisma.Decimal | null
  overagePrice?: Prisma.Decimal | null
  feePercent?: number
  feeAmount?: Prisma.Decimal | null
  ppnAmount?: Prisma.Decimal | null
  tierPrices?: {
    BASE: Prisma.Decimal | null
    TIER_1: Prisma.Decimal | null
    TIER_2: Prisma.Decimal | null
    TIER_3: Prisma.Decimal | null
  }
}

export type WhatsappMessagePricing = {
  devices: Array<{
    deviceId: string
    phoneNumber: string
    country: string
    rateTier: string
    quotaRemaining: number
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
        select: {
          id: true,
          phoneNumber: true,
          rates: true,
          quotaBaseOut: true,
          addonQuota: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      messageCostService.getMessagePricing({
        organizationId,
        messageType: "template",
        effectiveAt: targetDate,
      }),
    ])

    const deviceCountries = devices.map((device) => {
      const defaultRemaining = Number(device.quotaBaseOut ?? 0)
      const addonRemaining = Number(device.addonQuota ?? 0)
      return {
        ...device,
        country: resolveWhatsappCountry(device.phoneNumber),
        quotaRemaining: defaultRemaining + addonRemaining,
        rateTier: ((): string => {
          const raw = device.rates?.trim().toUpperCase() ?? ""
          const validTiers: Record<string, true> = {
            BASE: true,
            TIER_1: true,
            TIER_2: true,
            TIER_3: true,
          }
          return validTiers[raw] ? raw : "BASE"
        })(),
      }
    })
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

    const rateByCountryAndCategory = new Map<string, (typeof rates)[0]>()
    for (const rate of rates) {
      const key = `${rate.country}:${rate.category}`
      if (!rateByCountryAndCategory.has(key))
        rateByCountryAndCategory.set(key, rate)
    }
    const basePriceByCountryAndCategory = new Map<
      string,
      (typeof basePrices)[0]
    >()
    for (const bp of basePrices) {
      const key = `${bp.country}:${bp.category}`
      if (!basePriceByCountryAndCategory.has(key))
        basePriceByCountryAndCategory.set(key, bp)
    }

    return {
      devices: deviceCountries.map((device) => ({
        deviceId: device.id,
        phoneNumber: device.phoneNumber,
        country: device.country,
        rateTier: device.rateTier,
        quotaRemaining: device.quotaRemaining,
        categories: (
          [
            WhatsappBillingCategory.MARKETING,
            WhatsappBillingCategory.UTILITY,
            WhatsappBillingCategory.AUTHENTICATION,
            WhatsappBillingCategory.SERVICE,
          ] as const
        ).map((category) => {
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
          let tierPrices = {
            BASE: null as Prisma.Decimal | null,
            TIER_1: null as Prisma.Decimal | null,
            TIER_2: null as Prisma.Decimal | null,
            TIER_3: null as Prisma.Decimal | null,
          }

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

            const calcForMargin = (marginPct: number) => {
              const marginFee = Math.ceil((baseNum * marginPct) / 100)
              const marginPpn = Math.ceil((baseNum * 11) / 100)
              return new Prisma.Decimal(baseNum + marginFee + marginPpn)
            }

            tierPrices = {
              BASE: calcForMargin(20),
              TIER_1: calcForMargin(15),
              TIER_2: calcForMargin(10),
              TIER_3: calcForMargin(5),
            }
          }
          return {
            category,
            country: device.country,
            quotaCredit: rate?.quotaCredit ?? DEFAULT_WHATSAPP_QUOTA_CREDIT,
            description: rate?.description ?? null,
            configured: Boolean(rate),
            currency: bp?.currency ?? "IDR",
            basePrice,
            overagePrice,
            feePercent,
            feeAmount,
            ppnAmount,
            tierPrices,
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
