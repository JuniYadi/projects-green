const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The commercial renewal ladder from
 * [[PRD - Global Subscription and Voucher System]] requirement 5.
 * This is the single authoritative timing source: the per-product ladders
 * (invoice-status day counts, VPN days-after-failure) defer to it.
 */
export const RENEWAL_LADDER: {
  invoiceDaysBeforeDue: number
  reminderDaysBeforeDue: readonly number[]
  suspendDaysAfterDue: number
  terminateDaysAfterDue: number
} = {
  invoiceDaysBeforeDue: 7,
  reminderDaysBeforeDue: [3, 1],
  suspendDaysAfterDue: 1,
  terminateDaysAfterDue: 7,
}

export type LadderAction = "NONE" | "SUSPEND" | "TERMINATE"

function toUtcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * Whole calendar days from `now` until `dueAt`. Positive before the due
 * date, zero on it, negative after. Compares UTC dates, not instants, so a
 * worker running at 23:59 and one running at 00:01 agree on the day count.
 */
export function calendarDaysUntil(dueAt: Date, now: Date): number {
  return Math.round((toUtcMidnight(dueAt) - toUtcMidnight(now)) / DAY_MS)
}

export function ladderActionFor(dueAt: Date, now: Date): LadderAction {
  const daysPastDue = -calendarDaysUntil(dueAt, now)
  if (daysPastDue >= RENEWAL_LADDER.terminateDaysAfterDue) return "TERMINATE"
  if (daysPastDue >= RENEWAL_LADDER.suspendDaysAfterDue) return "SUSPEND"
  return "NONE"
}

function shiftDays(from: Date, days: number): Date {
  return new Date(toUtcMidnight(from) + days * DAY_MS)
}

export function ladderScheduleFor(dueAt: Date): {
  invoiceAt: Date
  remindAt: Date[]
  suspendAt: Date
  terminateAt: Date
} {
  return {
    invoiceAt: shiftDays(dueAt, -RENEWAL_LADDER.invoiceDaysBeforeDue),
    remindAt: RENEWAL_LADDER.reminderDaysBeforeDue
      .map((days) => shiftDays(dueAt, -days))
      .sort((a, b) => a.getTime() - b.getTime()),
    suspendAt: shiftDays(dueAt, RENEWAL_LADDER.suspendDaysAfterDue),
    terminateAt: shiftDays(dueAt, RENEWAL_LADDER.terminateDaysAfterDue),
  }
}
