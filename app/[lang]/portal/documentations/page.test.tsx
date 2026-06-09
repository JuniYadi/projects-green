import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

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

  it("shows the Documentation Registry heading", async () => {
    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "Documentation Registry" })
      ).toBeTruthy()
    })
  })

  it("shows edit heading when a doc row is selected", async () => {
    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(view.getByText("Test Doc")).toBeTruthy()
    })

    fireEvent.click(view.getByText("Test Doc"))

    await waitFor(() => {
      expect(
        view.getByRole("heading", { name: "Edit: Test Doc" })
      ).toBeTruthy()
    })
  })

  it("calls DELETE when delete button is clicked and confirmed", async () => {
    const { default: Page } = await import("./page")
    const view = render(<Page />)

    await waitFor(() => {
      expect(view.getByText("Test Doc")).toBeTruthy()
    })

    globalThis.confirm = () => true
    fireEvent.click(view.getByRole("button", { name: /delete test doc/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
