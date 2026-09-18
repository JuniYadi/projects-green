import { describe, expect, it } from "bun:test"
import { generateSuggestedAppName } from "./app-name-generator"

describe("generateSuggestedAppName", () => {
  it("generates a formatted name with slug, adjective, noun, and suffix", () => {
    const name = generateSuggestedAppName("laravel")
    expect(name).toMatch(/^laravel-[a-z]+-[a-z]+-[a-z0-9]{4}$/)
  })

  it("prefixes leading numbers with app-", () => {
    const name = generateSuggestedAppName("9router")
    expect(name).toMatch(/^app-9router-[a-z]+-[a-z]+-[a-z0-9]{4}$/)
  })

  it("sanitizes special characters into dashes", () => {
    const name = generateSuggestedAppName("My Repo / Project! 123")
    expect(name).toMatch(/^my-repo-project-123-[a-z]+-[a-z]+-[a-z0-9]{4}$/)
  })

  it("falls back to app when base is empty", () => {
    const name = generateSuggestedAppName("")
    expect(name).toMatch(/^app-[a-z]+-[a-z]+-[a-z0-9]{4}$/)
  })
})
