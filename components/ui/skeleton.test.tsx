import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import { Skeleton } from "@/components/ui/skeleton"

describe("Skeleton", () => {
  it("renders with base skeleton styles", () => {
    const view = render(<Skeleton data-testid="base-skeleton" />)
    const skeleton = view.getByTestId("base-skeleton")

    expect(skeleton).toHaveAttribute("data-slot", "skeleton")
    expect(skeleton).toHaveClass("animate-pulse")
    expect(skeleton).toHaveClass("bg-muted")
  })

  it("merges custom class names", () => {
    const view = render(
      <Skeleton
        data-testid="custom-skeleton"
        className="h-8 w-24"
      />
    )

    expect(view.getByTestId("custom-skeleton")).toHaveClass("h-8")
    expect(view.getByTestId("custom-skeleton")).toHaveClass("w-24")
  })
})
