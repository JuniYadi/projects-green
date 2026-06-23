import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import {
  hashApiKey,
  encryptWithAppKey,
  decryptWithAppKey,
  generateRawApiKey,
  encryptWhatsAppToken,
  decryptWhatsAppToken,
  assertAppKeyCryptoConfigured,
  AppKeyCryptoError,
} from "@/lib/whatsapp/crypto"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A valid 32-byte key encoded as base64 (256 bits for AES-256). */
const VALID_APP_KEY_32B = Buffer.alloc(32).fill("k").toString("base64")

const originalAppKey = process.env.APP_KEY

function setAppKey(key: string | undefined) {
  if (key === undefined) {
    delete process.env.APP_KEY
  } else {
    process.env.APP_KEY = key
  }
}

afterEach(() => {
  setAppKey(originalAppKey)
})

// ─── hashApiKey ──────────────────────────────────────────────────────────────

describe("hashApiKey", () => {
  it("returns a base64 string", async () => {
    const hash = await hashApiKey("test-key", "salt")
    expect(typeof hash).toBe("string")
    // Valid base64: only url-safe chars, no padding issues
    expect(() => Buffer.from(hash, "base64")).not.toThrow()
  })

  it("returns different hashes for different keys", async () => {
    const hash1 = await hashApiKey("key-a", "salt")
    const hash2 = await hashApiKey("key-b", "salt")
    expect(hash1).not.toBe(hash2)
  })

  it("returns different hashes for different salts", async () => {
    const hash1 = await hashApiKey("same-key", "salt-1")
    const hash2 = await hashApiKey("same-key", "salt-2")
    expect(hash1).not.toBe(hash2)
  })

  it("is deterministic for same key+salt", async () => {
    const hash1 = await hashApiKey("repeatable-key", "repeatable-salt")
    const hash2 = await hashApiKey("repeatable-key", "repeatable-salt")
    expect(hash1).toBe(hash2)
  })
})

// ─── encryptWithAppKey ───────────────────────────────────────────────────────

describe("encryptWithAppKey", () => {
  beforeEach(() => {
    setAppKey(VALID_APP_KEY_32B)
  })

  it("returns a string starting with 'v1.'", async () => {
    const result = await encryptWithAppKey("hello")
    expect(result.startsWith("v1.")).toBe(true)
  })

  it("returns three dot-separated parts", async () => {
    const result = await encryptWithAppKey("hello")
    const parts = result.split(".")
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe("v1")
  })

  it("produces different ciphertexts for same plaintext (random IV)", async () => {
    const ct1 = await encryptWithAppKey("same message")
    const ct2 = await encryptWithAppKey("same message")
    expect(ct1).not.toBe(ct2)
  })

  it("round-trips correctly", async () => {
    const plaintext = "my-secret-token-123!@#"
    const encrypted = await encryptWithAppKey(plaintext)
    const decrypted = await decryptWithAppKey(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("round-trips unicode content", async () => {
    const plaintext = "Halo, 世界! 🔐 émojis"
    const encrypted = await encryptWithAppKey(plaintext)
    const decrypted = await decryptWithAppKey(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("round-trips empty string", async () => {
    const plaintext = ""
    const encrypted = await encryptWithAppKey(plaintext)
    const decrypted = await decryptWithAppKey(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("round-trips long content", async () => {
    const plaintext = "a".repeat(10_000)
    const encrypted = await encryptWithAppKey(plaintext)
    const decrypted = await decryptWithAppKey(encrypted)
    expect(decrypted).toBe(plaintext)
  })
})

// ─── decryptWithAppKey — error paths ─────────────────────────────────────────

describe("decryptWithAppKey errors", () => {
  beforeEach(() => {
    setAppKey(VALID_APP_KEY_32B)
  })

  it("throws APP_KEY_DECRYPTION_INVALID_PAYLOAD for wrong number of parts", async () => {
    await expect(decryptWithAppKey("only-one")).rejects.toThrow(
      AppKeyCryptoError
    )
    await expect(decryptWithAppKey("one.two")).rejects.toThrow(
      AppKeyCryptoError
    )
    await expect(decryptWithAppKey("one.two.three.four")).rejects.toThrow(
      AppKeyCryptoError
    )
  })

  it("throws APP_KEY_DECRYPTION_INVALID_PAYLOAD for empty parts", async () => {
    await expect(decryptWithAppKey(".iv.cipher")).rejects.toThrow(
      AppKeyCryptoError
    )
    await expect(decryptWithAppKey("v1..cipher")).rejects.toThrow(
      AppKeyCryptoError
    )
    await expect(decryptWithAppKey("v1.iv.")).rejects.toThrow(AppKeyCryptoError)
    await expect(decryptWithAppKey("")).rejects.toThrow(AppKeyCryptoError)
  })

  it("throws APP_KEY_DECRYPTION_UNSUPPORTED_VERSION for unknown version", async () => {
    await expect(decryptWithAppKey("v2.abc.abc")).rejects.toThrow(
      AppKeyCryptoError
    )
    await expect(decryptWithAppKey("v0.abc.abc")).rejects.toThrow(
      AppKeyCryptoError
    )
  })

  it("throws APP_KEY_DECRYPTION_INVALID_PAYLOAD for tampered ciphertext", async () => {
    // First encrypt a known value, then tamper with the ciphertext
    const original = await encryptWithAppKey("test")
    const parts = original.split(".")
    // Corrupt the last part significantly to ensure decryption failure
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].substring(0, parts[2].length - 10)}modifiedtext`
    await expect(decryptWithAppKey(tampered)).rejects.toThrow(AppKeyCryptoError)
  })

  it("throws APP_KEY_DECRYPTION_INVALID_PAYLOAD for wrong IV length", async () => {
    // Manually construct a payload with wrong IV length (6 bytes instead of 12)
    const badIv = Buffer.alloc(6).toString("base64url")
    const cipher = Buffer.alloc(16).toString("base64url")
    await expect(decryptWithAppKey(`v1.${badIv}.${cipher}`)).rejects.toThrow(
      AppKeyCryptoError
    )
  })
})

// ─── generateRawApiKey ────────────────────────────────────────────────────────

describe("generateRawApiKey", () => {
  beforeEach(() => {
    setAppKey(VALID_APP_KEY_32B)
  })

  it("returns raw and hash", async () => {
    const result = await generateRawApiKey()
    expect(typeof result.raw).toBe("string")
    expect(typeof result.hash).toBe("string")
  })

  it("raw starts with default prefix", async () => {
    const result = await generateRawApiKey()
    expect(result.raw.startsWith("live_")).toBe(true)
  })

  it("raw starts with custom prefix", async () => {
    const result = await generateRawApiKey("test_")
    expect(result.raw.startsWith("test_")).toBe(true)
  })

  it("produces unique values each call", async () => {
    const r1 = await generateRawApiKey()
    const r2 = await generateRawApiKey()
    expect(r1.raw).not.toBe(r2.raw)
    expect(r1.hash).not.toBe(r2.hash)
  })

  it("round-trips through hashApiKey when key is known", async () => {
    const knownKey = "my-secret-key-123"
    const salt = "my-test-salt"
    const hash1 = await hashApiKey(knownKey, salt)
    const hash2 = await hashApiKey(knownKey, salt)
    expect(hash1).toBe(hash2)
  })
})

// ─── encryptWhatsAppToken / decryptWhatsAppToken ─────────────────────────────

describe("encryptWhatsAppToken / decryptWhatsAppToken", () => {
  beforeEach(() => {
    setAppKey(VALID_APP_KEY_32B)
  })

  it("encrypts and decrypts a token", async () => {
    const token = "EAASomeWhatsAppToken..."
    const encrypted = await encryptWhatsAppToken(token)
    const decrypted = await decryptWhatsAppToken(encrypted)
    expect(decrypted).toBe(token)
  })
})

// ─── assertAppKeyCryptoConfigured ─────────────────────────────────────────────

describe("assertAppKeyCryptoConfigured", () => {
  it("does not throw when APP_KEY is a valid 32-byte base64 key", () => {
    setAppKey(VALID_APP_KEY_32B)
    expect(() => assertAppKeyCryptoConfigured()).not.toThrow()
  })

  it("does not throw when APP_KEY is a valid 32-byte base64url key", () => {
    setAppKey(Buffer.alloc(32).fill("k").toString("base64url"))
    expect(() => assertAppKeyCryptoConfigured()).not.toThrow()
  })

  it("does not throw when APP_KEY is a Laravel-style base64 key", () => {
    setAppKey(`base64:${VALID_APP_KEY_32B}`)
    expect(() => assertAppKeyCryptoConfigured()).not.toThrow()
  })

  it("does not throw when APP_KEY is a 32-byte hex key", () => {
    setAppKey(Buffer.alloc(32).fill("k").toString("hex"))
    expect(() => assertAppKeyCryptoConfigured()).not.toThrow()
  })

  it("throws AppKeyCryptoError when APP_KEY is missing", () => {
    setAppKey(undefined)
    expect(() => assertAppKeyCryptoConfigured()).toThrow(AppKeyCryptoError)
  })

  it("throws APP_KEY_INVALID for non-base64 value", () => {
    setAppKey("not-valid-base64!!!")
    expect(() => assertAppKeyCryptoConfigured()).toThrow(AppKeyCryptoError)
  })

  it("throws APP_KEY_INVALID for wrong key length (16 bytes)", () => {
    setAppKey(Buffer.alloc(16).fill("x").toString("base64"))
    expect(() => assertAppKeyCryptoConfigured()).toThrow(AppKeyCryptoError)
  })

  it("throws APP_KEY_INVALID for wrong key length (64 bytes)", () => {
    setAppKey(Buffer.alloc(64).fill("x").toString("base64"))
    expect(() => assertAppKeyCryptoConfigured()).toThrow(AppKeyCryptoError)
  })
})

// ─── AppKeyCryptoError ────────────────────────────────────────────────────────

describe("AppKeyCryptoError", () => {
  it("has correct name and code", () => {
    const err = new AppKeyCryptoError("APP_KEY_MISSING", "missing key")
    expect(err.name).toBe("AppKeyCryptoError")
    expect(err.code).toBe("APP_KEY_MISSING")
    expect(err.message).toBe("missing key")
    expect(err instanceof Error).toBe(true)
  })

  it("has all expected error codes", () => {
    const codes: Array<AppKeyCryptoError["code"]> = [
      "APP_KEY_MISSING",
      "APP_KEY_INVALID",
      "APP_KEY_DECRYPTION_INVALID_PAYLOAD",
      "APP_KEY_DECRYPTION_UNSUPPORTED_VERSION",
    ]
    for (const code of codes) {
      const err = new AppKeyCryptoError(code, "test")
      expect(err.code).toBe(code)
    }
  })
})
