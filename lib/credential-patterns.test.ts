import { describe, expect, it } from "bun:test"

import { CREDENTIAL_PATTERNS, looksLikeCredential } from "./credential-patterns"

describe("looksLikeCredential", () => {
  it("returns no match for benign input", () => {
    const result = looksLikeCredential("How do I reset my account password?")
    expect(result.match).toBe(false)
    expect(result.patterns).toEqual([])
  })

  it("flags an AWS access key id", () => {
    const result = looksLikeCredential("AKIAIOSFODNN7EXAMPLE")
    expect(result.match).toBe(true)
    expect(result.patterns).toContain("aws-access-key")
  })

  it("flags a JWT", () => {
    const result = looksLikeCredential(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
    expect(result.match).toBe(true)
    expect(result.patterns).toContain("jwt")
  })

  it("flags a private key block", () => {
    const result = looksLikeCredential(
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA..."
    )
    expect(result.match).toBe(true)
    expect(result.patterns).toContain("private-key-block")
  })

  it("returns match=false for empty string", () => {
    expect(looksLikeCredential("")).toEqual({ match: false, patterns: [] })
  })

  it("exposes a non-empty pattern list", () => {
    expect(CREDENTIAL_PATTERNS.length).toBeGreaterThan(0)
    for (const entry of CREDENTIAL_PATTERNS) {
      expect(entry.id).toBeTruthy()
      expect(entry.label).toBeTruthy()
      expect(entry.pattern).toBeInstanceOf(RegExp)
    }
  })
})
