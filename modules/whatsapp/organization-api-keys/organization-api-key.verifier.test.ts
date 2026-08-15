import { beforeEach, describe, expect, it, mock } from "bun:test"

import type { WhatsappOrganizationApiKeyDatabase } from "./organization-api-key.verifier"

const mockHashApiKey = mock(
  async (value: string, salt: string) => `hash:${value}:${salt}`
)
const mockGetApiKeyHashSalt = mock(() => "test-api-key-hash-salt")

mock.module("@/lib/whatsapp/crypto", () => ({
  getApiKeyHashSalt: mockGetApiKeyHashSalt,
  hashApiKey: mockHashApiKey,
  generateRawApiKey: mock(async () => ({ raw: "", hash: "" })),
}))
mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappOrganizationApiKey: {
      findFirst: mock(async () => null),
      updateMany: mock(async () => ({ count: 1 })),
    },
  },
}))

const { verifyWhatsappOrganizationApiKey } =
  await import("./organization-api-key.verifier")

const validKey = `wa_live_${"a".repeat(43)}`

const asDatabase = (value: unknown) =>
  value as WhatsappOrganizationApiKeyDatabase

describe("verifyWhatsappOrganizationApiKey", () => {
  beforeEach(() => {
    process.env.API_KEY_HASH_SALT = "test-api-key-hash-salt"
    mockGetApiKeyHashSalt.mockClear()
    mockGetApiKeyHashSalt.mockImplementation(() => "test-api-key-hash-salt")
    mockHashApiKey.mockClear()
  })

  it("rejects missing and malformed credentials before database lookup", async () => {
    const findFirst = mock(async () => null)
    const updateMany = mock(async () => ({ count: 1 }))
    const database = asDatabase({
      whatsappOrganizationApiKey: { findFirst, updateMany },
    })
    expect(
      await verifyWhatsappOrganizationApiKey(null, {}, database)
    ).toBeNull()
    expect(
      await verifyWhatsappOrganizationApiKey("wa_live_bad", {}, database)
    ).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("rejects unknown and revoked credentials without revealing a reason", async () => {
    const findFirst = mock(async () => null)
    const updateMany = mock(async () => ({ count: 1 }))
    expect(
      await verifyWhatsappOrganizationApiKey(
        validKey,
        {},
        asDatabase({ whatsappOrganizationApiKey: { findFirst, updateMany } })
      )
    ).toBeNull()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    )
    expect(updateMany).not.toHaveBeenCalled()
  })

  it("maps a valid key to its owning organization and records last use metadata", async () => {
    const findFirst = mock(async () => ({
      id: "key-1",
      organizationId: "org-1",
      fingerprint: "fingerprint-1",
    }))
    const updateMany = mock(async () => ({ count: 1 }))

    const result = await verifyWhatsappOrganizationApiKey(
      validKey,
      {
        clientIp: "203.0.113.10, 10.0.0.1",
        userAgent: "system-client",
      },
      asDatabase({ whatsappOrganizationApiKey: { findFirst, updateMany } })
    )

    expect(result).toEqual({
      keyId: "key-1",
      organizationId: "org-1",
      fingerprint: "fingerprint-1",
    })
    expect(mockHashApiKey).toHaveBeenCalledWith(
      "a".repeat(43),
      expect.any(String)
    )
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "key-1", status: "ACTIVE" },
      data: {
        lastUsedAt: expect.any(Date),
        lastUsedIp: "203.0.113.10",
        lastUsedUserAgent: "system-client",
      },
    })
  })

  it("always uses the organization stored with the key instead of caller input", async () => {
    const findFirst = mock(async () => ({
      id: "key-2",
      organizationId: "org-owner",
      fingerprint: "fingerprint-2",
    }))
    const updateMany = mock(async () => ({ count: 1 }))

    const result = await verifyWhatsappOrganizationApiKey(
      validKey,
      {},
      asDatabase({ whatsappOrganizationApiKey: { findFirst, updateMany } })
    )

    expect(result?.organizationId).toBe("org-owner")
    expect(JSON.stringify(result)).not.toContain("org-caller")
  })

  it("fails closed when API-key hashing is not configured", async () => {
    delete process.env.API_KEY_HASH_SALT
    mockGetApiKeyHashSalt.mockImplementation(() => {
      throw new Error("API_KEY_HASH_SALT environment variable is required")
    })
    const findFirst = mock(async () => null)
    const updateMany = mock(async () => ({ count: 1 }))

    await expect(
      verifyWhatsappOrganizationApiKey(
        validKey,
        {},
        asDatabase({ whatsappOrganizationApiKey: { findFirst, updateMany } })
      )
    ).rejects.toThrow("API_KEY_HASH_SALT environment variable is required")
    expect(findFirst).not.toHaveBeenCalled()
  })
})
