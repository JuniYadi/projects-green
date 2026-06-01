import { describe, expect, it, mock, beforeEach } from "bun:test"

const mockCreate = mock(async () => ({ id: "key_1" }))

mock.module("@/lib/prisma", () => ({
  prisma: {
    apiKey: { create: mockCreate },
  },
}))

const { hashApiKey } = await import("@/lib/whatsapp/crypto")

describe("create-api-key script", () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockCreate.mockImplementation(async () => ({
      id: "key_1",
    }))
  })

  it("generates a key with test_ prefix for SANDBOX", async () => {
    const { generateRawApiKey } = await import("@/lib/whatsapp/crypto")
    const { raw, hash } = await generateRawApiKey("test_")
    expect(raw).toMatch(/^test_/)
    expect(hash).toBeTruthy()
  })

  it("generates a key with live_ prefix for LIVE", async () => {
    const { generateRawApiKey } = await import("@/lib/whatsapp/crypto")
    const { raw, hash } = await generateRawApiKey("live_")
    expect(raw).toMatch(/^live_/)
    expect(hash).toBeTruthy()
  })

  it("hashes the key correctly", async () => {
    const raw = "test_abc123"
    const salt = "dev-salt-change-me"
    const hash = await hashApiKey(raw, salt)
    expect(typeof hash).toBe("string")
    expect(hash.length).toBeGreaterThan(0)
  })

  it("creates an ApiKey with correct fields", async () => {
    const { generateRawApiKey } = await import("@/lib/whatsapp/crypto")
    const { hash } = await generateRawApiKey("test_")

    ;(mockCreate as (...args: unknown[]) => unknown)({
      name: "Test Key",
      keyHash: hash,
      environment: "SANDBOX",
      organizationId: "org_1",
      scopes: ["platform:admin"],
      active: true,
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Key",
        environment: "SANDBOX",
        organizationId: "org_1",
        scopes: ["platform:admin"],
        active: true,
      })
    )
  })
})
