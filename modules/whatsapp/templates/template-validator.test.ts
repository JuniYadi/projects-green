import { describe, expect, it } from "bun:test"
import {
  extractTemplateVariables,
  formatTemplateSlug,
  validateTemplateBodyRules,
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
  })
})
