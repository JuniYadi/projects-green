import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { Skeleton } from "@/components/ui/skeleton"

describe("Skeleton", () => {
  it("renders with base skeleton styles", () => {
    const view = render(<Skeleton data-testid="base-skeleton" />)
    const skeleton = view.getByTestId("base-skeleton")

    expect(skeleton.getAttribute("data-slot")).toBe("skeleton")
    expect(skeleton.className).toContain("animate-pulse")
    expect(skeleton.className).toContain("bg-muted")
  })

  it("merges custom class names", () => {
    const view = render(
      <Skeleton
        data-testid="custom-skeleton"
        className="h-8 w-24"
      />
    )

    expect(view.getByTestId("custom-skeleton").className).toContain("h-8")
  })
})
