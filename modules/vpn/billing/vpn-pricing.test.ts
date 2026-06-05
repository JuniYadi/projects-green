import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"

import { resolveVpnMonthlyPrice, VpnPriceNotConfiguredError } from "./vpn-pricing"

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

describe("resolveVpnMonthlyPrice", () => {
  it("returns STANDARD price for INDONESIA in IDR by default", () => {
    const result = resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
    })
    expect(result.currency).toBe("IDR")
    expect(result.amount.toString()).toBe("25000")
  })

  it("returns PROFESSIONAL price for INDONESIA in IDR by default", () => {
    const result = resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "PROFESSIONAL",
    })
    expect(result.currency).toBe("IDR")
    expect(result.amount.toString()).toBe("50000")
  })

  it("scales IDR amount to USD using fixed FX rate for MVP (1 USD = 16000 IDR)", () => {
    const result = resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
      currency: "USD",
    })
    expect(result.currency).toBe("USD")
    // 25000 IDR / 16000 = 1.5625 USD — kept to 4dp to match Decimal(10,4) precision
    expect(result.amount.toString()).toBe("1.5625")
  })

  it("throws VpnPriceNotConfiguredError for unknown region", () => {
    expect(() =>
      resolveVpnMonthlyPrice({
        regionCode: "MARS",
        planCode: "STANDARD",
      }),
    ).toThrow(VpnPriceNotConfiguredError)
  })

  it("throws VpnPriceNotConfiguredError for unknown plan", () => {
    expect(() =>
      resolveVpnMonthlyPrice({
        regionCode: "INDONESIA",
        planCode: "GIGA_PREMIUM",
      }),
    ).toThrow(VpnPriceNotConfiguredError)
  })

  it("returns Decimal-typed amount (not number) so it composes with Prisma Decimal math", () => {
    const result = resolveVpnMonthlyPrice({
      regionCode: "INDONESIA",
      planCode: "STANDARD",
    })
    expect(result.amount).toBeInstanceOf(Prisma.Decimal)
  })
})

// Silence unused-import lint if a future test references decimal() locally
void decimal
