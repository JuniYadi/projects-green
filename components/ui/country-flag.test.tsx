import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import * as React from "react"
import { CountryFlag, emojiToCountryCode } from "./country-flag"

describe("emojiToCountryCode", () => {
  it("converts emoji flag to ISO 2-letter country code", () => {
    expect(emojiToCountryCode("🇮🇩")).toBe("ID")
    expect(emojiToCountryCode("🇺🇸")).toBe("US")
    expect(emojiToCountryCode("🇸🇬")).toBe("SG")
    expect(emojiToCountryCode("🇪🇸")).toBe("ES")
    expect(emojiToCountryCode("🇧🇷")).toBe("BR")
  })

  it("returns null for non-flag input", () => {
    expect(emojiToCountryCode("ID")).toBeNull()
    expect(emojiToCountryCode("🌐")).toBeNull()
    expect(emojiToCountryCode("")).toBeNull()
  })
})

describe("CountryFlag", () => {
  it("renders SVG for valid uppercase country code", () => {
    const { container } = render(<CountryFlag country="ID" />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
  })

  it("renders SVG for lowercase country code", () => {
    const { container } = render(<CountryFlag country="us" />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
  })

  it("renders SVG when passed an emoji flag", () => {
    const { container } = render(<CountryFlag country="🇮🇩" />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
  })

  it("renders null for null or undefined country", () => {
    const { container: c1 } = render(<CountryFlag country={null} />)
    expect(c1.querySelector("svg")).toBeNull()

    const { container: c2 } = render(<CountryFlag country={undefined} />)
    expect(c2.querySelector("svg")).toBeNull()
  })

  it("renders fallback for unknown country code", () => {
    const { container } = render(
      <CountryFlag country="INVALID" fallback={<span>fallback</span>} />
    )
    expect(container.querySelector("svg")).toBeNull()
    expect(container.textContent).toContain("fallback")
  })

  it("applies custom className and title", () => {
    const { container } = render(
      <CountryFlag country="ES" className="custom-flag" title="Spain Flag" />
    )
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("class")).toContain("custom-flag")
  })
})
