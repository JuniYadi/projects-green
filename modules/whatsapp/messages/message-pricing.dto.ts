import type { WhatsappBillingCategory } from "@prisma/client"
import type { WhatsappMessagePricing } from "./message-pricing.service"

export type WhatsappMessagePricingCategoryDTO = {
  category: WhatsappBillingCategory
  quotaCredit: string
  configured: boolean
  description: string | null
  currency: string | null
  overagePrice: string | null
  tierPrices: {
    BASE: string | null
    TIER_1: string | null
    TIER_2: string | null
    TIER_3: string | null
  }
}

export type WhatsappMessagePricingDeviceDTO = {
  deviceId: string
  phoneNumber: string
  country: string
  rateTier: string
  quotaRemaining: number
  categories: WhatsappMessagePricingCategoryDTO[]
}

export type WhatsappMessagePricingDTO = {
  devices: WhatsappMessagePricingDeviceDTO[]
  overage: {
    unitPrice: string | null
    currency: string | null
    configured: boolean
    rateTier?: string
  }
}

export function toWhatsappMessagePricingDTO(
  pricing: WhatsappMessagePricing
): WhatsappMessagePricingDTO {
  return {
    devices: pricing.devices.map((device) => ({
      deviceId: device.deviceId,
      phoneNumber: device.phoneNumber,
      country: device.country,
      rateTier: device.rateTier,
      quotaRemaining: device.quotaRemaining,
      categories: device.categories.map((category) => ({
        category: category.category,
        quotaCredit: category.quotaCredit.toString(),
        configured: category.configured,
        description: category.description,
        currency: category.currency ?? "IDR",
        overagePrice: category.overagePrice?.toString() ?? null,
        tierPrices: {
          BASE: category.tierPrices?.BASE?.toString() ?? null,
          TIER_1: category.tierPrices?.TIER_1?.toString() ?? null,
          TIER_2: category.tierPrices?.TIER_2?.toString() ?? null,
          TIER_3: category.tierPrices?.TIER_3?.toString() ?? null,
        },
      })),
    })),
    overage: {
      unitPrice: pricing.overage.unitPrice?.toString() ?? null,
      currency: pricing.overage.currency,
      configured: pricing.overage.configured,
      rateTier: pricing.overage.rateTier,
    },
  }
}
