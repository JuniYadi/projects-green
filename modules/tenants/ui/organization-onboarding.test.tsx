import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockRouterReplace = mock(() => {})
const mockRouterRefresh = mock(() => {})
const mockSwitchToOrganization = mock(async () => {})

mock.module("next/navigation", () => {
  return {
    useRouter: () => ({
      replace: mockRouterReplace,
      refresh: mockRouterRefresh,
    }),
  }
})

mock.module("@workos-inc/authkit-nextjs/components", () => {
  return {
    useAuth: () => ({
      switchToOrganization: mockSwitchToOrganization,
    }),
  }
})

const loadOrganizationOnboarding = async () => {
  const mod = await import("@/modules/tenants/ui/organization-onboarding")
  return mod.OrganizationOnboarding
}

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

beforeEach(() => {
  mockRouterReplace.mockClear()
  mockRouterRefresh.mockClear()
  mockSwitchToOrganization.mockClear()
})

describe("OrganizationOnboarding", () => {
  it("pre-fills organization name suggestion based on user email", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(
      <OrganizationOnboarding
        nextPath="/console"
        userEmail="john.doe@gmail.com"
      />
    )

    await waitFor(() => {
      const input = view.getByPlaceholderText("Organization name") as HTMLInputElement
      expect(input.value).toBe("John Doe Org's")
    })
  })

  it("pre-fills organization name suggestion for single name email", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(
      <OrganizationOnboarding
        nextPath="/console"
        userEmail="alex@company.com"
      />
    )

    await waitFor(() => {
      const input = view.getByPlaceholderText("Organization name") as HTMLInputElement
      expect(input.value).toBe("Alex Org's")
    })
  })

  it("does not pre-fill when email is missing", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      const input = view.getByPlaceholderText("Organization name") as HTMLInputElement
      expect(input.value).toBe("")
    })
  })

  it("hides 'Join existing organization' section by default if there are no memberships", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      // Wait for input to render and make sure the query doesn't find the section
      const input = view.getByPlaceholderText("Organization name")
      expect(input).toBeTruthy()
    })

    const joinHeader = view.queryByRole("heading", {
      name: "Join existing organization",
    })
    expect(joinHeader).toBeNull()
  })

  it("shows 'Join existing organization' section if there are active memberships", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({
        memberships: [
          {
            organizationId: "org_1",
            organizationName: "Test Org 1",
            status: "active",
            roleSlug: "member",
          },
        ],
      })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(view.getByText("Test Org 1")).toBeTruthy()
    })

    const joinHeader = view.getByRole("heading", {
      name: "Join existing organization",
    })
    expect(joinHeader).toBeTruthy()
  })

  it("shows 'Join existing organization' section if there are pending memberships", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({
        memberships: [
          {
            organizationId: "org_2",
            organizationName: "Test Org 2",
            status: "pending",
            roleSlug: null,
          },
        ],
      })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(
        view.getByText(
          "You have pending invitations. Accept an invitation first, then come back here to join."
        )
      ).toBeTruthy()
    })

    const joinHeader = view.getByRole("heading", {
      name: "Join existing organization",
    })
    expect(joinHeader).toBeTruthy()
  })

  it("renders default description when there are no memberships or invitations", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(view.getByText("Create your first organization to get started.")).toBeTruthy()
      expect(view.queryByText("Create your first organization or join one where you already have an active membership.")).toBeNull()
    })
  })

  it("renders extended description when there are memberships or invitations", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({
        memberships: [
          {
            organizationId: "org_1",
            organizationName: "Test Org 1",
            status: "active",
            roleSlug: "member",
          },
        ],
      })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(view.getByText("Create your first organization or join one where you already have an active membership.")).toBeTruthy()
      expect(view.queryByText("Create your first organization to get started.")).toBeNull()
    })
  })

  it("shows warning banner when showWarning is true", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" showWarning={true} />)

    await waitFor(() => {
      expect(view.getByText("Organization setup is required to access the console.")).toBeTruthy()
    })
  })

  it("hides warning banner when showWarning is false or omitted", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" showWarning={false} />)

    await waitFor(() => {
      expect(view.queryByText("Organization setup is required to access the console.")).toBeNull()
    })
  })
})
