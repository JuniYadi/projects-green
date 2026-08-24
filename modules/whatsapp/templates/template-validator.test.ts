import { describe, expect, it } from "bun:test"
import {
  extractTemplateVariables,
  formatTemplateSlug,
  validateTemplateBodyRules,
  buildMetaTemplateComponents,
} from "./template-validator"

describe("template-validator", () => {
  describe("extractTemplateVariables", () => {
    it("extracts unique sorted placeholder indexes", () => {
      const text = "Hello {{1}}, your order {{2}} has been shipped with {{1}}."
      expect(extractTemplateVariables(text)).toEqual([1, 2])
    })

    it("returns empty array when text has no placeholders", () => {
      expect(extractTemplateVariables("Plain text")).toEqual([])
      expect(extractTemplateVariables("")).toEqual([])
      expect(extractTemplateVariables(null)).toEqual([])
    })
  })

  describe("formatTemplateSlug", () => {
    it("formats text into lowercase snake_case alphanumeric only", () => {
      expect(formatTemplateSlug("Order Status Update")).toBe(
        "order_status_update"
      )
      expect(formatTemplateSlug("Flash-Sale #2026!")).toBe("flash_sale_2026")
      expect(formatTemplateSlug("  welcome_message  ")).toBe("welcome_message")
      expect(formatTemplateSlug("pengingat-donor-darah")).toBe(
        "pengingat_donor_darah"
      )
      expect(formatTemplateSlug("Pengingat Donor Darah")).toBe(
        "pengingat_donor_darah"
      )
      expect(formatTemplateSlug("pengingat_donor_darah")).toBe(
        "pengingat_donor_darah"
      )
    })
  })

  describe("validateTemplateBodyRules", () => {
    it("validates sequential variables successfully", () => {
      const result = validateTemplateBodyRules(
        "Halo {{1}}, pesanan {{2}} telah dikirim. Terima kasih."
      )
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
      expect(result.indexes).toEqual([1, 2])
    })

    it("errors on non-sequential placeholders", () => {
      const result = validateTemplateBodyRules("Halo {{2}}, pesanan {{3}}.")
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain(
        "Variables must be sequential starting at {{1}}"
      )
    })

    it("errors on consecutive placeholders", () => {
      const result = validateTemplateBodyRules("Halo {{1}}{{2}}, terima kasih.")
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain("Consecutive variables")
    })

    it("warns when variable is at the very end of body text", () => {
      const result = validateTemplateBodyRules("Halo {{1}}, pesanan Anda {{2}}")
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain(
        "variables at the end of the message"
      )
    })

    it("detects OTP keywords when category is UTILITY or MARKETING and suggests AUTHENTICATION", () => {
      const result = validateTemplateBodyRules(
        "Kode verifikasi OTP akun Anda adalah {{1}}. Jangan berikan kepada siapapun.",
        "UTILITY",
        "id"
      )
      expect(result.isValid).toBe(true)
      expect(result.ruleWarnings).toHaveLength(1)
      expect(result.ruleWarnings[0].ruleId).toBe("RULE_OTP_NON_AUTH")
      expect(result.ruleWarnings[0].suggestedCategory).toBe("AUTHENTICATION")
    })

    it("detects promotional words in UTILITY template and suggests MARKETING", () => {
      const result = validateTemplateBodyRules(
        "Halo {{1}}, klaim diskon promo spesial 50% untuk pesanan berikutnya!",
        "UTILITY",
        "en"
      )
      expect(result.isValid).toBe(true)
      expect(result.ruleWarnings).toHaveLength(1)
      expect(result.ruleWarnings[0].ruleId).toBe("RULE_PROMO_IN_UTILITY")
      expect(result.ruleWarnings[0].suggestedCategory).toBe("MARKETING")
    })

    it("detects call-to-action urgency words (ayo, segera, buruan) in UTILITY template and suggests MARKETING", () => {
      const result = validateTemplateBodyRules(
        "Halo {{1}}, segera selesaikan pembayaran Anda sekarang dan dapatkan penawaran kami.",
        "UTILITY",
        "id"
      )
      expect(result.isValid).toBe(true)
      expect(result.ruleWarnings).toHaveLength(1)
      expect(result.ruleWarnings[0].ruleId).toBe("RULE_PROMO_IN_UTILITY")
      expect(result.ruleWarnings[0].suggestedCategory).toBe("MARKETING")
    })

    it("does not warn about promotional words when category is already MARKETING", () => {
      const result = validateTemplateBodyRules(
        "Halo {{1}}, klaim diskon promo spesial 50% untuk pesanan berikutnya!",
        "MARKETING",
        "en"
      )
      expect(result.ruleWarnings).toHaveLength(0)
    })
  })
  describe("buildMetaTemplateComponents", () => {
    it("builds HEADER, BODY, FOOTER, and BUTTONS components correctly", () => {
      const components = buildMetaTemplateComponents({
        headerType: "TEXT",
        headerText: "Order {{1}} Update",
        body: "Hello {{1}}, your order total is {{2}}.",
        footer: "Thank you for shopping with us.",
        buttons: [
          { type: "QUICK_REPLY", text: "Track Order" },
          {
            type: "URL",
            text: "Visit Web",
            url: "https://example.com/orders/{{1}}",
          },
          {
            type: "PHONE_NUMBER",
            text: "Call Support",
            phoneNumber: "+6281234567890",
          },
        ],
      })

      expect(components).toEqual([
        {
          type: "HEADER",
          format: "TEXT",
          text: "Order {{1}} Update",
          example: {
            header_text: ["Sample 1"],
          },
        },
        {
          type: "BODY",
          text: "Hello {{1}}, your order total is {{2}}.",
          example: {
            body_text: [["Sample 1", "Sample 2"]],
          },
        },
        {
          type: "FOOTER",
          text: "Thank you for shopping with us.",
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Track Order" },
            {
              type: "URL",
              text: "Visit Web",
              url: "https://example.com/orders/{{1}}",
              example: ["param_1"],
            },
            {
              type: "PHONE_NUMBER",
              text: "Call Support",
              phone_number: "+6281234567890",
            },
          ],
        },
      ])
    })

    it("builds media header component with example handle", () => {
      const components = buildMetaTemplateComponents({
        headerType: "IMAGE",
        headerUrl: "https://example.com/banner.jpg",
        body: "Simple body without variables",
      })

      expect(components).toEqual([
        {
          type: "HEADER",
          format: "IMAGE",
          example: {
            header_handle: ["https://example.com/banner.jpg"],
          },
        },
        {
          type: "BODY",
          text: "Simple body without variables",
        },
      ])
    })
  })
})
