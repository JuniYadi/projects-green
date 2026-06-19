import { beforeEach, afterAll, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { createAuthMock } from "@/test/layout-test-mocks"
import { redirect, usePathname } from "next/navigation"

type MockAuthPayload = {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    profilePictureUrl: string | null
  }
  organizationId: string | undefined
}

const mockWithAuth = mock(
  async (): Promise<MockAuthPayload> => ({
    user: {
      id: "user_123",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      profilePictureUrl: " https://example.com/avatar.png ",
    },
    organizationId: "org_123",
  })
)

const mockGetUser = mock(async () => ({
  id: "user_123",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  profilePictureUrl: "https://example.com/latest-avatar.png",
}))

const mockGetOrganization = mock(async () => ({
  id: "org_123",
  name: "Acme Inc",
}))

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

const mockGetPlatformAccessForUser = mock(
  async (): Promise<import("@/lib/platform-role").PlatformAccess> => ({
    exists: false,
    role: "none",
  })
)

mock.module("@workos-inc/authkit-nextjs", () => {
  return createAuthMock({
    withAuth: mockWithAuth,
    getUser: mockGetUser,
    getOrganization: mockGetOrganization,
  })
})

mock.module("@/lib/platform-role", () => {
  return {
    getPlatformAccessForUser: mockGetPlatformAccessForUser,
    getPlatformRoleForUser: mock(async () => "none" as const),
  }
})

mock.module("@/components/app-sidebar", () => {
  return {
    AppSidebar: ({
      surface,
      user,
      organization,
    }: {
      surface: string
      user: { name: string }
      organization: { name: string | null }
    }) => (
      <aside>
        Sidebar:{surface}:{user.name}:{organization.name ?? "none"}
      </aside>
    ),
  }
})

mock.module("@/components/ui/sidebar", () => {
  return {
    SidebarProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="sidebar-provider">{children}</div>
    ),
    SidebarInset: ({ children }: { children: React.ReactNode }) => (
      <main data-testid="sidebar-inset">{children}</main>
    ),
    SidebarTrigger: ({ className }: { className?: string }) => (
      <button className={className} type="button">
        Toggle
      </button>
    ),
  }
})

mock.module("@/components/ui/breadcrumb", () => {
  return {
    Breadcrumb: ({ children }: { children: React.ReactNode }) => (
      <nav>{children}</nav>
    ),
    BreadcrumbList: ({ children }: { children: React.ReactNode }) => (
      <ol>{children}</ol>
    ),
    BreadcrumbItem: ({ children }: { children: React.ReactNode }) => (
      <li>{children}</li>
    ),
    BreadcrumbLink: ({
      children,
      href,
    }: {
      children: React.ReactNode
      href: string
    }) => <a href={href}>{children}</a>,
    BreadcrumbSeparator: () => <span>/</span>,
    BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
  }
})

// No mock needed for ThunderAiHelpDrawer to avoid cache pollution

describe("ConsoleLayout", () => {
  afterAll(() => {
    mock.restore()
  })

  beforeEach(() => {
    mockWithAuth.mockClear()
    mockGetUser.mockClear()
    mockGetOrganization.mockClear()
    mockRedirect.mockClear()
    mockGetPlatformAccessForUser.mockClear()
    mockGetPlatformAccessForUser.mockResolvedValue({
      exists: false,
      role: "none",
    })
    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_123",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        profilePictureUrl: " https://example.com/avatar.png ",
      },
      organizationId: "org_123",
    }))
    ;(usePathname as unknown as ReturnType<typeof mock>).mockReturnValue(
      "/en/console"
    )
    ;(redirect as unknown as ReturnType<typeof mock>).mockImplementation(
      mockRedirect
    )
  })

  it("renders shared console shell around children", async () => {
    const layoutModule = await import("@/app/[lang]/console/layout")
    const ui = await layoutModule.default({
      children: <div>Child Content</div>,
      params: Promise.resolve({ lang: "en" }),
    })

    const view = render(ui)

    expect(mockWithAuth).toHaveBeenCalledWith({ ensureSignedIn: true })
    expect(mockGetUser).toHaveBeenCalledWith("user_123")
    expect(mockGetOrganization).toHaveBeenCalledWith("org_123")

    expect(view.getByTestId("sidebar-provider")).toBeInTheDocument()
    expect(
      view.getByText("Sidebar:console:Jane Doe:Acme Inc")
    ).toBeInTheDocument()
    expect(view.getByText("AI Help")).toBeInTheDocument()
    expect(view.getByText("Console")).toBeInTheDocument()
    expect(view.queryByText("Workspace")).not.toBeInTheDocument()
    expect(view.getByText("Child Content")).toBeInTheDocument()
  })

  it("redirects platform users to portal", async () => {
    mockGetPlatformAccessForUser.mockResolvedValue({
      exists: true,
      role: "super_admin",
    })

    const layoutModule = await import("@/app/[lang]/console/layout")

    await expect(
      layoutModule.default({
        children: <div>Child Content</div>,
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/portal")

    expect(mockGetPlatformAccessForUser).toHaveBeenCalledWith({
      id: "user_123",
      email: "jane@example.com",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/en/portal")
  })

  it("redirects to onboarding when organization is missing", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_999",
        firstName: "No",
        lastName: "Org",
        email: "no-org@example.com",
        profilePictureUrl: null,
      },
      organizationId: undefined,
    }))

    const layoutModule = await import("@/app/[lang]/console/layout")

    await expect(
      layoutModule.default({
        children: <div>Child Content</div>,
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow(
      "REDIRECT:/en/onboarding/organization?next=%2Fen%2Fconsole"
    )

    expect(mockRedirect).toHaveBeenCalledWith(
      "/en/onboarding/organization?next=%2Fen%2Fconsole"
    )
  })
})
