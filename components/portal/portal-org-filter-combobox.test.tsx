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
})
