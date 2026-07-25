import { describe, expect, it } from "bun:test"
import { formatBillingMoney } from "./format-money"

describe("formatBillingMoney", () => {
  it("formats USD with en-US grouping", () => {
    expect(formatBillingMoney(1234.5, "USD")).toBe("USD 1,234.50")
  })

  it("formats IDR with id-ID grouping", () => {
    expect(formatBillingMoney(125000, "IDR")).toBe("IDR 125.000,00")
  })

  it("accepts string amounts", () => {
    expect(formatBillingMoney("75000.00", "USD")).toBe("USD 75,000.00")
  })
})
