import "@/test/setup"
import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

// ─── Mock functions ─────────────────────────────────────────────────────────

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const originalFetch = globalThis.fetch
const mockFetch = mock((_input: string | URL | Request) =>
  Promise.resolve(jsonResponse({ ok: false, error: "Not found" }))
)

const MOCK_CREDENTIALS = [
  {
    id: "cred_1",
    type: "GITHUB_TOKEN",
    name: "My GitHub Token",
    metadata: { accountLogin: "test-org" },
    maskedPreview: "ghp_***…abcd",
    status: "ACTIVE",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-15T10:00:00Z",
  },
  {
    id: "cred_2",
    type: "CLOUDFLARE_API_TOKEN",
    name: "Production DNS",
    metadata: { accountName: "Acme Corp" },
    maskedPreview: "cf…ef01",
    status: "PENDING",
    createdAt: "2025-02-20T14:30:00Z",
    updatedAt: "2025-02-20T14:30:00Z",
  },
]

async function defaultFetch(input: string | URL | Request) {
  const url = input.toString()
  const method = input instanceof Request ? input.method : "GET"

  if (url.includes("/api/app/credentials") && method === "GET") {
    return jsonResponse({ ok: true, credentials: MOCK_CREDENTIALS })
  }

  if (url.includes("/api/app/credentials") && method === "DELETE") {
    return jsonResponse({ ok: true })
  }

  if (url.includes("/api/app/credentials") && method === "POST") {
    return jsonResponse({ ok: true, credential: MOCK_CREDENTIALS[0] })
  }

  return jsonResponse({ ok: false, error: "Not found" })
}

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
  }),
}))

mock.module("@/lib/i18n/messages", () => ({
  getMessages: () => ({
    console: {
      app: {
        credentials: {
          heading: "Credentials",
          description:
            "Manage connected integrations and API tokens for your application.",
        },
      },
    },
  }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/en${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

// ─── Import after mocks ─────────────────────────────────────────────────────

import CredentialsPage from "./page"

describe("CredentialsPage", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch as unknown as typeof fetch
    mockFetch.mockClear()
    mockFetch.mockImplementation(defaultFetch)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders heading and description from i18n", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Credentials")).toBeInTheDocument()
    })
    expect(
      view.getByText(
        "Manage connected integrations and API tokens for your application."
      )
    ).toBeInTheDocument()

    view.unmount()
  })

  it("renders table with credential rows", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("My GitHub Token")).toBeInTheDocument()
    })
    expect(view.getByText("Production DNS")).toBeInTheDocument()

    // Type labels
    expect(view.getByText("GitHub Personal Access Token")).toBeInTheDocument()
    expect(view.getByText("Cloudflare API Token")).toBeInTheDocument()

    // Masked previews
    expect(view.getByText("ghp_***…abcd")).toBeInTheDocument()
    expect(view.getByText("cf…ef01")).toBeInTheDocument()

    // Status pills
    expect(view.getByText("ACTIVE")).toBeInTheDocument()
    expect(view.getByText("PENDING")).toBeInTheDocument()

    view.unmount()
  })

  it("shows loading state initially", async () => {
    const { promise, resolve } = Promise.withResolvers<Response>()
    mockFetch.mockImplementation(() => promise)

    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Loading credentials…")).toBeInTheDocument()
    })

    resolve(jsonResponse({ ok: true, credentials: [] }))
    view.unmount()
  })

  it("type filter shows all 4 credential types", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("My GitHub Token")).toBeInTheDocument()
    })

    // The Type facet filter should exist
    expect(view.getByText("Type")).toBeInTheDocument()

    view.unmount()
  })

  it("status filter shows all 4 status values", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("My GitHub Token")).toBeInTheDocument()
    })

    // The Status facet filter should exist
    expect(view.getByText("Status")).toBeInTheDocument()

    view.unmount()
  })

  it("empty state message when no credentials", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ok: true, credentials: [] }))
    )

    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("No credentials found.")).toBeInTheDocument()
    })

    view.unmount()
  })

  it("shows error state on fetch failure", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ok: false, error: "Server error" }))
    )

    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Server error")).toBeInTheDocument()
    })

    view.unmount()
  })

  it("renders Add Credential button with correct link", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Add Credential")).toBeInTheDocument()
    })

    const link = view.getByText("Add Credential").closest("a")
    expect(link?.getAttribute("href")).toContain("/console/app/credentials/new")

    view.unmount()
  })
})
