import { Prisma } from "@prisma/client"
import type { RecurringBillingPeriod } from "./pricing/pricing.types"

export type { RecurringBillingPeriod }

export interface CalendarCycleBoundaries {
  start: Date
  end: Date
  totalDays: number
  remainingDays: number
}

export interface ProrationResult {
  isProrated: boolean
  cycleStart: Date
  cycleEnd: Date
  totalDaysInPeriod: number
  remainingDays: number
  baseAmount: Prisma.Decimal
  proratedAmount: Prisma.Decimal
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Returns UTC calendar boundaries for the recurring billing period containing `now`.
 * - MONTHLY: 1st of month to last day of month
 * - QUARTERLY: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
 * - SEMI_ANNUAL: H1 (Jan-Jun), H2 (Jul-Dec)
 * - ANNUAL: Jan 1 to Dec 31
 */
export function getCalendarCycleBoundaries(
  billingPeriod: RecurringBillingPeriod,
  now: Date = new Date()
): CalendarCycleBoundaries {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed: 0 = Jan, 11 = Dec

  let startMonth = 0
  let endMonth = 11

  switch (billingPeriod) {
    case "MONTHLY":
      startMonth = month
      endMonth = month
      break
    case "QUARTERLY":
      startMonth = Math.floor(month / 3) * 3
      endMonth = startMonth + 2
      break
    case "SEMI_ANNUAL":
      startMonth = month < 6 ? 0 : 6
      endMonth = startMonth + 5
      break
    case "ANNUAL":
      startMonth = 0
      endMonth = 11
      break
  }

  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999))

  // Difference in whole UTC calendar days
  const startUtcMidnight = Date.UTC(year, startMonth, 1, 0, 0, 0, 0)
  const endUtcMidnight = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
    0,
    0,
    0,
    0
  )
  const totalDays = Math.round((endUtcMidnight - startUtcMidnight) / DAY_MS) + 1
  const todayUtcMidnight = Date.UTC(year, month, now.getUTCDate(), 0, 0, 0, 0)
  const remainingDays = Math.max(
    1,
    Math.round((endUtcMidnight - todayUtcMidnight) / DAY_MS) + 1
  )

  return { start, end, totalDays, remainingDays }
}

/**
 * Calculate pro-rata amount for any recurring billing period and strategy.
 */
export function calculateProration({
  billingStrategy,
  billingPeriod,
  periodPrice,
  quantity = 1,
  now = new Date(),
}: {
  billingStrategy: "PRO_RATA" | "FIXED_CYCLE"
  billingPeriod: RecurringBillingPeriod
  periodPrice: Prisma.Decimal | number | string
  quantity?: Prisma.Decimal | number | string
  now?: Date
}): ProrationResult {
  const priceDec = new Prisma.Decimal(periodPrice)
  const qtyDec = new Prisma.Decimal(quantity)
  const baseAmount = priceDec.mul(qtyDec)

  const boundaries = getCalendarCycleBoundaries(billingPeriod, now)
  const { start, end, totalDays, remainingDays } = boundaries

  if (billingStrategy !== "PRO_RATA" || remainingDays >= totalDays) {
    return {
      isProrated: false,
      cycleStart: now,
      cycleEnd: end,
      totalDaysInPeriod: totalDays,
      remainingDays: totalDays,
      baseAmount,
      proratedAmount: baseAmount,
    }
  }

  const proratedAmount = priceDec.mul(remainingDays).div(totalDays).mul(qtyDec)

  return {
    isProrated: true,
    cycleStart: start,
    cycleEnd: end,
    totalDaysInPeriod: totalDays,
    remainingDays,
    baseAmount,
    proratedAmount,
  }
}
