import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { Separator } from "@/components/ui/separator"

describe("Separator", () => {
  it("renders with horizontal defaults", () => {
    const view = render(<Separator />)
    const separator = view.container.querySelector(
      '[data-slot="separator"]'
    ) as HTMLElement

    expect(separator).toBeInTheDocument()
    expect(separator).toHaveClass("data-horizontal:h-px")
  })

  it("supports vertical orientation and custom classes", () => {
    const view = render(
      <Separator orientation="vertical" className="custom-separator" />
    )
    const separator = view.container.querySelector(
      '[data-slot="separator"]'
    ) as HTMLElement

    expect(separator).toHaveClass("custom-separator")
    expect(separator).toHaveAttribute("data-orientation", "vertical")
  })
})
