import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import React from "react"

const mockSwitchToOrganization = mock(async () => {})
const mockReplace = mock(() => {})
const mockRefresh = mock(() => {})
let mockPathname = "/en/console/organization"
let mockSearchParams = new URLSearchParams("tab=members")

mock.module("@workos-inc/authkit-nextjs/components", () => {
  return {
    useAuth: () => ({
      switchToOrganization: mockSwitchToOrganization,
    }),
  }
})

mock.module("next/navigation", () => {
  return {
    useRouter: () => ({
      replace: mockReplace,
      refresh: mockRefresh,
    }),
    useParams: () => ({ lang: "en" }),
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
  }
})

const { cleanup, fireEvent, render, waitFor } =
  await import("@testing-library/react")
const { NavOrganization } = await import("@/components/nav-organization")
const { SidebarProvider } = await import("@/components/ui/sidebar")
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query")
const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

describe("NavOrganization", () => {
  let queryClient: QueryClient

  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    mockSwitchToOrganization.mockClear()
    mockReplace.mockClear()
    mockRefresh.mockClear()
    mockPathname = "/en/console/organization"
    mockSearchParams = new URLSearchParams("tab=members")

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString()

      if (path.includes("/api/tenants/bootstrap")) {
        return jsonResponse({
          ok: true,
          currentOrganizationId: "org_1",
          memberships: [
            {
              organizationId: "org_1",
              organizationName: "Acme Alpha",
              status: "active",
              roleSlug: "user_owner",
            },
            {
              organizationId: "org_2",
              organizationName: "Acme Beta",
              status: "active",
              roleSlug: "user_admin",
            },
          ],
        })
      }

      if (path.includes("/api/tenants/organizations/create")) {
        return jsonResponse({
          ok: true,
          organizationId: "org_new",
        })
      }

      return jsonResponse({ ok: true })
    }) as typeof fetch
  })

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>{ui}</SidebarProvider>
      </QueryClientProvider>
    )
  }

  it("renders active organization and lists switch targets", async () => {
    const view = renderWithProviders(
      <NavOrganization
        organization={{
          id: "org_1",
          name: "Acme Alpha",
        }}
      />
    )

    await waitFor(() => {
      expect(view.getByRole("button")).toBeDefined()
    })
    fireEvent.pointerDown(view.getByRole("button"))

    await waitFor(() => {
      expect(view.getAllByText("Acme Alpha").length).toBeGreaterThan(0)
      expect(view.getByText("Acme Beta")).toBeTruthy()
      expect(view.getByText("Active")).toBeTruthy()
    })
  })
})
