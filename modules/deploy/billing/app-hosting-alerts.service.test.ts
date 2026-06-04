import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  calculateHoursRemaining,
  isLowBalance,
  getLowBalanceMessage,
} from "./app-hosting-alerts.service"

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

describe("calculateHoursRemaining", () => {
  it("calculates hours remaining from balance and hourly cost", () => {
    expect(calculateHoursRemaining(decimal("100"), decimal("5"))).toBe(20)
    expect(calculateHoursRemaining(decimal("240"), decimal("10"))).toBe(24)
    expect(calculateHoursRemaining(decimal("50"), decimal("5"))).toBe(10)
  })

  it("floors to integer", () => {
    expect(calculateHoursRemaining(decimal("100"), decimal("7"))).toBe(14)
    expect(calculateHoursRemaining(decimal("100"), decimal("3"))).toBe(33)
  })

  it("returns Infinity when hourly cost is zero", () => {
    expect(calculateHoursRemaining(decimal("100"), decimal("0"))).toBe(Infinity)
  })

  it("returns 0 when balance is zero", () => {
    expect(calculateHoursRemaining(decimal("0"), decimal("5"))).toBe(0)
  })
})

describe("isLowBalance", () => {
  it("returns true when hours remaining <= 24", () => {
    expect(isLowBalance(decimal("100"), decimal("5"))).toBe(true) // 20 hours
    expect(isLowBalance(decimal("120"), decimal("5"))).toBe(true) // 24 hours
    expect(isLowBalance(decimal("0"), decimal("5"))).toBe(true) // 0 hours
  })

  it("returns false when hours remaining > 24", () => {
    expect(isLowBalance(decimal("125"), decimal("5"))).toBe(false) // 25 hours
    expect(isLowBalance(decimal("500"), decimal("5"))).toBe(false) // 100 hours
  })
})

describe("getLowBalanceMessage", () => {
  it("returns null when balance is sufficient", () => {
    expect(getLowBalanceMessage(decimal("500"), decimal("5"))).toBeNull()
  })

  it("returns warning message when hours remaining <= 24", () => {
    const msg = getLowBalanceMessage(decimal("100"), decimal("5"))
    expect(msg).toContain("20 hours")
    expect(msg).toContain("Top up")
  })

  it("returns critical message when balance is depleted", () => {
    const msg = getLowBalanceMessage(decimal("0"), decimal("5"))
    expect(msg).toContain("depleted")
    expect(msg).toContain("immediately")
  })

  it("returns message at exactly 24 hours", () => {
    const msg = getLowBalanceMessage(decimal("120"), decimal("5"))
    expect(msg).toContain("24 hours")
  })
})
