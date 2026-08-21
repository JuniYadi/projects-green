/**
 * WhatsApp Pricing Seeder (System)
 *
 * Seeds baseline quota credit deduction rates and wholesale base prices
 * for WhatsApp billing categories. Migrated from scripts/seed-whatsapp-pricing.ts.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { WhatsappBillingCategory } from "@prisma/client"

const BASELINE_QUOTA_RATES: Array<{
  category: WhatsappBillingCategory
  country: string
  quotaCredit: number
  description: string
}> = [
  {
    category: "MARKETING",
    country: "ID",
    quotaCredit: 2.0,
    description: "Marketing template rate",
  },
  {
    category: "AUTHENTICATION",
    country: "ID",
    quotaCredit: 1.5,
    description: "Authentication OTP rate",
  },
  {
    category: "UTILITY",
    country: "ID",
    quotaCredit: 1.0,
    description: "Utility template rate",
  },
  {
    category: "SERVICE",
    country: "ID",
    quotaCredit: 1.0,
    description: "Service conversation rate",
  },
]

const BASELINE_BASE_PRICES: Array<{
  category: WhatsappBillingCategory
  country: string
  basePrice: number
  metaCost: number
  currency: string
}> = [
  {
    category: "UTILITY",
    country: "ID",
    basePrice: 357,
    metaCost: 356.65,
    currency: "IDR",
  },
  {
    category: "AUTHENTICATION",
    country: "ID",
    basePrice: 357,
    metaCost: 356.65,
    currency: "IDR",
  },
  {
    category: "SERVICE",
    country: "ID",
    basePrice: 300,
    metaCost: 300.0,
    currency: "IDR",
  },
  {
    category: "MARKETING",
    country: "ID",
    basePrice: 587,
    metaCost: 586.5,
    currency: "IDR",
  },
]

export class WhatsappPricingSeeder extends BaseSeeder {
  static override readonly seederName = "WhatsappPricing"
  static override readonly classification = "system" as const
  static override readonly runOrder = 25
  static override readonly description =
    "Seeds baseline quota credit deduction rates and wholesale base prices for WhatsApp message categories"

  async seed(): Promise<void> {
    this.log("Seeding baseline WhatsApp Quota Credit Rates & Base Prices...")

    for (const rate of BASELINE_QUOTA_RATES) {
      const existing = await this.prisma.whatsappQuotaCreditRate.findFirst({
        where: {
          category: rate.category,
          country: rate.country,
          isActive: true,
        },
      })
      if (!existing) {
        await this.prisma.whatsappQuotaCreditRate.create({
          data: {
            category: rate.category,
            country: rate.country,
            quotaCredit: rate.quotaCredit,
            description: rate.description,
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
            isActive: true,
          },
        })
        this.trackCreated()
        this.log(
          `Created Quota Rate: ${rate.category} (${rate.country}) -> ${rate.quotaCredit}`
        )
      } else {
        this.trackSkipped()
      }
    }

    for (const price of BASELINE_BASE_PRICES) {
      const existing = await this.prisma.whatsappBasePrice.findFirst({
        where: {
          category: price.category,
          country: price.country,
          isActive: true,
        },
      })
      if (!existing) {
        await this.prisma.whatsappBasePrice.create({
          data: {
            category: price.category,
            country: price.country,
            basePrice: price.basePrice,
            metaCost: price.metaCost,
            currency: price.currency,
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
            isActive: true,
          },
        })
        this.trackCreated()
        this.log(
          `Created Base Price: ${price.category} (${price.country}) -> ${price.currency} ${price.basePrice}`
        )
      } else {
        this.trackSkipped()
      }
    }
  }
}

registerSeeder(WhatsappPricingSeeder)
