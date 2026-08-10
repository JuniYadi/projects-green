import { describe, expect, it } from "bun:test"

import {
  getMissingAddonPriceCells,
  isValidAddonPriceAmount,
} from "./addon-pricing-validation"

describe("getMissingAddonPriceCells", () => {
  it("requires every enabled billing term and currency to have a positive amount", () => {
    expect(
      getMissingAddonPriceCells(
        [
          { billingPeriod: "MONTHLY", currency: "IDR", amount: "50000" },
          { billingPeriod: "MONTHLY", currency: "USD", amount: "" },
        ],
        ["MONTHLY", "ANNUAL"],
        ["IDR", "USD"]
      )
    ).toEqual([
      { billingPeriod: "MONTHLY", currency: "USD" },
      { billingPeriod: "ANNUAL", currency: "IDR" },
      { billingPeriod: "ANNUAL", currency: "USD" },
    ])
  })
  it("only validates currencies configured by the addon", () => {
    expect(
      getMissingAddonPriceCells(
        [{ billingPeriod: "MONTHLY", currency: "IDR", amount: "50000" }],
        ["MONTHLY"]
      )
    ).toEqual([])

    expect(
      getMissingAddonPriceCells(
        [{ billingPeriod: "MONTHLY", currency: "IDR", amount: "0" }],
        ["MONTHLY"]
      )
    ).toEqual([{ billingPeriod: "MONTHLY", currency: "IDR" }])
  })

  it("uses the same strictly positive amount rule for row and matrix validation", () => {
    expect(isValidAddonPriceAmount("")).toBe(false)
    expect(isValidAddonPriceAmount("0")).toBe(false)
    expect(isValidAddonPriceAmount("10")).toBe(true)
    expect(
      getMissingAddonPriceCells(
        [{ billingPeriod: "MONTHLY", currency: "IDR", amount: "0" }],
        ["MONTHLY"],
        ["IDR"]
      )
    ).toEqual([{ billingPeriod: "MONTHLY", currency: "IDR" }])
  })
})
