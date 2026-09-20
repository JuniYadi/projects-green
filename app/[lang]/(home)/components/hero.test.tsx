import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { HeroSection } from "./hero"

describe("HeroSection", () => {
  it("renders the hero heading", () => {
    const { getByRole } = render(<HeroSection />)
    expect(getByRole("heading", { level: 1 })).toBeInTheDocument()
  })
})
