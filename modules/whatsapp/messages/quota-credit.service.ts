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
 * Check if a destination country is configured and active in the database rates.
 */
export async function isDestinationCountrySupported(
  phoneNumber: string,
  effectiveAt?: Date
): Promise<{ supported: boolean; country: string }> {
  const country = resolveWhatsappCountry(phoneNumber)
  if (country === "UNKNOWN") {
    return { supported: false, country }
  }

  const targetDate = effectiveAt ?? new Date()

  const hasRate = await prisma.whatsappQuotaCreditRate.findFirst({
    where: {
      country,
      isActive: true,
      effectiveFrom: { lte: targetDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }],
    },
    select: { id: true },
  })

  return { supported: Boolean(hasRate), country }
}

/**
 * Resolve the quota credit for a given billing category and phone number at a specific date.
 * Queries the WhatsappQuotaCreditRate table for the active effective date range.
 */
export async function resolveWhatsappQuotaCredit(input: {
  category: WhatsappBillingCategory
  phoneNumber: string
  effectiveAt?: Date
}): Promise<ResolveQuotaCreditResult> {
  const country = resolveWhatsappCountry(input.phoneNumber)
  const targetDate = input.effectiveAt ?? new Date()

  const rate = await prisma.whatsappQuotaCreditRate.findFirst({
    where: {
      category: input.category,
      country,
      isActive: true,
      effectiveFrom: { lte: targetDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
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
