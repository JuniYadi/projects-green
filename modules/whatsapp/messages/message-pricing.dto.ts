import type { WhatsappBillingCategory } from "@prisma/client"
import type { WhatsappMessagePricing } from "./message-pricing.service"

export type WhatsappMessagePricingCategoryDTO = {
  category: WhatsappBillingCategory
  quotaCredit: string
  configured: boolean
  description: string | null
  basePrice: string | null
  overagePrice: string | null
  feePercent: number
  feeAmount: string | null
  ppnAmount: string | null
}

export type WhatsappMessagePricingDeviceDTO = {
  deviceId: string
  phoneNumber: string
  country: string
  rateTier: string
  categories: WhatsappMessagePricingCategoryDTO[]
}

export type WhatsappMessagePricingDTO = {
  devices: WhatsappMessagePricingDeviceDTO[]
  overage: {
    unitPrice: string | null
    currency: string | null
    configured: boolean
    rateTier?: string
    feePercent?: number
    feeAmount?: string | null
    ppnAmount?: string | null
    basePrice?: string | null
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
      categories: device.categories.map((category) => ({
        category: category.category,
        quotaCredit: category.quotaCredit.toString(),
        configured: category.configured,
        description: category.description,
        basePrice: category.basePrice?.toString() ?? null,
        overagePrice: category.overagePrice?.toString() ?? null,
        feePercent: category.feePercent ?? 20,
        feeAmount: category.feeAmount?.toString() ?? null,
        ppnAmount: category.ppnAmount?.toString() ?? null,
      })),
    })),
    overage: {
      unitPrice: pricing.overage.unitPrice?.toString() ?? null,
      currency: pricing.overage.currency,
      configured: pricing.overage.configured,
      rateTier: pricing.overage.rateTier,
      feePercent: pricing.overage.feePercent,
      feeAmount: pricing.overage.feeAmount?.toString() ?? null,
      ppnAmount: pricing.overage.ppnAmount?.toString() ?? null,
      basePrice: pricing.overage.basePrice?.toString() ?? null,
    },
  }
}
