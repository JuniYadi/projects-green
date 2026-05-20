import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

const mockRouterReplace = mock(() => {})
const mockRouterRefresh = mock(() => {})

mock.module("next/navigation", () => {
  return {
    useRouter: () => ({
      replace: mockRouterReplace,
      refresh: mockRouterRefresh,
    }),
    usePathname: () => "/console/organization",
    useSearchParams: () => new URLSearchParams(),
  }
})

const loadOrganizationAdminSurface = async () => {
  const surfaceModule =
    await import("@/modules/tenants/ui/organization-admin-surface")
  return surfaceModule.OrganizationAdminSurface
}

type FetchMockConfig = {
  auth: {
    effectiveGlobalRole: "none" | "super_admin"
    effectiveTenantRole: "owner" | "admin" | "member" | null
    allowedActions: string[]
  }
  members?: Array<{
    id: string
    organizationId: string
    userId: string
    displayName: string
    email: string | null
    avatarUrl: string | null
    status: string
    role: "owner" | "admin" | "member" | null
    roleSlug: string | null
    createdAt: string
    updatedAt: string
  }>
  invitations?: Array<{
    id: string
    email: string
    state: string
    organizationId: string | null
    inviterUserId: string | null
    acceptedUserId: string | null
    roleSlug: string | null
    createdAt: string
    expiresAt: string
  }>
  organization?: {
    id: string
    name: string
    allowProfilesOutsideOrganization: boolean
    createdAt: string
    updatedAt: string
  }
  onPost?: (url: string, body: unknown) => void
}

type MockMember = NonNullable<FetchMockConfig["members"]>[number]

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

const mockTenantFetch = (config: FetchMockConfig) => {
  const requests: Array<{ url: string; method: string; body: unknown }> = []

  globalThis.fetch = mock(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      const body = init?.body ? JSON.parse(String(init.body)) : null

      requests.push({ url, method, body })

      if (method === "GET" && url.endsWith("/authorization")) {
        return jsonResponse({
          ok: true,
          orgId: "org_123",
          effectiveGlobalRole: config.auth.effectiveGlobalRole,
          effectiveTenantRole: config.auth.effectiveTenantRole,
          allowedActions: config.auth.allowedActions,
        })
      }

      if (method === "GET" && url.endsWith("/members")) {
        return jsonResponse({
          ok: true,
          orgId: "org_123",
          members: config.members ?? [],
        })
      }

      if (method === "GET" && url.endsWith("/invitations")) {
        return jsonResponse({
          ok: true,
          orgId: "org_123",
          invitations: config.invitations ?? [],
        })
      }

      if (method === "GET" && url.endsWith("/organization")) {
        return jsonResponse({
          ok: true,
          orgId: "org_123",
          organization: config.organization ?? {
            id: "org_123",
            name: "Acme Org",
            allowProfilesOutsideOrganization: false,
            createdAt: "2026-05-17T00:00:00.000Z",
            updatedAt: "2026-05-17T00:00:00.000Z",
          },
        })
      }

      if (method === "POST") {
        config.onPost?.(url, body)

        return jsonResponse({ ok: true })
      }

      return jsonResponse(
        {
          ok: false,
          error: "NOT_IMPLEMENTED",
          message: `Unhandled request: ${method} ${url}`,
        },
        500
      )
    }
  ) as unknown as typeof fetch

  return requests
}

const makeMember = (overrides: Partial<MockMember> = {}): MockMember => {
  return {
    id: "m_1",
    organizationId: "org_123",
    userId: "member@example.com",
    displayName: "Member One",
    email: "member@example.com",
    avatarUrl: null,
    status: "active",
    role: "member",
    roleSlug: "user_member",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  mockRouterReplace.mockClear()
  mockRouterRefresh.mockClear()
  window.confirm = () => true
})

describe("OrganizationAdminSurface", () => {
  it("renders member permissions matrix with restricted invitation actions", async () => {
    const OrganizationAdminSurface = await loadOrganizationAdminSurface()

    mockTenantFetch({
      auth: {
        effectiveGlobalRole: "none",
        effectiveTenantRole: "member",
        allowedActions: [],
      },
    })

    const view = render(<OrganizationAdminSurface organizationId="org_123" />)

    await waitFor(() => {
      expect(view.getByText("Organization Administration")).toBeTruthy()
    })

    expect(
      view.getByText(
        "You do not have permission to manage members in this organization."
      )
    ).toBeTruthy()

    fireEvent.click(view.getByRole("button", { name: "Invitations" }))

    await waitFor(() => {
      expect(
        view.getByText("You do not have permission to send invitations.")
      ).toBeTruthy()
    })

    const inviteButton = view.getByRole("button", { name: "Invite" })
    expect(inviteButton.hasAttribute("disabled")).toBe(true)
  })

  it("requires destructive confirmation before ownership transfer", async () => {
    const OrganizationAdminSurface = await loadOrganizationAdminSurface()

    const requests = mockTenantFetch({
      auth: {
        effectiveGlobalRole: "none",
        effectiveTenantRole: "owner",
        allowedActions: [
          "manage_tenant",
          "transfer_ownership",
          "promote_member",
        ],
      },
      members: [
        makeMember({
          avatarUrl: "https://example.com/member.png",
        }),
      ],
      invitations: [],
    })

    const confirmMock = mock(() => false)
    window.confirm = confirmMock

    const view = render(<OrganizationAdminSurface organizationId="org_123" />)

    await waitFor(() => {
      expect(view.getByText("Member One")).toBeInTheDocument()
    })

    fireEvent.click(view.getByRole("button", { name: "Transfer Ownership" }))

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(
      requests.some(
        (request) =>
          request.method === "POST" &&
          request.url.includes("/ownership/transfer")
      )
    ).toBe(false)
  })

  it("shows action feedback after successful member promotion", async () => {
    const OrganizationAdminSurface = await loadOrganizationAdminSurface()

    const requests = mockTenantFetch({
      auth: {
        effectiveGlobalRole: "none",
        effectiveTenantRole: "owner",
        allowedActions: ["manage_tenant", "promote_member"],
      },
      members: [makeMember()],
      invitations: [],
    })

    const view = render(<OrganizationAdminSurface organizationId="org_123" />)

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "Promote to Admin" })
      ).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Promote to Admin" }))

    await waitFor(() => {
      expect(view.getByText("Member promoted to admin.")).toBeTruthy()
    })

    expect(
      requests.some(
        (request) =>
          request.method === "POST" &&
          request.url.includes("/members/m_1/promote")
      )
    ).toBe(true)
  })

  it("filters members with search and role/status selectors, then resets", async () => {
    const OrganizationAdminSurface = await loadOrganizationAdminSurface()

    mockTenantFetch({
      auth: {
        effectiveGlobalRole: "none",
        effectiveTenantRole: "owner",
        allowedActions: ["manage_tenant"],
      },
      members: [
        makeMember({
          id: "m_owner_active",
          userId: "owner.user",
          displayName: "Owner Active",
          email: "owner@example.com",
          role: "owner",
          roleSlug: "user_owner",
          status: "active",
        }),
        makeMember({
          id: "m_admin_pending",
          userId: "admin.user",
          displayName: "Admin Pending",
          email: "admin@example.com",
          role: "admin",
          roleSlug: "user_admin",
          status: "pending",
        }),
        makeMember({
          id: "m_member_inactive",
          userId: "member.user",
          displayName: "Member Inactive",
          email: null,
          role: "member",
          roleSlug: "user_member",
          status: "inactive",
        }),
      ],
      invitations: [],
    })

    const view = render(<OrganizationAdminSurface organizationId="org_123" />)

    await waitFor(() => {
      expect(view.getByText("Owner Active")).toBeInTheDocument()
    })

    const resetButton = view.getByRole("button", { name: "Reset" })
    expect(resetButton.hasAttribute("disabled")).toBe(true)
    expect(view.getByText("Showing 3 of 3 members.")).toBeInTheDocument()

    fireEvent.change(view.getByLabelText("Filter by role"), {
      target: { value: "owner" },
    })
    await waitFor(() => {
      expect(view.getByText("Showing 1 of 3 members.")).toBeInTheDocument()
    })
    expect(resetButton.hasAttribute("disabled")).toBe(false)

    fireEvent.change(view.getByLabelText("Filter by status"), {
      target: { value: "inactive" },
    })

    await waitFor(() => {
      expect(
        view.getByText("No members match the current search and filters.")
      ).toBeInTheDocument()
    })

    fireEvent.click(
      view.getByRole("button", { name: "Clear search and filters" })
    )

    await waitFor(() => {
      expect(view.getByText("Owner Active")).toBeInTheDocument()
    })

    expect(view.getByText("Admin Pending")).toBeInTheDocument()
    expect(view.getByText("Member Inactive")).toBeInTheDocument()
    expect(
      (view.getByLabelText("Search members") as HTMLInputElement).value
    ).toBe("")
    expect(view.getByText("Showing 3 of 3 members.")).toBeInTheDocument()
  })

  it("keeps member actions working for filtered results", async () => {
    const OrganizationAdminSurface = await loadOrganizationAdminSurface()

    const requests = mockTenantFetch({
      auth: {
        effectiveGlobalRole: "none",
        effectiveTenantRole: "owner",
        allowedActions: ["manage_tenant", "promote_member"],
      },
      members: [
        makeMember({
          id: "m_1",
          displayName: "First Member",
          email: "first@example.com",
          status: "inactive",
        }),
        makeMember({
          id: "m_2",
          displayName: "Second Member",
          email: "second@example.com",
          status: "active",
        }),
      ],
      invitations: [],
    })

    const view = render(<OrganizationAdminSurface organizationId="org_123" />)

    await waitFor(() => {
      expect(view.getByText("First Member")).toBeInTheDocument()
    })

    fireEvent.change(view.getByLabelText("Filter by status"), {
      target: { value: "active" },
    })

    await waitFor(() => {
      expect(view.queryByText("First Member")).toBeNull()
    })

    fireEvent.click(view.getByRole("button", { name: "Promote to Admin" }))

    await waitFor(() => {
      expect(view.getByText("Member promoted to admin.")).toBeInTheDocument()
    })

    expect(
      requests.some(
        (request) =>
          request.method === "POST" &&
          request.url.includes("/members/m_2/promote")
      )
    ).toBe(true)
  })

  it("uses the same outer layout classes for loading and loaded states", async () => {
    const OrganizationAdminSurface = await loadOrganizationAdminSurface()

    const expectedClasses = ["space-y-6", "p-6", "pt-0"]

    // Render the component — initially in loading state
    mockTenantFetch({
      auth: {
        effectiveGlobalRole: "none",
        effectiveTenantRole: "owner",
        allowedActions: ["manage_tenant"],
      },
      members: [],
      invitations: [],
    })

    const view = render(<OrganizationAdminSurface organizationId="org_123" />)

    // Loading state: the root wrapper should have the expected classes
    const loadingWrapper = view.container.firstElementChild as HTMLElement
    for (const cls of expectedClasses) {
      expect(loadingWrapper.classList.contains(cls)).toBe(true)
    }

    // Wait for loaded state
    await waitFor(() => {
      expect(view.getByText("Organization Administration")).toBeTruthy()
    })

    // Loaded state: the root wrapper should have the same classes
    const loadedWrapper = view.container.firstElementChild as HTMLElement
    for (const cls of expectedClasses) {
      expect(loadedWrapper.classList.contains(cls)).toBe(true)
    }
  })
})
