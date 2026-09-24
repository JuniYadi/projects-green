import { beforeEach, afterAll, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"

import { createAuthMock } from "@/test/layout-test-mocks"

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

const mockWithAuth = mock(async (): Promise<MockAuthPayload> => ({
  user: {
    id: "user_123",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    profilePictureUrl: " https://example.com/avatar.png ",
  },
  organizationId: "org_123",
}))

const mockGetUser = mock(async (_userId?: string) => ({
  id: "user_123",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  profilePictureUrl: "https://example.com/latest-avatar.png",
}))

const mockGetOrganization = mock(async (_orgId?: string) => ({
  id: "org_123",
  name: "Acme Inc",
}))

const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
mock.module("next/headers", () => ({
  headers: mock(async () => new Headers()),
  cookies: mock(async () => ({
    get: mock(() => undefined),
  })),
}))
const mockGetPlatformAccessForUser = mock(
  async (): Promise<import("@/lib/platform-role").PlatformAccess> => ({
    exists: true,
    role: "super_admin",
  })
)

mock.module("@workos-inc/authkit-nextjs", () => {
  return createAuthMock({
    withAuth: mockWithAuth,
    getUser: mockGetUser,
    getOrganization: mockGetOrganization,
  })
})

mock.module("@/lib/workos-directory", () => ({
  getCachedUser: mock(async (id: string) => {
    await mockGetUser(id)
    return {
      id: "user_123",
      name: "Jane Doe",
      email: "jane@example.com",
      avatarUrl: "https://example.com/latest-avatar.png",
    }
  }),
  getCachedOrganization: mock(async (id: string) => {
    await mockGetOrganization(id)
    return {
      id: "org_123",
      name: "Acme Inc",
    }
  }),
}))

const mockUsePathname = mock(() => "/en/portal/documentations")

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
  usePathname: mockUsePathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: mock(() => {}), refresh: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

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
    SIDEBAR_COOKIE_NAME: "sidebar_state",
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

describe("PortalLayout", () => {
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
      exists: true,
      role: "super_admin",
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
    mockUsePathname.mockReturnValue("/en/portal/documentations")
  })

  it("renders shared portal shell around children", async () => {
    const layoutModule = await import("@/app/[lang]/portal/layout")
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
      view.getByText("Sidebar:portal:Jane Doe:Acme Inc")
    ).toBeInTheDocument()
    expect(view.getByText("Ask P")).toBeInTheDocument()
    expect(view.getByText("Portal")).toBeInTheDocument()
    expect(view.getByText("Documentation")).toBeInTheDocument()
    expect(view.queryByText("Workspace")).not.toBeInTheDocument()
    expect(view.getByText("Child Content")).toBeInTheDocument()
  })

  it("redirects customer users to console", async () => {
    mockGetPlatformAccessForUser.mockResolvedValue({
      exists: false,
      role: "none",
    })

    const layoutModule = await import("@/app/[lang]/portal/layout")

    await expect(
      layoutModule.default({
        children: <div>Child Content</div>,
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/console")

    expect(mockGetPlatformAccessForUser).toHaveBeenCalledWith({
      id: "user_123",
      email: "jane@example.com",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/en/console")
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

    const layoutModule = await import("@/app/[lang]/portal/layout")

    await expect(
      layoutModule.default({
        children: <div>Child Content</div>,
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow(
      "REDIRECT:/en/onboarding/organization?next=%2Fen%2Fportal"
    )

    expect(mockRedirect).toHaveBeenCalledWith(
      "/en/onboarding/organization?next=%2Fen%2Fportal"
    )
  })
})
