import type { WhatsappBillingCategory } from "@prisma/client"
import type { WhatsappMessagePricing } from "./message-pricing.service"

export type WhatsappMessagePricingCategoryDTO = {
  category: WhatsappBillingCategory
  quotaCredit: string
  configured: boolean
  description: string | null
}

export type WhatsappMessagePricingDeviceDTO = {
  deviceId: string
  phoneNumber: string
  country: string
  categories: WhatsappMessagePricingCategoryDTO[]
}

export type WhatsappMessagePricingDTO = {
  devices: WhatsappMessagePricingDeviceDTO[]
  overage: {
    unitPrice: string | null
    currency: string | null
    configured: boolean
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
      categories: device.categories.map((category) => ({
        category: category.category,
        quotaCredit: category.quotaCredit.toString(),
        configured: category.configured,
        description: category.description,
      })),
    })),
    overage: {
      unitPrice: pricing.overage.unitPrice?.toString() ?? null,
      currency: pricing.overage.currency,
      configured: pricing.overage.configured,
    },
  }
}
