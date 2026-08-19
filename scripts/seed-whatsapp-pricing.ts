import { WhatsappBillingCategory } from "@prisma/client"
import { prisma } from "@/lib/prisma"
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

async function seed() {
  console.log("Seeding baseline WhatsApp Quota Credit Rates & Base Prices...")

  for (const rate of BASELINE_QUOTA_RATES) {
    const existing = await prisma.whatsappQuotaCreditRate.findFirst({
      where: {
        category: rate.category,
        country: rate.country,
        isActive: true,
      },
    })
    if (!existing) {
      await prisma.whatsappQuotaCreditRate.create({
        data: {
          category: rate.category,
          country: rate.country,
          quotaCredit: rate.quotaCredit,
          description: rate.description,
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          isActive: true,
        },
      })
      console.log(`Created Quota Rate: ${rate.category} -> ${rate.quotaCredit}`)
    }
  }

  for (const price of BASELINE_BASE_PRICES) {
    const existing = await prisma.whatsappBasePrice.findFirst({
      where: {
        category: price.category,
        country: price.country,
        isActive: true,
      },
    })
    if (!existing) {
      await prisma.whatsappBasePrice.create({
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
      console.log(
        `Created Base Price: ${price.category} -> Rp ${price.basePrice}`
      )
    }
  }

  console.log("WhatsApp pricing seed completed successfully.")
}

seed()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
