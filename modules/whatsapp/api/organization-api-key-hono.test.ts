import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Hono } from "hono"

import type { WhatsappOrganizationApiKeyAuthContext } from "../organization-api-keys/organization-api-key.verifier"

const mockVerify = mock(
  async (): Promise<WhatsappOrganizationApiKeyAuthContext | null> => null
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappOrganizationApiKey: {
      findFirst: mock(async () => null),
      updateMany: mock(async () => ({ count: 0 })),
    },
  },
}))
mock.module("@/lib/whatsapp/crypto", () => ({
  getApiKeyHashSalt: mock(() => "test-api-key-hash-salt"),
  hashApiKey: mock(async () => "hash"),
  generateRawApiKey: mock(async () => ({ raw: "", hash: "" })),
}))

const { createWhatsappOrganizationApiKeyMiddleware } =
  await import("./organization-api-key-hono")

describe("WhatsApp organization API-key Hono adapter", () => {
  beforeEach(() => {
    mockVerify.mockClear()
    mockVerify.mockResolvedValue(null)
  })

  const createApp = () => {
    const app = new Hono<{
      Variables: {
        whatsappOrganizationApiKey: {
          keyId: string
          organizationId: string
          fingerprint: string
        }
      }
    }>()
    app.use("*", createWhatsappOrganizationApiKeyMiddleware(mockVerify))
    app.get("/resource", (c) =>
      c.json({
        organizationId: c.get("whatsappOrganizationApiKey").organizationId,
      })
    )
    return app
  }

  it("returns the same non-enumerating 401 for missing and malformed keys", async () => {
    const app = createApp()
    const missing = await app.request("http://localhost/resource")
    const malformed = await app.request("http://localhost/resource", {
      headers: { Authorization: "Bearer malformed" },
    })

    expect(missing.status).toBe(401)
    expect(malformed.status).toBe(401)
    const missingBody = await missing.json()
    const malformedBody = await malformed.json()
    expect(missingBody).toEqual(malformedBody)
    expect(JSON.stringify(missingBody)).not.toContain("malformed")
  })

  it("passes the verified organization context to downstream Hono handlers", async () => {
    mockVerify.mockResolvedValue({
      keyId: "key-1",
      organizationId: "org-owner",
      fingerprint: "fingerprint-1",
    })
    const app = createApp()

    const response = await app.request("http://localhost/resource", {
      headers: {
        Authorization: "Bearer wa_live_valid",
        "x-forwarded-for": "203.0.113.20, 10.0.0.1",
        "user-agent": "system-client",
      },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ organizationId: "org-owner" })
    expect(mockVerify).toHaveBeenCalledWith("wa_live_valid", {
      clientIp: "203.0.113.20",
      userAgent: "system-client",
    })
  })

  it("does not distinguish revoked and unknown keys", async () => {
    const app = createApp()
    const revoked = await app.request("http://localhost/resource", {
      headers: { Authorization: "Bearer wa_live_revoked" },
    })
    const unknown = await app.request("http://localhost/resource", {
      headers: { Authorization: "Bearer wa_live_unknown" },
    })

    expect(revoked.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(await revoked.json()).toEqual(await unknown.json())
  })
})
