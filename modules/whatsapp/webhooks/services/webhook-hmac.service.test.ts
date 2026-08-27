import { describe, expect, it } from "bun:test"
import { createHmac } from "node:crypto"

import { verifyWebhookSignature } from "./webhook-hmac.service"

describe("verifyWebhookSignature", () => {
  const secret = "test-secret-key-12345"
  const rawBody = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "123", changes: [] }],
  })

  function generateSignature(body: string, appSecret: string): string {
    const hash = createHmac("sha256", appSecret)
      .update(body, "utf8")
      .digest("hex")
    return `sha256=${hash}`
  }

  it("returns true for a valid HMAC-SHA256 signature", () => {
    const signature = generateSignature(rawBody, secret)
    const isValid = verifyWebhookSignature(secret, rawBody, signature)
    expect(isValid).toBe(true)
  })

  it("returns true for empty body with valid signature", () => {
    const emptyBody = ""
    const signature = generateSignature(emptyBody, secret)
    const isValid = verifyWebhookSignature(secret, emptyBody, signature)
    expect(isValid).toBe(true)
  })

  it("returns true for unicode / UTF-8 characters in body", () => {
    const unicodeBody = JSON.stringify({ message: "Halo Dunia 🌍✨ WhatsApp" })
    const signature = generateSignature(unicodeBody, secret)
    const isValid = verifyWebhookSignature(secret, unicodeBody, signature)
    expect(isValid).toBe(true)
  })

  it("returns false if signatureHeader is null or undefined", () => {
    expect(verifyWebhookSignature(secret, rawBody, null)).toBe(false)
    expect(verifyWebhookSignature(secret, rawBody, undefined)).toBe(false)
  })

  it("returns false if signatureHeader is empty string", () => {
    expect(verifyWebhookSignature(secret, rawBody, "")).toBe(false)
  })

  it("returns false if appSecret is empty string", () => {
    const signature = generateSignature(rawBody, secret)
    expect(verifyWebhookSignature("", rawBody, signature)).toBe(false)
  })

  it("returns false if signatureHeader does not start with sha256=", () => {
    const hash = createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex")
    expect(verifyWebhookSignature(secret, rawBody, hash)).toBe(false)
    expect(verifyWebhookSignature(secret, rawBody, `sha1=${hash}`)).toBe(false)
  })

  it("returns false if received hash length is not 64 characters", () => {
    expect(verifyWebhookSignature(secret, rawBody, "sha256=abcdef")).toBe(false)
    expect(
      verifyWebhookSignature(secret, rawBody, `sha256=${"a".repeat(63)}`)
    ).toBe(false)
    expect(
      verifyWebhookSignature(secret, rawBody, `sha256=${"a".repeat(65)}`)
    ).toBe(false)
  })

  it("returns false if signature hash does not match payload", () => {
    const invalidSignature = generateSignature("tampered-body", secret)
    expect(verifyWebhookSignature(secret, rawBody, invalidSignature)).toBe(
      false
    )
  })

  it("returns false if signed with a different secret", () => {
    const wrongSecretSignature = generateSignature(rawBody, "wrong-secret")
    expect(verifyWebhookSignature(secret, rawBody, wrongSecretSignature)).toBe(
      false
    )
  })
})
