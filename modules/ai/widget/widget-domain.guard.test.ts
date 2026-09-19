import { describe, expect, it } from "bun:test"
import { isAllowedOrigin } from "./widget-domain.guard"

describe("widget-domain.guard - isAllowedOrigin", () => {
  it("should allow any origin when allowedDomains is empty", () => {
    expect(isAllowedOrigin("https://example.com", [])).toBe(true)
    expect(isAllowedOrigin(undefined, [])).toBe(true)
    expect(isAllowedOrigin(null, [])).toBe(true)
  })

  it("should allow any origin when wildcard '*' is in allowedDomains", () => {
    expect(isAllowedOrigin("https://malicious.com", ["*"])).toBe(true)
    expect(isAllowedOrigin("https://random.org", ["example.com", "*"])).toBe(
      true
    )
  })

  it("should reject when allowedDomains is set but origin is missing", () => {
    expect(isAllowedOrigin(undefined, ["example.com"])).toBe(false)
    expect(isAllowedOrigin(null, ["example.com"])).toBe(false)
    expect(isAllowedOrigin("", ["example.com"])).toBe(false)
  })

  it("should match exact domains ignoring protocol", () => {
    expect(isAllowedOrigin("https://klinik.com", ["klinik.com"])).toBe(true)
    expect(isAllowedOrigin("http://klinik.com", ["klinik.com"])).toBe(true)
    expect(isAllowedOrigin("https://other.com", ["klinik.com"])).toBe(false)
  })

  it("should match domains when pattern has protocol", () => {
    expect(
      isAllowedOrigin("https://klinik.com", ["https://klinik.com"])
    ).toBe(true)
    expect(
      isAllowedOrigin("http://klinik.com", ["https://klinik.com"])
    ).toBe(true)
  })

  it("should match wildcard subdomains", () => {
    const allowed = ["*.toko.co.id"]
    expect(isAllowedOrigin("https://sub.toko.co.id", allowed)).toBe(true)
    expect(isAllowedOrigin("https://deep.sub.toko.co.id", allowed)).toBe(true)
    expect(isAllowedOrigin("https://toko.co.id", allowed)).toBe(true)
    expect(isAllowedOrigin("https://nottoko.co.id", allowed)).toBe(false)
    expect(isAllowedOrigin("https://fake-toko.co.id", allowed)).toBe(false)
  })

  it("should handle localhost and wildcard ports", () => {
    expect(
      isAllowedOrigin("http://localhost:3000", ["localhost:*"])
    ).toBe(true)
    expect(
      isAllowedOrigin("http://localhost:8080", ["localhost:*"])
    ).toBe(true)
    expect(
      isAllowedOrigin("http://127.0.0.1:4000", ["127.0.0.1:*"])
    ).toBe(true)
  })

  it("should match exact port when specified in pattern", () => {
    expect(
      isAllowedOrigin("http://localhost:3000", ["localhost:3000"])
    ).toBe(true)
    expect(
      isAllowedOrigin("http://localhost:4000", ["localhost:3000"])
    ).toBe(false)
  })

  it("should handle referer header with path and query parameters", () => {
    expect(
      isAllowedOrigin("https://klinik.com/products?ref=ad", ["klinik.com"])
    ).toBe(true)
  })
})
