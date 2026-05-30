import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { Slider } from "./slider"

describe("Slider", () => {
  it("renders with default props", () => {
    const view = render(<Slider />)
    const root = view.container.querySelector('[data-slot="slider"]')
    expect(root).toBeInTheDocument()
  })

  it("renders with custom className", () => {
    const view = render(<Slider className="custom-class" />)
    const root = view.container.querySelector('[data-slot="slider"]')
    expect(root?.classList.contains("custom-class")).toBe(true)
  })

  it("renders with controlled value", () => {
    const view = render(<Slider value={[75]} />)
    const root = view.container.querySelector('[data-slot="slider"]')
    expect(root).toBeInTheDocument()
  })

  it("renders with multiple thumbs for range", () => {
    const view = render(<Slider defaultValue={[20, 80]} />)
    const thumbs = view.container.querySelectorAll('[data-slot="slider-thumb"]')
    expect(thumbs.length).toBe(2)
  })

  it("renders as disabled", () => {
    const view = render(<Slider disabled />)
    const root = view.container.querySelector('[data-slot="slider"]')
    expect(root).toHaveAttribute("data-disabled")
  })

  it("renders with vertical orientation", () => {
    const view = render(<Slider orientation="vertical" />)
    const root = view.container.querySelector('[data-slot="slider"]')
    expect(root).toHaveAttribute("data-orientation", "vertical")
  })
})
