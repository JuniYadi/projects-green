import { describe, expect, it } from "bun:test"

import {
  getTemplatePlaceholderIndexes,
  renderTemplateBody,
  resolveTemplatePreviewValues,
} from "./template-renderer"

describe("template-renderer", () => {
  describe("getTemplatePlaceholderIndexes", () => {
    it("returns empty array for empty or null body", () => {
      expect(getTemplatePlaceholderIndexes(null)).toEqual([])
      expect(getTemplatePlaceholderIndexes(undefined)).toEqual([])
      expect(getTemplatePlaceholderIndexes("")).toEqual([])
    })

    it("returns empty array when no placeholders are present", () => {
      expect(getTemplatePlaceholderIndexes("Hello world!")).toEqual([])
    })

    it("extracts and sorts unique 1-based placeholder indexes", () => {
      const body = "Hello {{2}}, your code is {{1}}. Repeat: {{1}}"
      expect(getTemplatePlaceholderIndexes(body)).toEqual([1, 2])
    })

    it("ignores non-positive and malformed placeholder values", () => {
      const body = "Test {{0}} and {{-1}} and {{abc}} and {{ 3 }}"
      expect(getTemplatePlaceholderIndexes(body)).toEqual([3])
    })
  })

  describe("renderTemplateBody", () => {
    it("returns empty string for null or empty body", () => {
      expect(renderTemplateBody(null)).toBe("")
      expect(renderTemplateBody(undefined)).toBe("")
    })

    it("returns original body if no values provided", () => {
      const body = "Hello {{1}}"
      expect(renderTemplateBody(body)).toBe("Hello {{1}}")
      expect(renderTemplateBody(body, {})).toBe("Hello {{1}}")
    })

    it("replaces placeholders with provided values", () => {
      const body = "Hi {{1}}, order #{{2}} is ready"
      const result = renderTemplateBody(body, { 1: "Alice", 2: "9988" })
      expect(result).toBe("Hi Alice, order #9988 is ready")
    })

    it("replaces unprovided placeholders with empty string", () => {
      const body = "Hi {{1}}, code is {{2}}"
      const result = renderTemplateBody(body, { 1: "Bob" })
      expect(result).toBe("Hi Bob, code is ")
    })
  })

  describe("resolveTemplatePreviewValues", () => {
    it("returns empty object if template has no placeholders", () => {
      const result = resolveTemplatePreviewValues({ body: "Static message" })
      expect(result).toEqual({})
    })

    it("uses explicit overrides first", () => {
      const result = resolveTemplatePreviewValues(
        { body: "Hello {{1}}, code is {{2}}" },
        { 1: "CustomName", 2: "123456" }
      )
      expect(result).toEqual({ 1: "CustomName", 2: "123456" })
    })

    it("falls back to OTP sample value for likely OTP template at index 1", () => {
      const result = resolveTemplatePreviewValues({
        body: "Your verification code is {{1}}",
      })
      expect(result[1]).toBe("549281")
    })

    it("falls back to Example N for standard placeholders without examples", () => {
      const result = resolveTemplatePreviewValues({
        body: "Welcome {{1}} to {{2}}",
      })
      expect(result).toEqual({ 1: "Example 1", 2: "Example 2" })
    })

    it("extracts examples from array parameters", () => {
      const result = resolveTemplatePreviewValues({
        body: "Hello {{1}}, balance is {{2}}",
        parameters: [
          { type: "BODY", text: "John" },
          { type: "BODY", text: "$100" },
        ],
      })
      expect(result).toEqual({ 1: "John", 2: "$100" })
    })

    it("extracts examples from component structure with 2D body_text", () => {
      const result = resolveTemplatePreviewValues({
        body: "Hello {{1}}, track at {{2}}",
        parameters: {
          components: [
            {
              type: "BODY",
              example: {
                body_text: [["Jane", "https://track.example.com"]],
              },
            },
          ],
        },
      })
      expect(result).toEqual({ 1: "Jane", 2: "https://track.example.com" })
    })

    it("extracts examples from component structure with flat body_text", () => {
      const result = resolveTemplatePreviewValues({
        body: "Code: {{1}}",
        parameters: {
          components: [
            {
              type: "BODY",
              example: {
                body_text: ["887766"],
              },
            },
          ],
        },
      })
      expect(result).toEqual({ 1: "887766" })
    })

    it("handles invalid or non-matching components safely", () => {
      const result = resolveTemplatePreviewValues({
        body: "Hi {{1}}",
        parameters: {
          components: [{ type: "HEADER" }, null, "invalid"],
        },
      })
      expect(result).toEqual({ 1: "Example 1" })
    })
  })
})
