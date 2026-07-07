import { Prisma, type WhatsappBillingCategory } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const DEFAULT_WHATSAPP_QUOTA_CREDIT = new Prisma.Decimal(1)

/**
 * Resolve the country code from a phone number.
 * Returns "ID" for Indonesian numbers (+62, 62, 0xx), otherwise "UNKNOWN".
 */
export function resolveWhatsappCountry(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "")

  // +62 prefix
  if (digits.startsWith("62")) {
    return "ID"
  }
  // Local 0xx prefix (e.g., 0812, 0813)
  if (digits.startsWith("0")) {
    return "ID"
  }

  return "UNKNOWN"
}

export type ResolveQuotaCreditResult = {
  category: WhatsappBillingCategory
  country: string
  quotaCredit: Prisma.Decimal
  description: string | null
}

/**
 * Resolve the quota credit for a given billing category and phone number.
 * Queries the WhatsappQuotaCreditRate table; falls back to DEFAULT_WHATSAPP_QUOTA_CREDIT
 * with description: null when no rate exists.
 */
export async function resolveWhatsappQuotaCredit(input: {
  category: WhatsappBillingCategory
  phoneNumber: string
}): Promise<ResolveQuotaCreditResult> {
  const country = resolveWhatsappCountry(input.phoneNumber)

  const rate = await prisma.whatsappQuotaCreditRate.findUnique({
    where: {
      category_country: {
        category: input.category,
        country,
      },
    },
  })

  if (!rate) {
    return {
      category: input.category,
      country,
      quotaCredit: DEFAULT_WHATSAPP_QUOTA_CREDIT,
      description: null,
    }
  }

  return {
    category: rate.category,
    country: rate.country,
    quotaCredit: rate.quotaCredit,
    description: rate.description,
  }
}
