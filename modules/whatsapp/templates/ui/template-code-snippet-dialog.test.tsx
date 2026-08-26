import "@/test/register"
import { describe, expect, it } from "bun:test"
import {
  generateCurlTemplateSnippet,
  generateTemplatePayload,
  toPythonLiteral,
} from "./template-code-snippet-dialog"
import type {
  WhatsAppTemplate,
  WhatsAppTemplateLanguage,
} from "@/lib/api/whatsapp-client"

const mockLanguage: WhatsAppTemplateLanguage = {
  id: "lang-1",
  lang: "id",
  headerText: "Header Promo",
  body: "Halo {{1}}, kode OTP Anda adalah *{{2}}*.",
  footer: "Jangan bagikan ke siapapun.",
  buttons: [
    {
      type: "OTP",
      text: "Salin Kode",
    },
  ],
}

const mockTemplate: WhatsAppTemplate = {
  id: "tpl-1",
  slug: "otp_verification",
  name: "OTP Verification",
  organizationId: "org-1",
  category: "AUTHENTICATION",
  metaStatus: "APPROVED",
  languages: [mockLanguage],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

describe("generateCurlTemplateSnippet", () => {
  it("uses an explicit shell variable for the authorization header", () => {
    const snippet = generateCurlTemplateSnippet(
      "https://example.test/api/v1/whatsapp/messages",
      '{"to":"+6281234567890"}'
    )

    expect(snippet).toContain('-H "Authorization: Bearer $WHATSAPP_API_KEY"')
    expect(snippet).not.toContain("YOUR_API_KEY")
  })
})

describe("generateTemplatePayload", () => {
  it("generates correct structured template payload with variable parameters and OTP sub_type", () => {
    const payload = generateTemplatePayload(
      mockTemplate,
      mockLanguage,
      { 1: "Budi", 2: "998811" },
      "+6281234567890"
    )

    expect(payload.to).toBe("+6281234567890")
    expect(payload.type).toBe("template")
    expect(payload.template.name).toBe("otp_verification")
    expect(payload.template.language.code).toBe("id")

    const components = payload.template.components as Array<
      Record<string, unknown>
    >
    expect(components).toBeDefined()
    expect(components.length).toBe(2)

    // Body parameters
    const bodyComp = components.find((c) => c.type === "body")
    expect(bodyComp).toBeDefined()
    expect(bodyComp?.parameters).toEqual([
      { type: "text", text: "Budi" },
      { type: "text", text: "998811" },
    ])

    // Button parameters (OTP buttons must use sub_type: "otp")
    const buttonComp = components.find((c) => c.type === "button")
    expect(buttonComp).toBeDefined()
    expect(buttonComp?.sub_type).toBe("otp")
    expect(buttonComp?.parameters).toEqual([{ type: "text", text: "Budi" }])
  })
})

describe("toPythonLiteral", () => {
  it("safely serializes booleans, nulls, and strings without substring corruption", () => {
    const data = {
      is_active: true,
      is_disabled: false,
      optional_field: null,
      notes: "unfortunately this is nullified and true value stays intact",
      nested: {
        numbers: [1, 2, 3],
      },
    }

    const py = toPythonLiteral(data)
    expect(py).toContain('"is_active": True')
    expect(py).toContain('"is_disabled": False')
    expect(py).toContain('"optional_field": None')
    expect(py).toContain(
      '"notes": "unfortunately this is nullified and true value stays intact"'
    )
  })
})
