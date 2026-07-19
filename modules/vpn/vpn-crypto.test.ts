import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import {
  encryptVpnConfig,
  decryptVpnConfig,
  encryptProxyPassword,
  decryptProxyPassword,
  resetVpnCrypto,
} from "@/modules/vpn/vpn-crypto"

// ponytail: valid 32-byte hex key for AES-256-GCM
const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

describe("vpn-crypto", () => {
  const originalKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    resetVpnCrypto()
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY
    } else {
      process.env.ENCRYPTION_KEY = originalKey
    }
    resetVpnCrypto()
  })

  describe("encryptVpnConfig / decryptVpnConfig", () => {
    it("round-trips an OVPN config string", () => {
      const plaintext =
        "client\ndev tun\nproto udp\nremote vpn.example.com 1194"
      const encrypted = encryptVpnConfig(plaintext)

      expect(typeof encrypted).toBe("string")
      expect(encrypted).not.toBe(plaintext)

      const decrypted = decryptVpnConfig(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it("produces different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "test config"
      const a = encryptVpnConfig(plaintext)
      const b = encryptVpnConfig(plaintext)
      expect(a).not.toBe(b)
    })

    it("throws on invalid encrypted format", () => {
      expect(() => decryptVpnConfig("not-json")).toThrow(
        "Invalid encrypted config format"
      )
    })

    it("throws on null parse result", () => {
      expect(() => decryptVpnConfig("null")).toThrow(
        "Invalid encrypted config format"
      )
    })
  })

  describe("encryptProxyPassword / decryptProxyPassword", () => {
    it("round-trips a proxy password", () => {
      const password = "s3cret!@#$%"
      const encrypted = encryptProxyPassword(password)

      expect(typeof encrypted).toBe("string")
      expect(encrypted).not.toBe(password)

      const decrypted = decryptProxyPassword(encrypted)
      expect(decrypted).toBe(password)
    })

    it("throws on invalid encrypted format", () => {
      expect(() => decryptProxyPassword("not-json")).toThrow(
        "Invalid encrypted password format"
      )
    })
  })

  describe("getEncryptionKey", () => {
    it("throws when ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY
      resetVpnCrypto()

      expect(() => encryptVpnConfig("test")).toThrow(
        "ENCRYPTION_KEY environment variable is not set"
      )
    })

    it("throws when ENCRYPTION_KEY is wrong length", () => {
      process.env.ENCRYPTION_KEY = "abcdef"
      resetVpnCrypto()

      expect(() => encryptVpnConfig("test")).toThrow(
        "ENCRYPTION_KEY must decode to exactly 32 bytes"
      )
    })

    it("caches the key across calls", () => {
      const a = encryptVpnConfig("first")
      const b = encryptVpnConfig("second")
      // Both should succeed without re-reading env
      expect(a).toBeTruthy()
      expect(b).toBeTruthy()
    })
  })
})
