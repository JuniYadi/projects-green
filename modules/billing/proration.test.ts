import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"
import { calculateProration, getCalendarCycleBoundaries } from "./proration"

describe("getCalendarCycleBoundaries", () => {
  it("computes monthly boundaries on Day 1 (full month, not prorated)", () => {
    const august1 = new Date("2026-08-01T00:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("MONTHLY", august1)

    expect(boundaries.start.toISOString()).toBe("2026-08-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-08-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(31)
    expect(boundaries.remainingDays).toBe(31)
  })

  it("computes monthly boundaries when date <= 23 (prorated current month only)", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("MONTHLY", august19)

    expect(boundaries.start.toISOString()).toBe("2026-08-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-08-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(31)
    expect(boundaries.remainingDays).toBe(13) // Aug 19 to Aug 31 inclusive = 13 days
  })

  it("computes monthly boundaries when date > 23 (cut-off rollover: remaining days + 1 full month)", () => {
    const august24 = new Date("2026-08-24T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("MONTHLY", august24)

    expect(boundaries.start.toISOString()).toBe("2026-08-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-09-30T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(31)
    expect(boundaries.remainingDays).toBe(8) // Aug 24 to Aug 31 inclusive = 8 days
  })

  it("computes quarterly boundaries when date <= 23 (remaining days + 2 full months)", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("QUARTERLY", august19)

    expect(boundaries.start.toISOString()).toBe("2026-08-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-10-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(31)
    expect(boundaries.remainingDays).toBe(13)
  })

  it("computes quarterly boundaries when date > 23 (cut-off rollover: remaining days + 3 full months)", () => {
    const august24 = new Date("2026-08-24T10:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("QUARTERLY", august24)

    expect(boundaries.start.toISOString()).toBe("2026-08-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-11-30T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(31)
    expect(boundaries.remainingDays).toBe(8)
  })

  it("computes annual boundaries on Day 1", () => {
    const jan1 = new Date("2026-01-01T00:00:00.000Z")
    const boundaries = getCalendarCycleBoundaries("ANNUAL", jan1)

    expect(boundaries.start.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(boundaries.end.toISOString()).toBe("2026-12-31T23:59:59.999Z")
    expect(boundaries.totalDays).toBe(365)
    expect(boundaries.remainingDays).toBe(365)
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

  it("does not prorate on the 1st of the month for PRO_RATA strategy", () => {
    const august1 = new Date("2026-08-01T00:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "PRO_RATA",
      billingPeriod: "QUARTERLY",
      periodPrice: new Prisma.Decimal("1800000"),
      quantity: 1,
      now: august1,
    })

    expect(result.isProrated).toBe(false)
    expect(result.proratedAmount.toString()).toBe("1800000")
    expect(result.cycleEnd.toISOString()).toBe("2026-10-31T23:59:59.999Z")
  })

  it("calculates quarterly pro-rata on Aug 19 (13/31 month + 2 full months)", () => {
    const august19 = new Date("2026-08-19T10:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "PRO_RATA",
      billingPeriod: "QUARTERLY",
      periodPrice: new Prisma.Decimal("1800000"),
      quantity: 1,
      now: august19,
    })

    expect(result.isProrated).toBe(true)
    expect(result.totalDaysInPeriod).toBe(31)
    expect(result.remainingDays).toBe(13)
    // Monthly rate = 1,800,000 / 3 = 600,000
    // Prorated Aug = 600,000 * 13 / 31 = 251612.9032...
    // Full Sep + Oct (2 months) = 600,000 * 2 = 1,200,000
    // Total = 1,451,612.90
    expect(result.proratedAmount.toNumber()).toBeCloseTo(1451612.9, 1)
    expect(result.cycleEnd.toISOString()).toBe("2026-10-31T23:59:59.999Z")
  })

  it("calculates monthly pro-rata on Aug 6 (26/31 month, date <= 23)", () => {
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
    // 100,000 * 26 / 31 = 83,870.97
    expect(result.proratedAmount.toNumber()).toBeCloseTo(83870.97, 1)
    expect(result.cycleEnd.toISOString()).toBe("2026-08-31T23:59:59.999Z")
  })

  it("calculates cut-off rollover on Aug 24 (8/31 month + 1 full month for monthly)", () => {
    const aug24 = new Date("2026-08-24T10:00:00.000Z")
    const result = calculateProration({
      billingStrategy: "PRO_RATA",
      billingPeriod: "MONTHLY",
      periodPrice: new Prisma.Decimal("310000"),
      quantity: 1,
      now: aug24,
    })

    expect(result.isProrated).toBe(true)
    expect(result.totalDaysInPeriod).toBe(31)
    expect(result.remainingDays).toBe(8)
    // Aug remaining: 310,000 * 8 / 31 = 80,000
    // Sep full month: 310,000
    // Total: 390,000
    expect(result.proratedAmount.toString()).toBe("390000")
    expect(result.cycleEnd.toISOString()).toBe("2026-09-30T23:59:59.999Z")
  })
})
