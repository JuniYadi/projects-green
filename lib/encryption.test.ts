import { describe, expect, it } from "bun:test"
import crypto from "node:crypto"

import {
  decrypt,
  deriveEncryptionKey,
  encrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "./encryption"

describe("encryption", () => {
  it("encrypts with 12-byte IV and decrypts cleanly", () => {
    const key = crypto.randomBytes(32)
    const plaintext = "my-secret-credential-payload"

    const encrypted = encrypt(plaintext, key)
    expect(Buffer.from(encrypted.iv, "base64").length).toBe(12)
    expect(Buffer.from(encrypted.tag, "base64").length).toBe(16)

    const decrypted = decrypt(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it("decrypts legacy payloads with 16-byte IV", () => {
    const key = crypto.randomBytes(32)
    const plaintext = "legacy-payload"
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    let enc = cipher.update(plaintext, "utf8", "base64")
    enc += cipher.final("base64")
    const tag = cipher.getAuthTag()

    const decrypted = decrypt(
      {
        encrypted: enc,
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
      },
      key
    )
    expect(decrypted).toBe(plaintext)
  })

  it("serializes and parses encrypted fields", () => {
    const data = {
      encrypted: "abc",
      iv: "def",
      tag: "ghi",
    }
    const serialized = serializeEncryptedField(data)
    expect(parseEncryptedField(serialized)).toEqual(data)
    expect(parseEncryptedField("invalid json")).toBeNull()
    expect(parseEncryptedField(null)).toBeNull()
  })

  it("derives deterministic encryption keys using HKDF", () => {
    const params = {
      secret: "super-secret",
      salt: "tenant-org-123",
      info: "app-credentials",
    }
    const key1 = deriveEncryptionKey(params)
    const key2 = deriveEncryptionKey(params)
    expect(key1).toEqual(key2)
    expect(key1.length).toBe(32)
  })
})
