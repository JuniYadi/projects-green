import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import ConsolePage from "@/app/console/page"

describe("ConsolePage", () => {
  it("renders default dashboard placeholder cards", () => {
    const view = render(<ConsolePage />)

    expect(view.container.querySelectorAll(".aspect-video").length).toBe(3)
    expect(view.container.querySelectorAll(".bg-muted\/50").length).toBe(4)
  })
})
