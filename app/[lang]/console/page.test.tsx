import { describe, expect, it, mock } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"

// Mock all API calls to return empty/unavailable states
const mockFetch = mock((url: string) => {
  if (url.includes("/docs/list")) {
    return Promise.resolve({
      json: () => Promise.resolve({ ok: true, docs: [] }),
    } as Response)
  }
  return Promise.resolve({
    json: () => Promise.resolve({ ok: false }),
  } as unknown as Response)
})

global.fetch = mockFetch as unknown as typeof fetch

describe("ConsolePage", () => {
  it("renders dashboard header and loading state", async () => {
    const { default: Page } = await import("./page")
    render(<Page />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Console" })).toBeInTheDocument()
    })

    // Should show 4 dashboard card titles
    expect(screen.getByText("Current Balance")).toBeInTheDocument()
    expect(screen.getByText("Spent This Month")).toBeInTheDocument()
    expect(screen.getByText("Last Invoice")).toBeInTheDocument()
    expect(screen.getByText("Open Tickets")).toBeInTheDocument()
  })
})
