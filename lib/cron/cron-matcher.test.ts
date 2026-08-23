import { describe, expect, test } from "bun:test"
import { cronMatches } from "./cron-matcher"

describe("cronMatches", () => {
  test("matches wildcard every minute", () => {
    const d = new Date("2026-08-23T07:15:00Z")
    expect(cronMatches("* * * * *", d)).toBe(true)
  })

  test("matches step minute pattern", () => {
    const d15 = new Date("2026-08-23T07:15:00Z")
    const d16 = new Date("2026-08-23T07:16:00Z")
    expect(cronMatches("*/5 * * * *", d15)).toBe(true)
    expect(cronMatches("*/5 * * * *", d16)).toBe(false)
  })

  test("matches hourly pattern at minute 0", () => {
    const d00 = new Date("2026-08-23T07:00:00Z")
    const d01 = new Date("2026-08-23T07:01:00Z")
    expect(cronMatches("0 * * * *", d00)).toBe(true)
    expect(cronMatches("0 * * * *", d01)).toBe(false)
  })

  test("matches daily pattern at specific hour and minute", () => {
    const d0200 = new Date("2026-08-23T02:00:00Z")
    const d0300 = new Date("2026-08-23T03:00:00Z")
    expect(cronMatches("0 2 * * *", d0200)).toBe(true)
    expect(cronMatches("0 2 * * *", d0300)).toBe(false)
  })

  test("matches monthly pattern on 1st day", () => {
    const d1st = new Date("2026-09-01T03:00:00Z")
    const d2nd = new Date("2026-09-02T03:00:00Z")
    expect(cronMatches("0 3 1 * *", d1st)).toBe(true)
    expect(cronMatches("0 3 1 * *", d2nd)).toBe(false)
  })

  test("matches lists and ranges", () => {
    const d1 = new Date("2026-08-23T01:00:00Z")
    const d3 = new Date("2026-08-23T03:00:00Z")
    const d5 = new Date("2026-08-23T05:00:00Z")
    expect(cronMatches("0 1,3,5 * * *", d1)).toBe(true)
    expect(cronMatches("0 1,3,5 * * *", d3)).toBe(true)
    expect(cronMatches("0 1,3,5 * * *", d5)).toBe(true)
    expect(cronMatches("0 1-4 * * *", d3)).toBe(true)
    expect(cronMatches("0 1-4 * * *", d5)).toBe(false)
  })

  test("throws error on invalid expression format", () => {
    expect(() => cronMatches("* * *")).toThrow()
  })
})
