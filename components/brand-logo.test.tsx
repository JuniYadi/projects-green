import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { BrandLogo, BrandLogoIcon } from "./brand-logo"

describe("BrandLogo Component", () => {
  it("renders the PFNApp brand text and logo icon", () => {
    const { container, getByText } = render(<BrandLogo size="md" />)
    expect(getByText("PFN")).toBeInTheDocument()
    expect(getByText("App")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("renders BrandLogoIcon with customized sizes", () => {
    const { container } = render(<BrandLogoIcon size="lg" />)
    const svg = container.querySelector("svg")
    expect(svg).toBeInTheDocument()
    expect(svg?.getAttribute("width")).toBe("24")
  })
})
