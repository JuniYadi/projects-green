import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

// Mock fetch for the docs list API call
const mockFetch = mock(
  (): Promise<Response> =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          ok: true,
          docs: [
            {
              id: "1",
              path: "/test",
              title: "Test Doc",
              purpose: "Testing",
              howTo: ["step1"],
              notes: [],
              updatedAt: "2026-06-01",
              score: 0,
            },
          ],
        }),
    } as unknown as Response)
)

global.fetch = mockFetch as unknown as typeof fetch

describe("PortalDocumentationsPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders documentation list after loading", async () => {
    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(view.getByText("Test Doc")).toBeTruthy()
    })
  })
})
