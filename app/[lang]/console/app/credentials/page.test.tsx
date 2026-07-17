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

async function defaultFetch(input: string | URL | Request) {
  const url = input.toString()
  const method = input instanceof Request ? input.method : "GET"

  if (url.includes("/api/integrations/github/accounts")) {
    return jsonResponse({
      ok: true,
      accounts: [
        {
          id: "gh_1",
          accountLogin: "test-org",
          accountType: "Organization",
          targetType: "installations",
          installedAt: new Date().toISOString(),
        },
      ],
    })
  }

  if (url.includes("/api/integrations/cloudflare/dns-token")) {
    if (method === "DELETE") {
      return jsonResponse({ ok: true })
    }
    return jsonResponse({
      ok: true,
      credentials: [
        {
          id: "cf_1",
          name: "Production DNS",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          maskedToken: "cf...abcd",
        },
      ],
    })
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
          github: {
            heading: "GitHub",
            connect: "Connect GitHub",
            noAccounts:
              "No GitHub accounts connected. Connect one to enable repository deployments.",
            accountType: "Type",
            targetType: "Target",
            connected: "Connected",
            loading: "Loading accounts\u2026",
            loadError: "Failed to load accounts",
          },
          cloudflare: {
            heading: "Cloudflare DNS",
            name: "Name",
            namePlaceholder: "e.g. Primary DNS",
            apiToken: "API Token",
            apiTokenPlaceholder: "Cloudflare API token",
            save: "Save token",
            saving: "Saving\u2026",
            delete: "Delete",
            deleting: "Deleting\u2026",
            noCredentials: "No DNS tokens saved yet.",
            saved: "DNS token saved",
            deleted: "Token deleted",
            saveError: "Failed to save token",
            deleteError: "Failed to delete",
            loadError: "Failed to load credentials",
            networkError: "Network error",
            noOrganization: "No organization selected",
            loading: "Loading credentials\u2026",
          },
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

  it("renders GitHub section with connected account", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("test-org")).toBeInTheDocument()
    })
    expect(view.getByText("GitHub")).toBeInTheDocument()

    view.unmount()
  })

  it("renders Cloudflare section with credential", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Production DNS")).toBeInTheDocument()
    })
    expect(view.getByText("Cloudflare DNS")).toBeInTheDocument()

    view.unmount()
  })

  it("shows loading state initially", async () => {
    const { promise, resolve } = Promise.withResolvers<Response>()
    mockFetch.mockImplementation(() => promise)

    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Loading accounts\u2026")).toBeInTheDocument()
    })

    resolve(jsonResponse({ ok: true, accounts: [] }))
    view.unmount()
  })

  it("renders Connect GitHub button with correct link", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Connect GitHub")).toBeInTheDocument()
    })

    const link = view.getByText("Connect GitHub").closest("a")
    expect(link?.getAttribute("href")).toContain(
      "/api/integrations/github/install/start"
    )

    view.unmount()
  })

  it("renders Cloudflare form fields", async () => {
    const view = render(<CredentialsPage />)

    await waitFor(() => {
      expect(view.getByText("Save token")).toBeInTheDocument()
    })

    expect(view.getByLabelText("Name")).toBeDefined()
    expect(view.getByLabelText("API Token")).toBeDefined()

    view.unmount()
  })
})
