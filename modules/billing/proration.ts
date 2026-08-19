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

export const CUTOFF_DAY_OF_MONTH = 23

const PERIOD_MONTHS: Record<RecurringBillingPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

/**
 * Returns UTC calendar boundaries for the recurring billing period containing `now` under Model B:
 * - Day 1: Full standard cycle starting 1st of month.
 * - Day 2..23 (Standard Pro-rata):
 *   - Prorate remaining days in the current calendar month.
 *   - Plus (periodMonths - 1) full subsequent calendar months.
 *   - Cycle ends on the last day of the final included month.
 * - Day > 23 (Cut-off rollover):
 *   - Prorate remaining days in the current calendar month.
 *   - Plus periodMonths full subsequent calendar months.
 *   - Cycle ends on the last day of the final included month.
 */
export function getCalendarCycleBoundaries(
  billingPeriod: RecurringBillingPeriod,
  now: Date = new Date()
): CalendarCycleBoundaries {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed: 0 = Jan, 11 = Dec
  const date = now.getUTCDate()
  const periodMonths = PERIOD_MONTHS[billingPeriod]

  // Start of current month
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))

  // Days in current calendar month
  const daysInCurrentMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  if (date === 1) {
    // Exactly on the 1st: standard full cycle starting today
    const end = new Date(
      Date.UTC(year, month + periodMonths, 0, 23, 59, 59, 999)
    )
    const startUtcMidnight = Date.UTC(year, month, 1, 0, 0, 0, 0)
    const endUtcMidnight = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      0,
      0,
      0,
      0
    )
    const totalDays =
      Math.round((endUtcMidnight - startUtcMidnight) / DAY_MS) + 1
    return { start, end, totalDays, remainingDays: totalDays }
  }

  // Remaining days in current month: [date..daysInCurrentMonth] inclusive
  const remainingDaysInMonth = daysInCurrentMonth - date + 1

  // Additional full months:
  // If date > 23: rollover includes full periodMonths (e.g. 1 month for monthly, 3 months for quarterly)
  // If date <= 23: includes (periodMonths - 1) full months (e.g. 0 months for monthly, 2 months for quarterly)
  const additionalFullMonths =
    date > CUTOFF_DAY_OF_MONTH ? periodMonths : periodMonths - 1

  // End of cycle: last day of month + 1 + additionalFullMonths
  const end = new Date(
    Date.UTC(year, month + 1 + additionalFullMonths, 0, 23, 59, 59, 999)
  )

  return {
    start,
    end,
    totalDays: daysInCurrentMonth,
    remainingDays: remainingDaysInMonth,
  }
}

/**
 * Calculate pro-rata amount for any recurring billing period and strategy.
 * For PRO_RATA strategy under Model B:
 * - Monthly rate = periodPrice / periodMonths
 * - Day-rate in current month = Monthly rate / totalDaysInCurrentMonth
 * - Prorated amount = (remainingDaysInMonth * Day-rate) + (additionalFullMonths * Monthly rate)
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
  const periodMonths = PERIOD_MONTHS[billingPeriod]

  const boundaries = getCalendarCycleBoundaries(billingPeriod, now)
  const { start, end, totalDays, remainingDays } = boundaries
  const date = now.getUTCDate()

  if (billingStrategy !== "PRO_RATA" || date === 1) {
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

  const additionalFullMonths =
    date > CUTOFF_DAY_OF_MONTH ? periodMonths : periodMonths - 1

  const monthlyRate = priceDec.div(periodMonths)
  const currentMonthProrated = monthlyRate.mul(remainingDays).div(totalDays)
  const additionalMonthsAmount = monthlyRate.mul(additionalFullMonths)
  const proratedUnitPrice = currentMonthProrated.add(additionalMonthsAmount)
  const proratedAmount = proratedUnitPrice.mul(qtyDec)

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
