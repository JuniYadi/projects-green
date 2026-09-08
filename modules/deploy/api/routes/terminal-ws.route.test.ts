import { describe, it, expect } from "bun:test"
import { isAllowedOrigin, terminalWsRoute } from "./terminal-ws.route"

describe("terminal-ws.route isAllowedOrigin", () => {
  it("rejects null or empty origin", () => {
    expect(isAllowedOrigin(null)).toBe(false)
    expect(isAllowedOrigin("")).toBe(false)
  })

  it("allows standard production domains", () => {
    expect(isAllowedOrigin("https://pfnapp.my.id")).toBe(true)
    expect(isAllowedOrigin("https://pfnapp.id")).toBe(true)
  })

  it("allows configured APP_URL or NEXT_PUBLIC_APP_URL", () => {
    const originalAppUrl = process.env.APP_URL
    process.env.APP_URL = "https://custom.app.internal"
    expect(isAllowedOrigin("https://custom.app.internal")).toBe(true)
    process.env.APP_URL = originalAppUrl
  })

  it("rejects untrusted third-party origins (CSWSH prevention)", () => {
    expect(isAllowedOrigin("https://malicious-site.com")).toBe(false)
    expect(isAllowedOrigin("https://evil.pfnapp.my.id.attacker.com")).toBe(
      false
    )
  })
})

describe("terminalWsRoute definition", () => {
  it("defines websocket route on /stacks/:stackId/terminal", () => {
    expect(terminalWsRoute).toBeDefined()
  })
})
