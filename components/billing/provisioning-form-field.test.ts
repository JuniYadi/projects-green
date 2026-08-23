import { describe, expect, test } from "bun:test"
import {
  matchesPattern,
  parseCheckboxValues,
  serializeCheckboxValues,
} from "./provisioning-form-field"

describe("ProvisioningFormField utilities", () => {
  describe("matchesPattern", () => {
    test("matches regex correctly", () => {
      expect(matchesPattern("12345", "^\\d+$")).toBe(true)
      expect(matchesPattern("abc", "^\\d+$")).toBe(false)
    })

    test("returns true if no pattern is supplied", () => {
      expect(matchesPattern("any-text")).toBe(true)
      expect(matchesPattern("any-text", "")).toBe(true)
    })

    test("handles malformed regex safely without crashing", () => {
      expect(matchesPattern("test", "[invalid regex")).toBe(true)
    })
  })

  describe("parseCheckboxValues & serializeCheckboxValues", () => {
    test("serializes and parses JSON arrays without corruption from commas in values", () => {
      const items = ["Option 1, with comma", "Option 2, also with comma"]
      const serialized = serializeCheckboxValues(items)
      const parsed = parseCheckboxValues(serialized)
      expect(parsed).toEqual(items)
    })

    test("falls back to legacy comma-delimited strings", () => {
      const legacy = "opt1, opt2"
      const parsed = parseCheckboxValues(legacy)
      expect(parsed).toEqual(["opt1", "opt2"])
    })

    test("returns empty array for empty inputs", () => {
      expect(parseCheckboxValues("")).toEqual([])
      expect(parseCheckboxValues(undefined)).toEqual([])
    })
  })
})
