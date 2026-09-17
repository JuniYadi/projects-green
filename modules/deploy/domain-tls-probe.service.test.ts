import { describe, expect, it } from "bun:test"
import { probeDomainCertificate } from "./domain-tls-probe.service"

describe("domain-tls-probe.service", () => {
  it("returns error for empty or whitespace hostname", async () => {
    const result = await probeDomainCertificate("   ")
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Empty hostname")
  })

  it("handles connection error gracefully", async () => {
    const result = await probeDomainCertificate(
      "non-existent-domain-probe-failure-xyz123.test",
      443,
      1000
    )
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it("handles timeout gracefully", async () => {
    const result = await probeDomainCertificate("192.0.2.1", 443, 200)
    expect(result.ok).toBe(false)
    expect(result.error).toContain("timed out")
  })
})
