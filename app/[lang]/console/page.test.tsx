import { describe, expect, it } from "bun:test"
import { render, screen } from "@testing-library/react"

describe("ConsolePage", () => {
  it("renders static header text", async () => {
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    // Static header text renders in initial client render
    expect(container.textContent).toContain("Console")
    expect(container.textContent).toContain("Current Balance")
    expect(container.textContent).toContain("Spent This Month")
    expect(container.textContent).toContain("Last Invoice")
    expect(container.textContent).toContain("Open Tickets")
  })
})
