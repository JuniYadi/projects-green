import { afterEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"

type DocResponse = {
  ok: boolean
  path?: string
  title?: string
  purpose?: string
  howTo?: string[]
  notes?: string[]
  updatedAt?: string
  message?: string
}

const docsGet = mock(
  async (): Promise<{ data: DocResponse }> => ({
    data: {
      ok: true,
      path: "/getting-started",
      title: "Getting Started",
      purpose: "Learn how to get started.",
      howTo: ["Install the CLI", "Run the setup command"],
      notes: ["Keep your token secure."],
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  })
)
const pendingResponse = Promise.withResolvers<{ data: DocResponse }>()

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      knowledge: {
        docs: { get: docsGet },
      },
    },
  },
}))

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ slug: ["getting-started"] })),
}))

const { default: DocDetailPage } = await import("./page")

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <DocDetailPage />
    </QueryClientProvider>
  )
}

describe("DocDetailPage", () => {
  afterEach(() => {
    mock.clearAllMocks()
  })

  it("shows loading skeletons initially", () => {
    docsGet.mockImplementation(() => pendingResponse.promise)

    const view = renderPage()

    expect(
      view.container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("renders the document details and notes", async () => {
    docsGet.mockResolvedValue({
      data: {
        ok: true,
        path: "/getting-started",
        title: "Getting Started",
        purpose: "Learn how to get started.",
        howTo: ["Install the CLI", "Run the setup command"],
        notes: ["Keep your token secure."],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    })

    const view = renderPage()

    await waitFor(() => {
      expect(view.getByText("Getting Started")).toBeTruthy()
    })

    expect(view.getByText("/getting-started")).toBeTruthy()
    expect(view.getByText("Learn how to get started.")).toBeTruthy()
    expect(view.getByText("Install the CLI").closest("li")).toBeTruthy()
    expect(view.getByText("Run the setup command").closest("li")).toBeTruthy()
    expect(view.getByText("Keep your token secure.").closest("li")).toBeTruthy()
    expect(view.getByRole("heading", { name: "Notes" })).toBeTruthy()
    expect(docsGet).toHaveBeenCalledWith({
      $query: { path: "/getting-started" },
    })
  })

  it("omits the notes section when notes are absent", async () => {
    docsGet.mockResolvedValue({
      data: {
        ok: true,
        path: "/getting-started",
        title: "Getting Started",
        purpose: "Learn how to get started.",
        howTo: ["Install the CLI"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    })

    const view = renderPage()

    await waitFor(() => {
      expect(view.getByText("Getting Started")).toBeTruthy()
    })

    expect(view.queryByRole("heading", { name: "Notes" })).toBeNull()
  })

  it("shows the returned error and a link back to docs", async () => {
    docsGet.mockResolvedValue({
      data: { ok: false, message: "Documentation was not found." },
    })

    const view = renderPage()

    await waitFor(() => {
      expect(view.getByRole("alert")).toBeTruthy()
    })

    expect(view.getByText("Documentation was not found.")).toBeTruthy()
    expect(view.getByRole("link", { name: /Back to Docs/ })).toHaveAttribute(
      "href",
      "/console/docs"
    )
    expect(docsGet).toHaveBeenCalledWith({
      $query: { path: "/getting-started" },
    })
  })
})
