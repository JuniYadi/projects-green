import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

import { NavOrganization } from "@/components/nav-organization"
import { SidebarProvider } from "@/components/ui/sidebar"

const mockSwitchToOrganization = mock(async () => {})
const mockReplace = mock(() => {})
const mockRefresh = mock(() => {})
const originalFetch = globalThis.fetch
let mockPathname = "/en/console/organization"
let mockSearchParams = new URLSearchParams("tab=members")

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

mock.module("@workos-inc/authkit-nextjs/components", () => {
  return {
    useAuth: () => ({
      switchToOrganization: mockSwitchToOrganization,
    }),
  }
})

mock.module("next/navigation", () => {
  return {
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({
      replace: mockReplace,
      refresh: mockRefresh,
    }),
  }
})

mock.module("next/navigation.js", () => {
  return {
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({
      replace: mockReplace,
      refresh: mockRefresh,
    }),
  }
})

describe("NavOrganization", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  beforeEach(() => {
    mockSwitchToOrganization.mockClear()
    mockReplace.mockClear()
    mockRefresh.mockClear()
    mockPathname = "/en/console/organization"
    mockSearchParams = new URLSearchParams("tab=members")
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname
            : input.url

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

      return jsonResponse({}, 404)
    }) as unknown as typeof fetch
  })

  it("renders active organization and lists switch targets", async () => {
    const view = render(
      <SidebarProvider>
        <NavOrganization
          organization={{
            id: "org_1",
            name: "Acme Alpha",
          }}
        />
      </SidebarProvider>
    )

    fireEvent.pointerDown(view.getByRole("button"))

    await waitFor(() => {
      expect(view.getAllByText("Acme Alpha").length).toBeGreaterThan(0)
      expect(view.getByText("Acme Beta")).toBeTruthy()
      expect(view.getByText("Active")).toBeTruthy()
    })
  })

  it("switches organization and preserves route query", async () => {
    const view = render(
      <SidebarProvider>
        <NavOrganization
          organization={{
            id: "org_1",
            name: "Acme Alpha",
          }}
        />
      </SidebarProvider>
    )

    fireEvent.pointerDown(view.getByRole("button"))
    fireEvent.click(await view.findByText("Acme Beta"))

    await waitFor(() => {
      expect(mockSwitchToOrganization).toHaveBeenCalledWith("org_2", {
        returnTo: "/en/console/organization?tab=members",
      })
      expect(mockReplace).toHaveBeenCalledWith(
        "/en/console/organization?tab=members"
      )
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it("shows switch error when switching fails", async () => {
    mockSwitchToOrganization.mockImplementation(async () => {
      throw new Error("switch failed")
    })
    const view = render(
      <SidebarProvider>
        <NavOrganization
          organization={{
            id: "org_1",
            name: "Acme Alpha",
          }}
        />
      </SidebarProvider>
    )

    fireEvent.pointerDown(view.getByRole("button"))
    fireEvent.click(await view.findByText("Acme Beta"))

    await waitFor(() => {
      expect(
        view.getByText("Unable to switch organization. Please try again.")
      ).toBeTruthy()
    })
  })

  it("creates organization and switches to it", async () => {
    const view = render(
      <SidebarProvider>
        <NavOrganization
          organization={{
            id: "org_1",
            name: "Acme Alpha",
          }}
        />
      </SidebarProvider>
    )

    fireEvent.pointerDown(view.getByRole("button"))
    fireEvent.click(await view.findByText("Create organization"))

    const nameInput = await view.findByLabelText("Organization name")
    fireEvent.change(nameInput, { target: { value: "Acme New" } })

    const submitButton = await view.findByRole("button", {
      name: "Create organization",
    })
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement)

    await waitFor(() => {
      const fetchCalls = (
        globalThis.fetch as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls
      const hasCreateCall = fetchCalls.some((call) => {
        const input = call[0] as string | URL | { url?: string } | undefined
        const path =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.pathname
              : (input?.url ?? "")
        return path.includes("/api/tenants/organizations/create")
      })
      expect(hasCreateCall).toBe(true)
      expect(mockSwitchToOrganization).toHaveBeenCalledWith("org_new", {
        returnTo: "/en/console/organization?tab=members",
      })
    })
  })

  it("shows create error when name is blank", async () => {
    const view = render(
      <SidebarProvider>
        <NavOrganization
          organization={{
            id: "org_1",
            name: "Acme Alpha",
          }}
        />
      </SidebarProvider>
    )

    fireEvent.pointerDown(view.getByRole("button"))
    fireEvent.click(await view.findByText("Create organization"))

    const nameInput = await view.findByLabelText("Organization name")
    fireEvent.change(nameInput, { target: { value: "   " } })

    const submitButton = await view.findByRole("button", {
      name: "Create organization",
    })
    expect(submitButton.hasAttribute("disabled")).toBe(true)
  })

  it("shows create API error message", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname
            : input.url

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
          ],
        })
      }

      if (path.includes("/api/tenants/organizations/create")) {
        return jsonResponse(
          {
            ok: false,
            error: "CREATOR_ROLE_MISSING",
            message: "Creator role missing.",
          },
          422
        )
      }

      return jsonResponse({}, 404)
    }) as unknown as typeof fetch

    const view = render(
      <SidebarProvider>
        <NavOrganization
          organization={{
            id: "org_1",
            name: "Acme Alpha",
          }}
        />
      </SidebarProvider>
    )

    fireEvent.pointerDown(view.getByRole("button"))
    fireEvent.click(await view.findByText("Create organization"))

    const nameInput = await view.findByLabelText("Organization name")
    fireEvent.change(nameInput, { target: { value: "Acme New" } })

    const submitButton = await view.findByRole("button", {
      name: "Create organization",
    })
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(view.getByText("Creator role missing.")).toBeTruthy()
    })
  })

  it("includes organization members and settings links", async () => {
    const view = render(
      <SidebarProvider>
        <NavOrganization
          organization={{
            id: "org_1",
            name: "Acme Alpha",
          }}
        />
      </SidebarProvider>
    )

    fireEvent.pointerDown(view.getByRole("button"))

    const members = await view.findByText("Organization members")
    const settings = await view.findByText("Organization settings")

    expect(members.closest("a")?.getAttribute("href")).toBe(
      "/en/console/organization"
    )
    expect(settings.closest("a")?.getAttribute("href")).toBe(
      "/en/console/organization"
    )
  })
})
