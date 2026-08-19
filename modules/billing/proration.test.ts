import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"
import { calculateProration, getCalendarCycleBoundaries } from "./proration"

describe("getCalendarCycleBoundaries", () => {
  it("computes monthly boundaries correctly", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("MONTHLY", august19)

    expect(boundaries.start.toISOString()).toBe("2026-08-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-08-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(31)
    expect(boundaries.remainingDays).toBe(13) // Aug 19 to Aug 31 inclusive
  })

  it("computes quarterly boundaries correctly for Q3", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("QUARTERLY", august19)

    expect(boundaries.start.toISOString()).toBe("2026-07-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-09-30T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(92) // Jul(31) + Aug(31) + Sep(30) = 92
    expect(boundaries.remainingDays).toBe(43) // Aug 19 to Sep 30 = 13 (Aug) + 30 (Sep) = 43
  })

  it("computes quarterly boundaries correctly for Q1", () => {
    const jan1 = new Date("2026-01-01T00:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("QUARTERLY", jan1)

    expect(boundaries.start.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-03-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(90) // 31 + 28 + 31 = 90
    expect(boundaries.remainingDays).toBe(90)
  })

  it("computes semi-annual boundaries correctly for H2", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("SEMI_ANNUAL", august19)

    expect(boundaries.start.toISOString()).toBe("2026-07-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-12-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(184)
  })

  it("computes annual boundaries correctly", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("ANNUAL", august19)

    expect(boundaries.start.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-12-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(365)
  })
  it("computes remainingDays on the last day of cycle (Dec 31) as 1 day remaining", () => {
    const dec31 = new Date("2026-12-31T12:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("ANNUAL", dec31)

    expect(boundaries.totalDays).toBe(365)
    expect(boundaries.remainingDays).toBe(1)
  })
})

describe("calculateProration", () => {
  it("does not prorate for FIXED_CYCLE strategy", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "FIXED_CYCLE",
      billingPeriod: "QUARTERLY",
      periodPrice: new Prisma.Decimal("1800000"),
      quantity: 1,
      now: august19,
    })

    expect(result.isProrated).toBe(false)
    expect(result.proratedAmount.toString()).toBe("1800000")
    expect(result.baseAmount.toString()).toBe("1800000")
  })

  it("calculates quarterly pro-rata on Q3 start date correctly", () => {
    const july1 = new Date("2026-07-01T00:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "PRO_RATA",
      billingPeriod: "QUARTERLY",
      periodPrice: new Prisma.Decimal("1800000"),
      quantity: 1,
      now: july1,
    })

    expect(result.isProrated).toBe(false) // First day of cycle = not prorated
    expect(result.proratedAmount.toString()).toBe("1800000")
  })

  it("calculates quarterly pro-rata on mid-quarter date (Aug 19)", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "PRO_RATA",
      billingPeriod: "QUARTERLY",
      periodPrice: new Prisma.Decimal("1800000"),
      quantity: 1,
      now: august19,
    })

    expect(result.isProrated).toBe(true)
    expect(result.totalDaysInPeriod).toBe(92)
    expect(result.remainingDays).toBe(43)
    // 1,800,000 * 43 / 92 = 841304.347826...
    expect(result.proratedAmount.toNumber()).toBeCloseTo(841304.35, 1)
    expect(result.cycleEnd.toISOString()).toBe("2026-09-30T23:59:59.999Z")
  })

  it("calculates monthly pro-rata correctly", () => {
    const august6 = new Date("2026-08-06T00:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "PRO_RATA",
      billingPeriod: "MONTHLY",
      periodPrice: new Prisma.Decimal("100000"),
      quantity: 1,
      now: august6,
    })

    expect(result.isProrated).toBe(true)
    expect(result.totalDaysInPeriod).toBe(31)
    expect(result.remainingDays).toBe(26) // Aug 6 to Aug 31
    expect(result.proratedAmount.toNumber()).toBeCloseTo(83870.97, 1)
  })

  it("calculates pro-rata on the last day of cycle (1 day charged)", () => {
    const aug31 = new Date("2026-08-31T10:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "PRO_RATA",
      billingPeriod: "MONTHLY",
      periodPrice: new Prisma.Decimal("310000"),
      quantity: 1,
      now: aug31,
    })

    expect(result.isProrated).toBe(true)
    expect(result.totalDaysInPeriod).toBe(31)
    expect(result.remainingDays).toBe(1)
    // 310,000 * 1 / 31 = 10,000
    expect(result.proratedAmount.toString()).toBe("10000")
  })
})
