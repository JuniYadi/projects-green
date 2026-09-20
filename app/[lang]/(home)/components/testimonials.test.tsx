import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { TestimonialsSection } from "./testimonials"

describe("TestimonialsSection", () => {
  it("renders reliability pillars section", () => {
    const { getByRole } = render(<TestimonialsSection />)
    expect(getByRole("heading", { level: 2 })).toBeInTheDocument()
  })
})
