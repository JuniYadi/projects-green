import { describe, expect, it, beforeEach, afterEach } from "bun:test"

import { EncryptionService, getEncryptionService, resetEncryptionService } from "./encryption.service"

describe("EncryptionService", () => {
  // Generate a valid 32-byte hex key for testing
  const testKey = Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex")

  describe("constructor", () => {
    it("accepts valid 32-byte hex key", () => {
      expect(() => new EncryptionService(testKey.toString("hex"))).not.toThrow()
    })

    it("rejects key shorter than 32 bytes", () => {
      const shortKey = "0123456789abcdef"
      const service = new EncryptionService(shortKey)
      expect(() => service.encryptField("test")).toThrow(
        "Encryption key must be 32 bytes (64 hex characters)"
      )
    })

    it("rejects key longer than 32 bytes", () => {
      const longKey = "0123456789abcdef".repeat(5)
      const service = new EncryptionService(longKey)
      expect(() => service.encryptField("test")).toThrow(
        "Encryption key must be 32 bytes (64 hex characters)"
      )
    })
  })

  describe("encryptField and decryptField", () => {
    let service: EncryptionService

    beforeEach(() => {
      service = new EncryptionService(testKey.toString("hex"))
    })

    it("encrypts and decrypts a simple string", () => {
      const plaintext = "Hello, World!"
      const encrypted = service.encryptField(plaintext)

      expect(encrypted).not.toBe(plaintext)
      expect(service.decryptField(encrypted)).toBe(plaintext)
    })

    it("encrypts and decrypts sensitive payment data", () => {
      const sensitiveData = "4111111111111111|12/25|123"
      const encrypted = service.encryptField(sensitiveData)

      expect(encrypted).not.toBe(sensitiveData)
      expect(service.decryptField(encrypted)).toBe(sensitiveData)
    })

    it("produces different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "Same text"
      const encrypted1 = service.encryptField(plaintext)
      const encrypted2 = service.encryptField(plaintext)

      expect(encrypted1).not.toBe(encrypted2)
      // But both should decrypt to same value
      expect(service.decryptField(encrypted1)).toBe(plaintext)
      expect(service.decryptField(encrypted2)).toBe(plaintext)
    })

    it("encrypts and decrypts unicode characters", () => {
      const unicode = "Test with émojis 🎉 and 日本語"
      const encrypted = service.encryptField(unicode)

      expect(service.decryptField(encrypted)).toBe(unicode)
    })

    it("encrypts and decrypts empty string", () => {
      const encrypted = service.encryptField("")
      expect(service.decryptField(encrypted)).toBe("")
    })

    it("encrypts and decrypts long text", () => {
      const longText = "A".repeat(10000)
      const encrypted = service.encryptField(longText)

      expect(service.decryptField(encrypted)).toBe(longText)
    })
  })

  describe("decryptField error handling", () => {
    let service: EncryptionService

    beforeEach(() => {
      service = new EncryptionService(testKey.toString("hex"))
    })

    it("throws error for invalid JSON format", () => {
      expect(() => service.decryptField("not-valid-json")).toThrow(
        "Invalid encrypted field format"
      )
    })

    it("throws error for incomplete encrypted data", () => {
      const incompleteData = JSON.stringify({ encrypted: "abc", iv: "def" })
      expect(() => service.decryptField(incompleteData)).toThrow()
    })

    it("throws error for tampered ciphertext", () => {
      const plaintext = "Sensitive data"
      const encrypted = service.encryptField(plaintext)
      const parsed = JSON.parse(encrypted)

      // Tamper with the ciphertext
      parsed.encrypted = Buffer.from("tampered").toString("base64")
      const tampered = JSON.stringify(parsed)

      expect(() => service.decryptField(tampered)).toThrow()
    })
  })

  describe("decryptFieldOptional", () => {
    let service: EncryptionService

    beforeEach(() => {
      service = new EncryptionService(testKey.toString("hex"))
    })

    it("returns null for null input", () => {
      expect(service.decryptFieldOptional(null)).toBeNull()
    })

    it("returns null for undefined-like input", () => {
      expect(service.decryptFieldOptional("")).toBeNull()
    })

    it("decrypts valid encrypted data", () => {
      const plaintext = "Test data"
      const encrypted = service.encryptField(plaintext)

      expect(service.decryptFieldOptional(encrypted)).toBe(plaintext)
    })

    it("returns null for invalid data (does not throw)", () => {
      expect(service.decryptFieldOptional("invalid-data")).toBeNull()
    })
  })

  describe("integration with different keys", () => {
    const key1 = Buffer.from("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", "hex")
    const key2 = Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex")

    it("cannot decrypt data encrypted with different key", () => {
      const service1 = new EncryptionService(key1.toString("hex"))
      const service2 = new EncryptionService(key2.toString("hex"))

      const plaintext = "Secret message"
      const encrypted = service1.encryptField(plaintext)

      expect(() => service2.decryptField(encrypted)).toThrow()
    })
  })
})

describe("getEncryptionService", () => {
  afterEach(() => {
    resetEncryptionService()
  })

  it("throws error when ENCRYPTION_KEY is not set", () => {
    // Reset any cached instance from other tests
    resetEncryptionService()

    // Save original env var
    const originalValue = process.env.ENCRYPTION_KEY

    // Clear the env var
    delete process.env.ENCRYPTION_KEY

    try {
      expect(() => getEncryptionService()).toThrow(
        "ENCRYPTION_KEY environment variable is not set"
      )
    } finally {
      // Restore original env var
      if (originalValue !== undefined) {
        process.env.ENCRYPTION_KEY = originalValue
      }
    }
  })

  it("returns same instance on multiple calls", () => {
    const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    process.env.ENCRYPTION_KEY = testKey

    const instance1 = getEncryptionService()
    const instance2 = getEncryptionService()

    expect(instance1).toBe(instance2)
  })
})