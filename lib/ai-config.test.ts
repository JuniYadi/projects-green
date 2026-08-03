import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import { DEFAULT_AI_BASE_URL, getAiProviderConfig } from "@/lib/ai-config"

const environmentKeys = [
  "AI_API_KEY",
  "AI_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
] as const

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]])
)

describe("getAiProviderConfig", () => {
  beforeEach(() => {
    delete process.env.AI_API_KEY
    delete process.env.AI_BASE_URL
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_BASE_URL
  })

  afterEach(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment[key]

      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it("returns shared API key and configured base URL", () => {
    process.env.AI_API_KEY = "shared-key"
    process.env.AI_BASE_URL = "https://provider.example/v1"

    expect(getAiProviderConfig()).toEqual({
      apiKey: "shared-key",
      baseURL: "https://provider.example/v1",
    })
  })

  it("uses the default base URL when configured URL is blank or missing", () => {
    process.env.AI_API_KEY = "shared-key"
    process.env.AI_BASE_URL = "   "

    expect(getAiProviderConfig().baseURL).toBe(DEFAULT_AI_BASE_URL)

    delete process.env.AI_BASE_URL

    expect(getAiProviderConfig().baseURL).toBe(DEFAULT_AI_BASE_URL)
  })

  it("rejects missing or whitespace-only API keys", () => {
    expect(() => getAiProviderConfig()).toThrow("AI_API_KEY is not configured")

    process.env.AI_API_KEY = "   "

    expect(() => getAiProviderConfig()).toThrow("AI_API_KEY is not configured")
  })

  it("rejects legacy OpenAI configuration without the shared API key", () => {
    process.env.OPENAI_API_KEY = "legacy-key"

    expect(() => getAiProviderConfig()).toThrow("AI_API_KEY is not configured")
  })
})
