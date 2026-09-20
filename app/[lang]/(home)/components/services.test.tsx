import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { ServicesSection } from "./services"

describe("ServicesSection", () => {
  it("renders services list", () => {
    const { container } = render(<ServicesSection />)
    expect(container.querySelector("#services")).toBeInTheDocument()
  })
})
