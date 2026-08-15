import { beforeEach, describe, expect, it } from "bun:test"

import {
  fingerprintWhatsappOrganizationApiKey,
  generateWhatsappOrganizationApiKey,
  isWellFormedWhatsappOrganizationApiKey,
} from "./organization-api-key.crypto"

describe("WhatsApp organization API-key crypto helpers", () => {
  beforeEach(() => {
    process.env.API_KEY_HASH_SALT = "test-api-key-hash-salt"
  })

  it("generates a well-formed key with a one-way stored hash", async () => {
    const generated = await generateWhatsappOrganizationApiKey()

    expect(isWellFormedWhatsappOrganizationApiKey(generated.raw)).toBe(true)
    expect(generated.hash).not.toContain(generated.raw)
  })

  it("derives the public fingerprint from the stored key hash", () => {
    const fingerprint = fingerprintWhatsappOrganizationApiKey("stored-key-hash")

    expect(fingerprint).toHaveLength(64)
    expect(fingerprint).not.toBe("stored-key-hash")
  })

  it("rejects malformed key shapes", () => {
    expect(isWellFormedWhatsappOrganizationApiKey("wa_live_short")).toBe(false)
    expect(
      isWellFormedWhatsappOrganizationApiKey("live_" + "a".repeat(43))
    ).toBe(false)
  })
})
