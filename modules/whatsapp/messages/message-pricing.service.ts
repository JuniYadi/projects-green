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
}

export type WhatsappMessagePricing = {
  devices: Array<{
    deviceId: string
    phoneNumber: string
    country: string
    categories: Array<QuotaCreditRate & { configured: boolean }>
  }>
  overage: MessagePricing
}

export class WhatsappMessagePricingService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPricing(organizationId: string): Promise<WhatsappMessagePricing> {
    const [devices, overage] = await Promise.all([
      this.prisma.whatsappDevice.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true, phoneNumber: true },
        orderBy: { createdAt: "desc" },
      }),
      new MessageCostService(this.prisma).getMessagePricing({
        organizationId,
        messageType: "template",
      }),
    ])

    const deviceCountries = devices.map((device) => ({
      ...device,
      country: resolveWhatsappCountry(device.phoneNumber),
    }))
    const countries = [
      ...new Set(deviceCountries.map((device) => device.country)),
    ]
    const rates = countries.length
      ? await this.prisma.whatsappQuotaCreditRate.findMany({
          where: { country: { in: countries } },
        })
      : []

    const rateByCountryAndCategory = new Map(
      rates.map((rate) => [`${rate.country}:${rate.category}`, rate])
    )

    return {
      devices: deviceCountries.map((device) => ({
        deviceId: device.id,
        phoneNumber: device.phoneNumber,
        country: device.country,
        categories: Object.values(WhatsappBillingCategory).map((category) => {
          const rate = rateByCountryAndCategory.get(
            `${device.country}:${category}`
          )

          return {
            category,
            country: device.country,
            quotaCredit: rate?.quotaCredit ?? DEFAULT_WHATSAPP_QUOTA_CREDIT,
            description: rate?.description ?? null,
            configured: Boolean(rate),
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
