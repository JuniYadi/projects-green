import { describe, it, expect } from "bun:test"
import {
  e164PhoneRegex,
  normalizeIndonesianPhoneNumber,
  detectCountryFromPhone,
} from "./phone-number"

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

describe("detectCountryFromPhone", () => {
  it("detects Indonesian numbers across formats", () => {
    expect(detectCountryFromPhone("+6281234567890")).toEqual({
      prefix: "+62",
      country: "Indonesia",
      iso: "ID",
      nationalNumber: "81234567890",
    })
    expect(detectCountryFromPhone("081234567890")).toEqual({
      prefix: "+62",
      country: "Indonesia",
      iso: "ID",
      nationalNumber: "81234567890",
    })
  })

  it("detects NANP sub-regions and separates Bahamas from US/Canada", () => {
    expect(detectCountryFromPhone("+1 242 393 0000")).toEqual({
      prefix: "+1242",
      country: "Bahamas",
      iso: "BS",
      nationalNumber: "3930000",
    })
    expect(detectCountryFromPhone("+1 415 555 0100")).toEqual({
      prefix: "+1",
      country: "United States / Canada",
      iso: "US",
      nationalNumber: "4155550100",
    })
  })

  it("detects other international country codes", () => {
    expect(detectCountryFromPhone("0044 20 7946 0958")).toEqual({
      prefix: "+44",
      country: "United Kingdom",
      iso: "GB",
      nationalNumber: "2079460958",
    })
    expect(detectCountryFromPhone("+81 90 1234 5678")).toEqual({
      prefix: "+81",
      country: "Japan",
      iso: "JP",
      nationalNumber: "9012345678",
    })
    expect(detectCountryFromPhone("+971 50 123 4567")).toEqual({
      prefix: "+971",
      country: "United Arab Emirates",
      iso: "AE",
      nationalNumber: "501234567",
    })
  })

  it("returns null for unknown prefix", () => {
    expect(detectCountryFromPhone("+999123456")).toBeNull()
  })
})
