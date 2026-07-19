import { describe, it, expect } from "bun:test"
import { e164PhoneRegex, normalizeIndonesianPhoneNumber } from "./phone-number"

describe("e164PhoneRegex", () => {
  it("accepts valid E.164", () => {
    expect(e164PhoneRegex.test("+6285708296482")).toBe(true)
    expect(e164PhoneRegex.test("+14155550100")).toBe(true)
    expect(e164PhoneRegex.test("+1")).toBe(false) // too short (only country code)
  })

  it("rejects non-E.164", () => {
    expect(e164PhoneRegex.test("085708296482")).toBe(false)
    expect(e164PhoneRegex.test("6285708296482")).toBe(false)
    expect(e164PhoneRegex.test("abc")).toBe(false)
    expect(e164PhoneRegex.test("")).toBe(false)
  })
})

describe("normalizeIndonesianPhoneNumber", () => {
  it('converts "08" prefix to +62', () => {
    expect(normalizeIndonesianPhoneNumber("085708296482")).toBe(
      "+6285708296482"
    )
  })

  it('converts "62" prefix to +62', () => {
    expect(normalizeIndonesianPhoneNumber("6285708296482")).toBe(
      "+6285708296482"
    )
  })

  it("preserves already-normalized E.164", () => {
    expect(normalizeIndonesianPhoneNumber("+6285708296482")).toBe(
      "+6285708296482"
    )
  })
  it("strips formatting characters from +1 numbers", () => {
    expect(normalizeIndonesianPhoneNumber("+1 415-555-0100")).toBe(
      "+14155550100"
    )
  })

  it("strips whitespace", () => {
    expect(normalizeIndonesianPhoneNumber("  085708296482  ")).toBe(
      "+6285708296482"
    )
  })

  it("returns null for non-numeric input", () => {
    expect(normalizeIndonesianPhoneNumber("abc")).toBe(null)
  })

  it("returns null for empty input", () => {
    expect(normalizeIndonesianPhoneNumber("")).toBe(null)
    expect(normalizeIndonesianPhoneNumber("   ")).toBe(null)
  })

  it("rejects too-long E.164 (over 15 digits)", () => {
    expect(normalizeIndonesianPhoneNumber("+1234567890123456")).toBe(null)
  })
})
