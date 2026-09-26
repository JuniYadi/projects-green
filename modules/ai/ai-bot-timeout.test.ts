import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { getAiBotTimeoutMs, isAiBotTimeoutError } from "./ai-bot-timeout"

describe("ai-bot-timeout", () => {
  const originalEnv = process.env.AI_BOT_TIMEOUT_MS

  beforeEach(() => {
    delete process.env.AI_BOT_TIMEOUT_MS
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AI_BOT_TIMEOUT_MS
    } else {
      process.env.AI_BOT_TIMEOUT_MS = originalEnv
    }
  })

  describe("getAiBotTimeoutMs", () => {
    it("returns the default when AI_BOT_TIMEOUT_MS is unset", () => {
      expect(getAiBotTimeoutMs()).toBe(60000)
    })

    it("returns the parsed env value", () => {
      process.env.AI_BOT_TIMEOUT_MS = "3000"
      expect(getAiBotTimeoutMs()).toBe(3000)
    })

    it("falls back to default for zero", () => {
      process.env.AI_BOT_TIMEOUT_MS = "0"
      expect(getAiBotTimeoutMs()).toBe(60000)
    })

    it("falls back to default for a negative value", () => {
      process.env.AI_BOT_TIMEOUT_MS = "-500"
      expect(getAiBotTimeoutMs()).toBe(60000)
    })

    it("falls back to default for a non-numeric value", () => {
      process.env.AI_BOT_TIMEOUT_MS = "not-a-number"
      expect(getAiBotTimeoutMs()).toBe(60000)
    })
  })

  describe("isAiBotTimeoutError", () => {
    it("returns true for a TimeoutError", () => {
      const error = Object.assign(new Error("timed out"), {
        name: "TimeoutError",
      })
      expect(isAiBotTimeoutError(error)).toBe(true)
    })

    it("returns true for an AbortError", () => {
      const error = Object.assign(new Error("aborted"), {
        name: "AbortError",
      })
      expect(isAiBotTimeoutError(error)).toBe(true)
    })

    it("returns false for a generic error", () => {
      expect(isAiBotTimeoutError(new Error("boom"))).toBe(false)
    })

    it("returns false for a non-Error value", () => {
      expect(isAiBotTimeoutError("boom")).toBe(false)
    })
  })
})
