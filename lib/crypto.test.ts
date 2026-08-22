import { describe, expect, it, beforeEach } from "bun:test"
import {
  encryptTenantStoragePath,
  decryptTenantStoragePath,
  verifyTenantStoragePath,
  getStorageTenantSubkey,
} from "./crypto"

describe("lib/crypto - Tenant Storage Path Encryption Guard", () => {
  beforeEach(() => {
    process.env.APP_KEY = "test_master_secret_32_bytes_long_123456"
  })

  it("should derive deterministic subkey from APP_KEY", () => {
    const subkey1 = getStorageTenantSubkey()
    const subkey2 = getStorageTenantSubkey()
    expect(subkey1.length).toBe(32)
    expect(subkey1.toString("hex")).toBe(subkey2.toString("hex"))
  })

  it("should encrypt organizationId deterministically to flat hex and decrypt successfully", () => {
    const orgId = "org_1234567890abcdef"
    const encrypted1 = encryptTenantStoragePath(orgId)
    const encrypted2 = encryptTenantStoragePath(orgId)

    // Deterministic guarantee: same orgId produces same encrypted path
    expect(encrypted1).toBe(encrypted2)

    // Flat hex check: valid hex format
    expect(/^[0-9a-fA-F]+$/.test(encrypted1)).toBe(true)
    expect(encrypted1.length).toBeGreaterThanOrEqual(58)

    const decrypted = decryptTenantStoragePath(encrypted1)
    expect(decrypted).toBe(orgId)
  })

  it("should verify matching and mismatching organizationId correctly", () => {
    const orgId = "org_alpha"
    const encrypted = encryptTenantStoragePath(orgId)

    expect(verifyTenantStoragePath(encrypted, "org_alpha")).toBe(true)
    expect(verifyTenantStoragePath(encrypted, "org_beta")).toBe(false)
  })

  it("should throw on tampered ciphertext or auth tag", () => {
    const orgId = "org_secure"
    const enc = encryptTenantStoragePath(orgId)

    // Tamper one char in tag or ciphertext
    const lastChar = enc.slice(-1)
    const tamperedChar = lastChar === "a" ? "b" : "a"
    const tampered = enc.slice(0, -1) + tamperedChar

    expect(() => decryptTenantStoragePath(tampered)).toThrow()
    expect(verifyTenantStoragePath(tampered, orgId)).toBe(false)
  })

  it("should throw on malformed or too short hex string", () => {
    expect(() => decryptTenantStoragePath("not_a_hex")).toThrow()
    expect(() => decryptTenantStoragePath("abcdef123456")).toThrow()
  })
})
