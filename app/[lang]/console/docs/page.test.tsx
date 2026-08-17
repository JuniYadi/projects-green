import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const listGet = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      docs: [
        {
          id: "doc-1",
          path: "/guides/getting-started",
          title: "Getting Started",
          updatedAt: "2026-01-01T00:00:00.000Z",
          isGlobal: true,
        },
      ],
    },
  })
)
const searchGet = mock(() =>
  Promise.resolve({
    data: {
      ok: true,
      docs: [],
    },
  })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      knowledge: {
        docs: {
          console: {
            list: { get: listGet },
            search: { get: searchGet },
          },
        },
      },
    },
  },
}))

const { default: DocsPage } = await import("./page")

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DocsPage />
    </QueryClientProvider>
  )
}

describe("DocsPage", () => {
  beforeEach(() => {
    listGet.mockResolvedValue({
      data: {
        ok: true,
        docs: [
          {
            id: "doc-1",
            path: "/guides/getting-started",
            title: "Getting Started",
            updatedAt: "2026-01-01T00:00:00.000Z",
            isGlobal: true,
          },
        ],
      },
    })
    searchGet.mockResolvedValue({
      data: {
        ok: true,
        docs: [],
      },
    })
  })

  afterEach(() => {
    listGet.mockClear()
    searchGet.mockClear()
  })

  it("shows loading skeletons initially", () => {
    listGet.mockImplementationOnce(() => new Promise(() => {}))

    const view = renderPage()

    expect(
      view.container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("renders documentation cards after the list resolves", async () => {
    const view = renderPage()

    await waitFor(() => {
      expect(view.getByText("Getting Started")).toBeInTheDocument()
      expect(view.getByText("/guides/getting-started")).toBeInTheDocument()
    })
    expect(listGet).toHaveBeenCalled()
  })

  it("shows the empty state when no documentation is available", async () => {
    listGet.mockResolvedValueOnce({
      data: {
        ok: true,
        docs: [],
      },
    })

    const view = renderPage()

    await waitFor(() => {
      expect(view.getByText("No documentation available.")).toBeInTheDocument()
    })
  })

  it("searches documentation after the input debounce", async () => {
    const user = userEvent.setup()
    const view = renderPage()
    const input = view.getByPlaceholderText("Search documentation...")

    await user.type(input, "guide")

    await waitFor(() => {
      expect(searchGet).toHaveBeenCalledWith({ $query: { q: "guide" } })
    })
  })
})
