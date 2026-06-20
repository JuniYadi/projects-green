import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import { CurrencyService } from "@/modules/billing/currency.service"

import {
  resolveVpnMonthlyPrice,
  VpnPriceNotConfiguredError,
} from "./vpn-pricing"

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

describe("resolveVpnMonthlyPrice", () => {
  it("returns STANDARD price for INDONESIA in IDR by default", async () => {
    const result = await resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
    })
    expect(result.currency).toBe("IDR")
    expect(result.amount.toString()).toBe("25000")
  })

  it("returns PROFESSIONAL price for INDONESIA in IDR by default", async () => {
    const result = await resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "PROFESSIONAL",
    })
    expect(result.currency).toBe("IDR")
    expect(result.amount.toString()).toBe("50000")
  })

  it("scales IDR amount to USD using fixed FX rate for MVP (1 USD = 16000 IDR)", async () => {
    const result = await resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
      currency: "USD",
    })
    expect(result.currency).toBe("USD")
    // 25000 IDR / 16000 = 1.5625 USD — kept to 4dp to match Decimal(10,4) precision
    expect(result.amount.toString()).toBe("1.5625")
  })

  it("throws VpnPriceNotConfiguredError for unknown region", async () => {
    await expect(
      resolveVpnMonthlyPrice({
        regionCode: "MARS",
        planCode: "STANDARD",
      })
    ).rejects.toThrow(VpnPriceNotConfiguredError)
  })

  it("throws VpnPriceNotConfiguredError for unknown plan", async () => {
    await expect(
      resolveVpnMonthlyPrice({
        regionCode: "INDONESIA",
        planCode: "GIGA_PREMIUM",
      })
    ).rejects.toThrow(VpnPriceNotConfiguredError)
  })

  it("returns Decimal-typed amount (not number) so it composes with Prisma Decimal math", async () => {
    const result = await resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
    })
    expect(result.amount).toBeInstanceOf(Prisma.Decimal)
  })
})

describe("resolveVpnMonthlyPrice with CurrencyService", () => {
  it("uses dynamic rate from CurrencyService when provided", async () => {
    // Mock CurrencyService.getRate: returns dynamic rate for IDR
    const mockCurrency = {
      convert: mock(
        async () => new Prisma.Decimal("1.25")
      ),
      getRate: mock(async (code: string) =>
        new Prisma.Decimal(code === "USD" ? "1" : "20000")
      ),
    }

    const result = await resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
      currency: "USD",
      currencyService: mockCurrency as unknown as CurrencyService,
    })
    expect(result.currency).toBe("USD")
    expect(result.amount.toString()).toBe("1.25")
  })
})

// Silence unused-import lint if a future test references decimal() locally
void decimal
