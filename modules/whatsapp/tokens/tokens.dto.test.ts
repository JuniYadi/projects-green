import { describe, expect, it } from "bun:test"
import type { WhatsappApiKey } from "@prisma/client"

import { toWhatsappApiKeyDTO } from "./tokens.dto"

const token: WhatsappApiKey = {
  id: "tok-1",
  organizationId: "org-1",
  name: "Production",
  key: "secret-value",
  environment: "LIVE",
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date("2026-09-13T00:00:00.000Z"),
  updatedAt: new Date("2026-09-13T00:00:00.000Z"),
}

describe("toWhatsappApiKeyDTO (WA-C02)", () => {
  it("never exposes the stored key secret", () => {
    const dto = toWhatsappApiKeyDTO(token)

    expect(dto).not.toHaveProperty("key")
    expect(JSON.stringify(dto)).not.toContain("secret-value")
  })

  it("keeps every non-secret field", () => {
    const { key: _secret, ...expected } = token

    expect(toWhatsappApiKeyDTO(token)).toEqual(expected)
  })
})
