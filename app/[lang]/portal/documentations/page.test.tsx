import { beforeEach, describe, expect, it, mock, type Mock } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"

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
    } as Response)
) as Mock

global.fetch = mockFetch

describe("PortalDocumentationsPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders documentation list after loading", async () => {
    const { default: Page } = await import("./page")
    render(<Page />)

    await waitFor(() => {
      expect(screen.getByText("Test Doc")).toBeTruthy()
    })
  })
})
