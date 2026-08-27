import { describe, expect, it } from "bun:test"

import { validateDomainAddition } from "./domain-gate"

const plan = {
  resources: {
    networking: {
      maxCustomDomains: 2,
      allowWildcardDomain: true,
      allowCustomTls: true,
    },
  },
}

describe("validateDomainAddition", () => {
  it("allows a regular domain while quota remains", () => {
    expect(
      validateDomainAddition({
        plan,
        existingCustomDomains: 1,
        hostname: "app.example.com",
      })
    ).toEqual({
      allowed: true,
      reason: null,
      usage: { used: 1, limit: 2 },
    })
  })

  it("rejects a domain when the custom domain quota is full", () => {
    const result = validateDomainAddition({
      plan,
      existingCustomDomains: 2,
      hostname: "other.example.com",
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe("QUOTA_EXCEEDED")
    expect(result.usage).toEqual({ used: 2, limit: 2 })
  })

  it("rejects wildcard domains when the plan does not allow them", () => {
    const result = validateDomainAddition({
      plan: {
        resources: {
          networking: {
            maxCustomDomains: 4,
            allowWildcardDomain: false,
            allowCustomTls: true,
          },
        },
      },
      existingCustomDomains: 0,
      hostname: "*.example.com",
      wildcard: true,
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe("WILDCARD_NOT_ALLOWED")
  })

  it("rejects custom TLS when the plan does not allow it", () => {
    const result = validateDomainAddition({
      plan: {
        resources: {
          networking: {
            maxCustomDomains: 4,
            allowWildcardDomain: true,
            allowCustomTls: false,
          },
        },
      },
      existingCustomDomains: 0,
      hostname: "secure.example.com",
      customTls: true,
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe("CUSTOM_TLS_NOT_ALLOWED")
  })
})
