import { describe, it, expect } from "bun:test"
import { isAllowedOrigin } from "./terminal-ws.route"

describe("terminal-ws.route isAllowedOrigin", () => {
  it("rejects null or empty origin", () => {
    expect(isAllowedOrigin(null)).toBe(false)
    expect(isAllowedOrigin("")).toBe(false)
  })

  it("allows standard production domains", () => {
    expect(isAllowedOrigin("https://pfnapp.my.id")).toBe(true)
    expect(isAllowedOrigin("https://pfnapp.id")).toBe(true)
  })

  it("rejects untrusted third-party origins (CSWSH prevention)", () => {
    expect(isAllowedOrigin("https://malicious-site.com")).toBe(false)
    expect(isAllowedOrigin("https://evil.pfnapp.my.id.attacker.com")).toBe(
      false
    )
  })
})
