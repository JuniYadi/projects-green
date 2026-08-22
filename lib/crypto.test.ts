import { describe, expect, it, beforeEach } from "bun:test"
import {
  encryptTenantStoragePath,
  decryptTenantStoragePath,
  verifyTenantStoragePath,
  getStorageTenantSubkey,
} from "./crypto"

describe("lib/crypto - Tenant Storage Path Encryption Guard", () => {
  const originalAppKey = process.env.APP_KEY

  beforeEach(() => {
    process.env.APP_KEY = "test_master_secret_32_bytes_long_123456"
  })

  it("should derive deterministic subkey from APP_KEY", () => {
    const subkey1 = getStorageTenantSubkey()
    const subkey2 = getStorageTenantSubkey()
    expect(subkey1.length).toBe(32)
    expect(subkey1.toString("hex")).toBe(subkey2.toString("hex"))
  })

  it("should encrypt organizationId to flat hex and decrypt successfully", () => {
    const orgId = "org_1234567890abcdef"
    const encrypted = encryptTenantStoragePath(orgId)

    // Flat hex check: no dashes, no dots, valid hex
    expect(/^[0-9a-fA-F]+$/.test(encrypted)).toBe(true)
    expect(encrypted.length).toBeGreaterThanOrEqual(58)

    const decrypted = decryptTenantStoragePath(encrypted)
    expect(decrypted).toBe(orgId)
  })

  it("should verify matching and mismatching organizationId correctly", () => {
    const orgId = "org_alpha"
    const encrypted = encryptTenantStoragePath(orgId)

    expect(verifyTenantStoragePath(encrypted, "org_alpha")).toBe(true)
    expect(verifyTenantStoragePath(encrypted, "org_beta")).toBe(false)
  })

  it("should produce different ciphertexts for the same org due to random IV", () => {
    const orgId = "org_constant"
    const enc1 = encryptTenantStoragePath(orgId)
    const enc2 = encryptTenantStoragePath(orgId)

    expect(enc1).not.toBe(enc2)
    expect(decryptTenantStoragePath(enc1)).toBe(orgId)
    expect(decryptTenantStoragePath(enc2)).toBe(orgId)
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
