import { describe, expect, it } from "bun:test"
import Page, { metadata } from "./page"

describe("PlatformTerminalStandalonePage metadata", () => {
  it("exports metadata and page component", () => {
    expect(metadata.title).toBe("Terminal Console")
    expect(typeof Page).toBe("function")
  })
})
