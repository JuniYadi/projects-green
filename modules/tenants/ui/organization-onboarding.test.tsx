import { mock } from "bun:test"
import { useRouter, usePathname } from "next/navigation"

const mockRouterReplace = mock(() => {})
const mockRouterRefresh = mock(() => {})
const mockSwitchToOrganization = mock(async () => {})

mock.module("@workos-inc/authkit-nextjs/components", () => {
  return {
    useAuth: () => ({
      switchToOrganization: mockSwitchToOrganization,
    }),
  }
})

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

let cachedOrganizationOnboarding:
  | (typeof import("@/modules/tenants/ui/organization-onboarding"))["OrganizationOnboarding"]
  | null = null

const loadOrganizationOnboarding = async () => {
  if (!cachedOrganizationOnboarding) {
    const mod = await import("@/modules/tenants/ui/organization-onboarding")
    cachedOrganizationOnboarding = mod.OrganizationOnboarding
  }
  return cachedOrganizationOnboarding
}

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

const originalFetch = globalThis.fetch

// Track fetch calls
const createFetchMock = () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = []

  const mock = (
    handler: (
      url: string,
      method: string,
      body: unknown
    ) => Response | Promise<Response>
  ): void => {
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, method, body })
      return handler(url, method, body)
    }
    globalThis.fetch = fetchFn as unknown as typeof fetch
  }

  return { calls, mock }
}

beforeEach(() => {
  mockRouterReplace.mockClear()
  mockRouterRefresh.mockClear()
  mockSwitchToOrganization.mockClear()
  ;(useRouter as ReturnType<typeof mock>).mockReturnValue({
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
    push: () => {},
  })
  ;(usePathname as ReturnType<typeof mock>).mockReturnValue("/en/console")
})

afterEach(() => {
  globalThis.fetch = originalFetch
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
      const input = view.getByPlaceholderText(
        "Organization name"
      ) as HTMLInputElement
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
      const input = view.getByPlaceholderText(
        "Organization name"
      ) as HTMLInputElement
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
      const input = view.getByPlaceholderText(
        "Organization name"
      ) as HTMLInputElement
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
      expect(
        view.getByText("Create your first organization to get started.")
      ).toBeTruthy()
      expect(
        view.queryByText(
          "Create your first organization or join one where you already have an active membership."
        )
      ).toBeNull()
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
      expect(
        view.getByText(
          "Create your first organization or join one where you already have an active membership."
        )
      ).toBeTruthy()
      expect(
        view.queryByText("Create your first organization to get started.")
      ).toBeNull()
    })
  })

  it("shows warning banner when showWarning is true", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(
      <OrganizationOnboarding nextPath="/console" showWarning={true} />
    )

    await waitFor(() => {
      expect(
        view.getByText("Organization setup is required to access the console.")
      ).toBeTruthy()
    })
  })

  it("hides warning banner when showWarning is false or omitted", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    const view = render(
      <OrganizationOnboarding nextPath="/console" showWarning={false} />
    )

    await waitFor(() => {
      expect(
        view.queryByText(
          "Organization setup is required to access the console."
        )
      ).toBeNull()
    })
  })

  it("shows error when bootstrap API returns server error", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse(
        {
          ok: false,
          error: "BOOTSTRAP_FAILED",
          message: "Bootstrap unavailable.",
        },
        500
      )
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(view.getByText("Bootstrap unavailable.")).toBeTruthy()
    })
  })

  it("shows generic error when bootstrap API returns non-JSON response", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(
        view.getByText("Unable to load organization onboarding data.")
      ).toBeTruthy()
    })
  })

  it("shows network error when bootstrap fetch throws", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      throw new TypeError("Failed to fetch")
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(
        view.getByText("Network error while loading organization data.")
      ).toBeTruthy()
    })
  })

  it("calls handleSwitchOrganization when Join button is clicked", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({
        memberships: [
          {
            organizationId: "org_switch_1",
            organizationName: "Switch Org",
            status: "active",
            roleSlug: "admin",
          },
        ],
      })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/dashboard" />)

    await waitFor(() => {
      expect(view.getByText("Switch Org")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Join" }))

    await waitFor(() => {
      expect(mockSwitchToOrganization).toHaveBeenCalledWith("org_switch_1", {
        returnTo: "/dashboard",
      })
      expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard")
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1)
    })
  })

  it("shows error when switchToOrganization throws", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    mockSwitchToOrganization.mockRejectedValueOnce(new Error("Switch failed"))

    globalThis.fetch = mock(async () => {
      return jsonResponse({
        memberships: [
          {
            organizationId: "org_fail",
            organizationName: "Fail Org",
            status: "active",
            roleSlug: "member",
          },
        ],
      })
    }) as unknown as typeof fetch

    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(view.getByText("Fail Org")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Join" }))

    await waitFor(() => {
      expect(
        view.getByText("Unable to switch organization. Please try again.")
      ).toBeTruthy()
    })
  })

  it("shows empty name error when creating with blank name", async () => {
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    globalThis.fetch = mock(async () => {
      return jsonResponse({ memberships: [] })
    }) as unknown as typeof fetch

    // No userEmail -> no pre-fill -> name is empty string
    const view = render(<OrganizationOnboarding nextPath="/console" />)

    await waitFor(() => {
      expect(view.getByPlaceholderText("Organization name")).toBeTruthy()
    })

    // Submit with empty name
    fireEvent.click(view.getByRole("button", { name: "Create organization" }))

    await waitFor(() => {
      expect(view.getByText("Organization name is required.")).toBeTruthy()
    })
  })

  it("creates organization and switches on success", async () => {
    const { calls, mock: setupMock } = createFetchMock()
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    setupMock((url) => {
      if (url.includes("/create")) {
        return jsonResponse({
          ok: true,
          organizationId: "org_created_1",
        })
      }
      return jsonResponse({ memberships: [] })
    })

    const view = render(
      <OrganizationOnboarding nextPath="/console" userEmail="create@test.com" />
    )

    await waitFor(() => {
      expect(view.getByPlaceholderText("Organization name")).toBeTruthy()
    })

    // Submit with pre-filled name "Create Org's"
    fireEvent.click(view.getByRole("button", { name: "Create organization" }))

    await waitFor(() => {
      expect(mockSwitchToOrganization).toHaveBeenCalledWith("org_created_1", {
        returnTo: "/console",
      })
    })

    const createCall = calls.find((c) => c.url.includes("/create"))
    expect(createCall).toBeDefined()
    expect(createCall!.body).toEqual({ name: "Create Org's", currency: "IDR" })
  })

  it("shows error when create org API returns error", async () => {
    const { mock: setupMock } = createFetchMock()
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    setupMock((url) => {
      if (url.includes("/create")) {
        return jsonResponse(
          {
            ok: false,
            error: "CREATOR_ROLE_MISSING",
            message: "Required WorkOS role is missing.",
          },
          422
        )
      }
      return jsonResponse({ memberships: [] })
    })

    const view = render(
      <OrganizationOnboarding nextPath="/console" userEmail="fail@test.com" />
    )

    await waitFor(() => {
      expect(view.getByPlaceholderText("Organization name")).toBeTruthy()
    })

    // Submit with pre-filled name "Fail Org's"
    fireEvent.click(view.getByRole("button", { name: "Create organization" }))

    await waitFor(() => {
      expect(view.getByText("Required WorkOS role is missing.")).toBeTruthy()
    })
  })

  it("shows generic error when create org returns non-JSON response", async () => {
    const { mock: setupMock } = createFetchMock()
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    setupMock((url) => {
      if (url.includes("/create")) {
        return new Response("Service Unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        })
      }
      return jsonResponse({ memberships: [] })
    })

    const view = render(
      <OrganizationOnboarding nextPath="/console" userEmail="some@test.com" />
    )

    await waitFor(() => {
      expect(view.getByPlaceholderText("Organization name")).toBeTruthy()
    })

    // Submit with pre-filled name
    fireEvent.click(view.getByRole("button", { name: "Create organization" }))

    await waitFor(() => {
      expect(
        view.getByText("Unable to create organization right now.")
      ).toBeTruthy()
    })
  })

  it("shows network error when create org fetch throws", async () => {
    const { mock: setupMock } = createFetchMock()
    const OrganizationOnboarding = await loadOrganizationOnboarding()

    setupMock((url) => {
      if (url.includes("/create")) {
        throw new TypeError("Network failure")
      }
      return jsonResponse({ memberships: [] })
    })

    const view = render(
      <OrganizationOnboarding nextPath="/console" userEmail="net@test.com" />
    )

    await waitFor(() => {
      expect(view.getByPlaceholderText("Organization name")).toBeTruthy()
    })

    // Submit with pre-filled name "Net Org's"
    fireEvent.click(view.getByRole("button", { name: "Create organization" }))

    await waitFor(() => {
      expect(
        view.getByText("Network error while creating organization.")
      ).toBeTruthy()
    })
  })
})
