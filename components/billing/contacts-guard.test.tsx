import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Override next/navigation with a richer mock that exposes mutable state.
// The global setup registers a static mock() that returns ""; we need
// mockReturnValue + per-test state to drive the guard's behavior.
const mockState = {
  pathname: "/en/console/billing",
  replace: mock(),
}

mock.module("next/navigation", () => ({
  useRouter: mock(() => ({ replace: mockState.replace })),
  usePathname: mock(() => mockState.pathname),
  useSearchParams: mock(() => new URLSearchParams()),
  useParams: mock(() => ({})),
  redirect: mock(),
  notFound: mock(),
}))

const { ContactsGuard } = await import("@/components/billing/contacts-guard")

describe("ContactsGuard", () => {
  beforeEach(() => {
    mockState.pathname = "/en/console/billing"
    mockState.replace.mockReset()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders a loading skeleton instead of blank space while checking", async () => {
    // Pending fetch — guard stays in 'checking' state
    globalThis.fetch = mock(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        })
    ) as unknown as typeof fetch

    const view = render(
      <ContactsGuard>
        <div>children content</div>
      </ContactsGuard>
    )

    expect(view.getByTestId("contacts-guard-loading")).toBeInTheDocument()
    expect(view.getByTestId("contacts-guard-loading")).toHaveAttribute(
      "aria-busy",
      "true"
    )
    expect(view.queryByText("children content")).not.toBeInTheDocument()
  })

  it("skips the check and renders children when already on /contacts", async () => {
    mockState.pathname = "/en/console/billing/contacts"
    let fetchCalled = false
    globalThis.fetch = mock(() => {
      fetchCalled = true
      return Promise.resolve(jsonResponse({ ok: true, count: 0 }))
    }) as unknown as typeof fetch

    const view = render(
      <ContactsGuard>
        <div>children content</div>
      </ContactsGuard>
    )

    await waitFor(() =>
      expect(view.getByText("children content")).toBeInTheDocument()
    )
    expect(fetchCalled).toBe(false)
    expect(mockState.replace).not.toHaveBeenCalled()
  })

  it("renders children when contacts count > 0 (no redirect)", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/auth/platform-role")) {
        return jsonResponse({ role: "none" })
      }
      if (url.includes("/api/billing/contacts/count")) {
        return jsonResponse({ ok: true, count: 2 })
      }
      return jsonResponse({ ok: false }, 500)
    }) as unknown as typeof fetch

    const view = render(
      <ContactsGuard>
        <div>children content</div>
      </ContactsGuard>
    )

    await waitFor(() =>
      expect(view.getByText("children content")).toBeInTheDocument()
    )
    expect(mockState.replace).not.toHaveBeenCalled()
  })

  it("redirects to /contacts when count is 0 and is non-super-admin", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/auth/platform-role")) {
        return jsonResponse({ role: "none" })
      }
      if (url.includes("/api/billing/contacts/count")) {
        return jsonResponse({ ok: true, count: 0 })
      }
      return jsonResponse({ ok: false }, 500)
    }) as unknown as typeof fetch

    const view = render(
      <ContactsGuard>
        <div>children content</div>
      </ContactsGuard>
    )

    await waitFor(() =>
      expect(mockState.replace).toHaveBeenCalledWith(
        "/en/console/billing/contacts"
      )
    )
    // Still renders the skeleton (not blank) while the redirect is in flight
    expect(view.getByTestId("contacts-guard-loading")).toBeInTheDocument()
  })

  it("skips redirect for super_admin and renders children", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/auth/platform-role")) {
        return jsonResponse({ role: "super_admin" })
      }
      if (url.includes("/api/billing/contacts/count")) {
        return jsonResponse({ ok: true, count: 0 })
      }
      return jsonResponse({ ok: false }, 500)
    }) as unknown as typeof fetch

    const view = render(
      <ContactsGuard>
        <div>children content</div>
      </ContactsGuard>
    )

    await waitFor(() =>
      expect(view.getByText("children content")).toBeInTheDocument()
    )
    expect(mockState.replace).not.toHaveBeenCalled()
  })

  it("fails open and renders children when the count API errors", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/auth/platform-role")) {
        return jsonResponse({ role: "none" })
      }
      if (url.includes("/api/billing/contacts/count")) {
        return new Response("boom", { status: 500 })
      }
      return new Response("boom", { status: 500 })
    }) as unknown as typeof fetch

    const view = render(
      <ContactsGuard>
        <div>children content</div>
      </ContactsGuard>
    )

    await waitFor(() =>
      expect(view.getByText("children content")).toBeInTheDocument()
    )
    expect(mockState.replace).not.toHaveBeenCalled()
  })
})
