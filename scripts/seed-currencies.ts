/**
 * Seed currencies for the billing/payments system.
 *
 * Sets up supported currencies and exchange rates against the base currency
 * (USD). The base currency row has isBase=true and ratePerBase=1.
 *
 * Usage: bun run scripts/seed-currencies.ts
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const DATABASE_URL = process.env.DATABASE_URL?.trim()

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
})

// ─── Seed Data ────────────────────────────────────────────────────────────────
//
// ratePerBase = units of this currency per 1 USD (the base).
// Top-up bounds are expressed in the currency's own unit.

interface CurrencySeed {
  code: string
  name: string
  symbol: string
  isBase: boolean
  ratePerBase: number
  minTopup: number
  maxTopup: number
  minBalanceWarn: number
  isActive: boolean
  sortOrder: number
}

const currencies: CurrencySeed[] = [
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    isBase: true,
    ratePerBase: 1,
    minTopup: 10,
    maxTopup: 10_000,
    minBalanceWarn: 10,
    isActive: true,
    sortOrder: 0,
  },
  {
    code: "IDR",
    name: "Indonesian Rupiah",
    symbol: "Rp",
    isBase: false,
    ratePerBase: 18_000,
    minTopup: 50_000,
    maxTopup: 200_000_000,
    minBalanceWarn: 10_000,
    isActive: true,
    sortOrder: 10,
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    isBase: false,
    ratePerBase: 1.35,
    minTopup: 15,
    maxTopup: 15_000,
    minBalanceWarn: 15,
    isActive: false,
    sortOrder: 20,
  },
  {
    code: "MYR",
    name: "Malaysian Ringgit",
    symbol: "RM",
    isBase: false,
    ratePerBase: 4.65,
    minTopup: 45,
    maxTopup: 45_000,
    minBalanceWarn: 45,
    isActive: false,
    sortOrder: 30,
  },
  {
    code: "THB",
    name: "Thai Baht",
    symbol: "฿",
    isBase: false,
    ratePerBase: 36.5,
    minTopup: 350,
    maxTopup: 350_000,
    minBalanceWarn: 350,
    isActive: false,
    sortOrder: 40,
  },
  {
    code: "VND",
    name: "Vietnamese Dong",
    symbol: "₫",
    isBase: false,
    ratePerBase: 25_500,
    minTopup: 250_000,
    maxTopup: 250_000_000,
    minBalanceWarn: 15_000,
    isActive: false,
    sortOrder: 50,
  },
  {
    code: "PHP",
    name: "Philippine Peso",
    symbol: "₱",
    isBase: false,
    ratePerBase: 58,
    minTopup: 550,
    maxTopup: 550_000,
    minBalanceWarn: 550,
    isActive: false,
    sortOrder: 60,
  },
]

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seedCurrencies() {
  console.log("\n💱 Seeding currencies...")

  let created = 0
  let updated = 0
  let skipped = 0

  for (const currency of currencies) {
    const existing = await prisma.paymentCurrency.findUnique({
      where: { code: currency.code },
    })

    if (existing) {
      // Only update if rates or bounds changed.
      const rateChanged = !existing.ratePerBase.eq(currency.ratePerBase)
      const minChanged = !existing.minTopup.eq(currency.minTopup)
      const maxChanged = !existing.maxTopup.eq(currency.maxTopup)
      const warnChanged = !existing.minBalanceWarn.eq(currency.minBalanceWarn)
      const nameChanged = existing.name !== currency.name
      const symbolChanged = existing.symbol !== currency.symbol
      const activeChanged = existing.isActive !== currency.isActive
      const baseChanged = existing.isBase !== currency.isBase
      const orderChanged = existing.sortOrder !== currency.sortOrder

      if (
        rateChanged ||
        minChanged ||
        maxChanged ||
        warnChanged ||
        nameChanged ||
        symbolChanged ||
        activeChanged ||
        baseChanged ||
        orderChanged
      ) {
        await prisma.paymentCurrency.update({
          where: { code: currency.code },
          data: {
            name: currency.name,
            symbol: currency.symbol,
            isBase: currency.isBase,
            ratePerBase: currency.ratePerBase,
            minTopup: currency.minTopup,
            maxTopup: currency.maxTopup,
            minBalanceWarn: currency.minBalanceWarn,
            isActive: currency.isActive,
            sortOrder: currency.sortOrder,
          },
        })
        updated++
      } else {
        skipped++
      }
    } else {
      await prisma.paymentCurrency.create({ data: currency })
      created++
    }
  }

  console.log(`  ✅ Currencies: ${created} created, ${updated} updated, ${skipped} unchanged`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting currency seed...")

  try {
    await seedCurrencies()
    console.log("\n✅ Currency seed completed successfully!")
  } catch (error) {
    console.error("\n❌ Currency seed failed:", error)
    throw error
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Seed error:", error)
    prisma.$disconnect()
    process.exit(1)
  })
