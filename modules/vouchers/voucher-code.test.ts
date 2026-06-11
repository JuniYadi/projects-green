import { describe, expect, it } from "bun:test"

import { generateVoucherCode } from "./voucher-code"

describe("generateVoucherCode", () => {
  it("generates 8 uppercase alphanumeric characters when no prefix", () => {
    const code = generateVoucherCode()
    expect(code).toMatch(/^[A-Z0-9]{8}$/)
  })

  it("generates prefixed code with 6 random chars by default", () => {
    const code = generateVoucherCode("PFN")
    expect(code).toMatch(/^PFN-[A-Z0-9]{6}$/)
  })

  it("normalizes prefix to uppercase", () => {
    const code = generateVoucherCode("pfn")
    expect(code).toMatch(/^PFN-[A-Z0-9]{6}$/)
  })

  it("accepts custom randomLength", () => {
    const code = generateVoucherCode(undefined, 12)
    expect(code).toMatch(/^[A-Z0-9]{12}$/)
  })

  it("accepts custom randomLength with prefix", () => {
    const code = generateVoucherCode("WELCOME", 8)
    expect(code).toMatch(/^WELCOME-[A-Z0-9]{8}$/)
  })

  it("generates different codes on successive calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateVoucherCode()))
    expect(codes.size).toBe(50)
  })

  it("throws when prefix contains non-alpha characters", () => {
    expect(() => generateVoucherCode("ABC123")).toThrow("Prefix must contain only uppercase letters A-Z")
  })

  it("strips whitespace from prefix", () => {
    const code = generateVoucherCode("  pfn  ")
    expect(code).toMatch(/^PFN-[A-Z0-9]{6}$/)
  })

  it("generates codes using only A-Z and 0-9 characters", () => {
    const codes = Array.from({ length: 100 }, () => generateVoucherCode())
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]+(-[A-Z0-9]+)?$/)
    }
  })
})
