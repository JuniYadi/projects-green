import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import * as React from "react"

import { PortalOrgFilterCombobox } from "./portal-org-filter-combobox"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

describe("PortalOrgFilterCombobox", () => {
  beforeEach(() => {
    mock.restore()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  it("renders loading state while fetching organizations", async () => {
    let resolvePromise: (value: Response) => void
    globalThis.fetch = mock(
      () =>
        new Promise<Response>((resolve) => {
          resolvePromise = resolve
        })
    ) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox />)
    const trigger = view.getByRole("combobox")
    expect(trigger.getAttribute("aria-busy")).toBe("true")

    await act(async () => {
      fireEvent.click(trigger)
    })
    expect(view.getByText("Loading organizations...")).toBeInTheDocument()

    await act(async () => {
      resolvePromise!(
        jsonResponse({
          ok: true,
          data: { organizations: [] },
        })
      )
    })

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })
  })

  it("renders empty state when no organizations are found", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: { organizations: [] },
      })
    ) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })

    expect(view.getByText("No organizations found.")).toBeInTheDocument()
  })

  it("renders organization list from API response", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: {
          organizations: [
            { id: "org-1", name: "Alpha Corporation" },
            { id: "org-2", name: "Beta Technologies" },
          ],
        },
      })
    ) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })

    expect(view.getByText("Alpha Corporation")).toBeInTheDocument()
    expect(view.getByText("Beta Technologies")).toBeInTheDocument()
    expect(
      view.getByRole("option", { name: "All Organizations" })
    ).toBeInTheDocument()
  })

  it("calls onChange with the selected organizationId", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: {
          organizations: [
            { id: "org-1", name: "Alpha Corporation" },
            { id: "org-2", name: "Beta Technologies" },
          ],
        },
      })
    ) as unknown as typeof fetch

    const onChange = mock()
    const view = render(<PortalOrgFilterCombobox onChange={onChange} />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })
    await act(async () => {
      fireEvent.click(view.getByText("Beta Technologies"))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("org-2")
  })

  it("calls onChange(null) when selecting 'All Organizations'", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: {
          organizations: [{ id: "org-1", name: "Alpha Corporation" }],
        },
      })
    ) as unknown as typeof fetch

    const onChange = mock()
    const view = render(
      <PortalOrgFilterCombobox value="org-1" onChange={onChange} />
    )
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    expect(view.getByText("Alpha Corporation")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(trigger)
    })
    await act(async () => {
      fireEvent.click(view.getByRole("option", { name: "All Organizations" }))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("supports search filtering by organization name or id", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: {
          organizations: [
            { id: "org-apple", name: "Apple Inc" },
            { id: "org-banana", name: "Banana Labs" },
          ],
        },
      })
    ) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })
    const searchInput = view.getByPlaceholderText("Search organization...")

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "apple" } })
    })

    expect(view.getByText("Apple Inc")).toBeInTheDocument()
    expect(view.queryByText("Banana Labs")).toBeNull()

    // Search by ID
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "org-banana" } })
    })
    expect(view.getByText("Banana Labs")).toBeInTheDocument()
    expect(view.queryByText("Apple Inc")).toBeNull()

    // Search not matching anything
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "nonexistent" } })
    })
    expect(view.getByText("No organizations found.")).toBeInTheDocument()
  })

  it("supports keyboard navigation with ArrowDown and Enter", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: {
          organizations: [
            { id: "org-1", name: "Org First" },
            { id: "org-2", name: "Org Second" },
          ],
        },
      })
    ) as unknown as typeof fetch

    const onChange = mock()
    const view = render(<PortalOrgFilterCombobox onChange={onChange} />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })
    const searchInput = view.getByPlaceholderText("Search organization...")

    // Arrow down moves: 0 ("All Organizations") -> 1 ("Org First")
    await act(async () => {
      fireEvent.keyDown(searchInput, { key: "ArrowDown" })
    })
    await act(async () => {
      fireEvent.keyDown(searchInput, { key: "ArrowDown" })
    })
    await act(async () => {
      fireEvent.keyDown(searchInput, { key: "Enter" })
    })

    expect(onChange).toHaveBeenCalledWith("org-1")
  })

  it("calls onChange(null) when clicking the clear icon on the trigger button", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: {
          organizations: [{ id: "org-1", name: "Selected Org" }],
        },
      })
    ) as unknown as typeof fetch

    const onChange = mock()
    const view = render(
      <PortalOrgFilterCombobox value="org-1" onChange={onChange} />
    )

    await waitFor(() => {
      expect(view.getByText("Selected Org")).toBeInTheDocument()
    })

    const clearBtn = view.getByLabelText("Clear filter")
    await act(async () => {
      fireEvent.click(clearBtn)
    })

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("handles custom allLabel and placeholder props", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: { organizations: [] },
      })
    ) as unknown as typeof fetch

    let view: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <PortalOrgFilterCombobox
          allLabel="Semua Organisasi"
          placeholder="Filter berdasarkan organisasi"
        />
      )
    })

    expect(view!.getByText("Filter berdasarkan organisasi")).toBeInTheDocument()
  })

  it("respects the disabled prop", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: { organizations: [] },
      })
    ) as unknown as typeof fetch

    let view: ReturnType<typeof render>
    await act(async () => {
      view = render(<PortalOrgFilterCombobox disabled />)
    })
    const trigger = view!.getByRole("combobox")
    expect(trigger).toBeDisabled()
  })

  it("handles fetch error gracefully", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Network error")
    }) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })
    expect(view.getByText("No organizations found.")).toBeInTheDocument()
  })

  it("requests organizations with limit: 15 on initial load", async () => {
    let capturedUrl = ""
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      capturedUrl = typeof url === "string" ? url : url.toString()
      return jsonResponse({
        ok: true,
        data: { organizations: [] },
      })
    }) as unknown as typeof fetch

    render(<PortalOrgFilterCombobox />)

    await waitFor(() => {
      expect(capturedUrl).toContain("limit=15")
    })
  })

  it("triggers server-side debounced search when user types in search input", async () => {
    const urls: string[] = []
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      urls.push(urlStr)
      if (urlStr.includes("search=Acme")) {
        return jsonResponse({
          ok: true,
          data: {
            organizations: [
              { id: "org-acme-remote", name: "Acme Remote Corp" },
            ],
          },
        })
      }
      return jsonResponse({
        ok: true,
        data: {
          organizations: [{ id: "org-1", name: "Initial Org" }],
        },
      })
    }) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })

    const searchInput = view.getByPlaceholderText("Search organization...")
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "Acme" } })
    })

    await waitFor(
      () => {
        expect(urls.some((u) => u.includes("search=Acme"))).toBe(true)
        expect(view.getByText("Acme Remote Corp")).toBeInTheDocument()
      },
      { timeout: 1500 }
    )
  })

  it("resolves organization name when value is not in initial batch", async () => {
    const urls: string[] = []
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      urls.push(urlStr)
      if (urlStr.includes("limit=1") && urlStr.includes("search=org-outside")) {
        return jsonResponse({
          ok: true,
          data: {
            organizations: [{ id: "org-outside", name: "Outside Batch Corp" }],
          },
        })
      }
      return jsonResponse({
        ok: true,
        data: {
          organizations: [
            { id: "org-1", name: "Alpha Corp" },
            { id: "org-2", name: "Beta Corp" },
          ],
        },
      })
    }) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox value="org-outside" />)

    await waitFor(() => {
      expect(
        urls.some(
          (u) => u.includes("limit=1") && u.includes("search=org-outside")
        )
      ).toBe(true)
    })

    await waitFor(() => {
      expect(view.getByText("Outside Batch Corp")).toBeInTheDocument()
    })
  })

  it("displays subtle loading spinner while search is in progress", async () => {
    let resolveSearch: (val: Response) => void
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      if (urlStr.includes("search=Acme")) {
        return new Promise<Response>((resolve) => {
          resolveSearch = resolve
        })
      }
      return jsonResponse({
        ok: true,
        data: {
          organizations: [{ id: "org-1", name: "Alpha Corp" }],
        },
      })
    }) as unknown as typeof fetch

    const view = render(<PortalOrgFilterCombobox />)
    const trigger = view.getByRole("combobox")

    await waitFor(() => {
      expect(trigger.getAttribute("aria-busy")).toBe("false")
    })

    await act(async () => {
      fireEvent.click(trigger)
    })

    const searchInput = view.getByPlaceholderText("Search organization...")
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "Acme" } })
    })

    await waitFor(() => {
      expect(view.getByTestId("search-spinner")).toBeInTheDocument()
      expect(resolveSearch).toBeDefined()
    })

    await act(async () => {
      resolveSearch!(
        jsonResponse({
          ok: true,
          data: {
            organizations: [{ id: "org-acme", name: "Acme Corp" }],
          },
        })
      )
    })

    await waitFor(() => {
      expect(view.queryByTestId("search-spinner")).toBeNull()
      expect(view.getByText("Acme Corp")).toBeInTheDocument()
    })
  })
})
