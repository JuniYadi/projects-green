import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockFetch = mock(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
  } as Response)
)

global.fetch = mockFetch as unknown as typeof fetch

describe("ConsolePage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders static header text", async () => {
    const { default: ConsolePage } = await import("./page")
    const { container } = render(<ConsolePage />)

    // Static header text renders in initial client render
    expect(container.textContent).toContain("Console")
    expect(container.textContent).toContain("Current Balance")
    expect(container.textContent).toContain("Spent This Month")
    expect(container.textContent).toContain("Last Invoice")
    expect(container.textContent).toContain("Open Tickets")

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })
  })
})
