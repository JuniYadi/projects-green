import { describe, it, expect } from "bun:test"
import { sanitizeHtml } from "./sanitize-html"

describe("sanitizeHtml", () => {
  it("returns empty string for null, undefined, or empty string", () => {
    expect(sanitizeHtml(null)).toBe("")
    expect(sanitizeHtml(undefined)).toBe("")
    expect(sanitizeHtml("")).toBe("")
  })

  it("preserves safe markdown HTML tags", () => {
    const input =
      '<p>Hello <strong>world</strong> with <code>code</code> and <a href="https://example.com">link</a></p>'
    const sanitized = sanitizeHtml(input)
    expect(sanitized).toBe(input)
  })

  it("strips malicious script tags", () => {
    const input = "<p>Text</p><script>alert('xss')</script>"
    const sanitized = sanitizeHtml(input)
    expect(sanitized).not.toContain("<script>")
    expect(sanitized).not.toContain("alert('xss')")
    expect(sanitized).toContain("<p>Text</p>")
  })

  it("strips inline event handlers", () => {
    const input =
      '<img src="x" onerror="alert(1)" /><a href="#" onclick="steal()">Click</a>'
    const sanitized = sanitizeHtml(input)
    expect(sanitized).not.toContain("onerror")
    expect(sanitized).not.toContain("onclick")
    expect(sanitized).not.toContain("alert")
  })

  it("strips javascript: protocol in href", () => {
    const input = "<a href=\"javascript:alert('xss')\">Dangerous</a>"
    const sanitized = sanitizeHtml(input)
    expect(sanitized).not.toContain("javascript:")
  })
})
