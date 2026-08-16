import { describe, it, expect } from "bun:test"
import {
  RENEWAL_LADDER,
  calendarDaysUntil,
  ladderActionFor,
  ladderScheduleFor,
} from "./renewal-ladder"

const due = new Date("2026-09-01T00:00:00.000Z")

function at(iso: string): Date {
  return new Date(iso)
}

describe("RENEWAL_LADDER", () => {
  it("matches the PRD contract of 7/3/1 before and 1/7 after due", () => {
    expect(RENEWAL_LADDER.invoiceDaysBeforeDue).toBe(7)
    expect(RENEWAL_LADDER.reminderDaysBeforeDue).toEqual([3, 1])
    expect(RENEWAL_LADDER.suspendDaysAfterDue).toBe(1)
    expect(RENEWAL_LADDER.terminateDaysAfterDue).toBe(7)
  })
})

describe("calendarDaysUntil", () => {
  it("counts whole calendar days ignoring time of day", () => {
    expect(calendarDaysUntil(due, at("2026-08-29T23:59:59.000Z"))).toBe(3)
    expect(calendarDaysUntil(due, at("2026-08-29T00:00:00.000Z"))).toBe(3)
  })

  it("returns zero on the due date and negatives after it", () => {
    expect(calendarDaysUntil(due, at("2026-09-01T12:00:00.000Z"))).toBe(0)
    expect(calendarDaysUntil(due, at("2026-09-02T00:00:00.000Z"))).toBe(-1)
    expect(calendarDaysUntil(due, at("2026-09-08T00:00:00.000Z"))).toBe(-7)
  })
})

describe("ladderActionFor", () => {
  it("takes no action before or on the due date", () => {
    expect(ladderActionFor(due, at("2026-08-25T00:00:00.000Z"))).toBe("NONE")
    expect(ladderActionFor(due, at("2026-09-01T23:59:59.000Z"))).toBe("NONE")
  })

  it("suspends from one day after due until the terminate day", () => {
    expect(ladderActionFor(due, at("2026-09-02T00:00:00.000Z"))).toBe("SUSPEND")
    expect(ladderActionFor(due, at("2026-09-07T23:59:59.000Z"))).toBe("SUSPEND")
  })

  it("terminates from seven days after due onward", () => {
    expect(ladderActionFor(due, at("2026-09-08T00:00:00.000Z"))).toBe(
      "TERMINATE"
    )
    expect(ladderActionFor(due, at("2026-10-01T00:00:00.000Z"))).toBe(
      "TERMINATE"
    )
  })
})

describe("ladderScheduleFor", () => {
  it("projects every ladder date from the due date", () => {
    const schedule = ladderScheduleFor(due)

    expect(schedule.invoiceAt).toEqual(at("2026-08-25T00:00:00.000Z"))
    expect(schedule.remindAt).toEqual([
      at("2026-08-29T00:00:00.000Z"),
      at("2026-08-31T00:00:00.000Z"),
    ])
    expect(schedule.suspendAt).toEqual(at("2026-09-02T00:00:00.000Z"))
    expect(schedule.terminateAt).toEqual(at("2026-09-08T00:00:00.000Z"))
  })
})
