import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { Separator } from "@/components/ui/separator"

describe("Separator", () => {
  it("renders with horizontal defaults", () => {
    const view = render(<Separator />)
    const separator = view.container.querySelector(
      '[data-slot="separator"]'
    ) as HTMLElement

    expect(separator).toBeTruthy()
    expect(separator.className).toContain("data-horizontal:h-px")
  })

  it("supports vertical orientation and custom classes", () => {
    const view = render(
      <Separator
        orientation="vertical"
        className="custom-separator"
      />
    )
    const separator = view.container.querySelector(
      '[data-slot="separator"]'
    ) as HTMLElement

    expect(separator.className).toContain("custom-separator")
    expect(separator.getAttribute("data-orientation")).toBe("vertical")
  })
})
