/**
 * Currency Seeder (System)
 *
 * Sets up supported currencies and exchange rates against the base currency
 * (USD). Migrated from scripts/seed-currencies.ts.
 *
 * ratePerBase = units of this currency per 1 USD (the base).
 * Top-up bounds are expressed in the currency's own unit.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"

interface CurrencySeed {
  code: string
  name: string
  symbol: string
  isBase: boolean
  ratePerBase: number
  minTopup: number
  maxTopup: number
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
    isActive: false,
    sortOrder: 60,
  },
]

export class CurrencySeeder extends BaseSeeder {
  static override readonly seederName = "Currencies"
  static override readonly classification = "system" as const
  static override readonly runOrder = 10
  static override readonly description =
    "Supported currencies and exchange rates"

  async seed(): Promise<void> {
    this.log("Seeding currencies...")

    for (const currency of currencies) {
      const existing = await this.prisma.paymentCurrency.findUnique({
        where: { code: currency.code },
      })

      if (existing) {
        const rateChanged = !existing.ratePerBase.eq(currency.ratePerBase)
        const minChanged = !existing.minTopup.eq(currency.minTopup)
        const maxChanged = !existing.maxTopup.eq(currency.maxTopup)
        const nameChanged = existing.name !== currency.name
        const symbolChanged = existing.symbol !== currency.symbol
        const activeChanged = existing.isActive !== currency.isActive
        const baseChanged = existing.isBase !== currency.isBase
        const orderChanged = existing.sortOrder !== currency.sortOrder

        if (
          rateChanged ||
          minChanged ||
          maxChanged ||
          nameChanged ||
          symbolChanged ||
          activeChanged ||
          baseChanged ||
          orderChanged
        ) {
          await this.prisma.paymentCurrency.update({
            where: { code: currency.code },
            data: {
              name: currency.name,
              symbol: currency.symbol,
              isBase: currency.isBase,
              ratePerBase: currency.ratePerBase,
              minTopup: currency.minTopup,
              maxTopup: currency.maxTopup,
              isActive: currency.isActive,
              sortOrder: currency.sortOrder,
            },
          })
          this.trackUpdated()
        } else {
          this.trackSkipped()
        }
      } else {
        await this.prisma.paymentCurrency.create({ data: currency })
        this.trackCreated()
      }
    }

    this.log(
      `Done: ${this.result.created} created, ${this.result.updated} updated, ${this.result.skipped} unchanged`
    )
  }
}

registerSeeder(CurrencySeeder)
