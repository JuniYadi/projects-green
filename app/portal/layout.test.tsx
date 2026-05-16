import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

const mockWithAuth = mock(async () => ({
  user: {
    id: "user_123",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    profilePictureUrl: " https://example.com/avatar.png ",
  },
  organizationId: "org_123",
}))

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

mock.module("@workos-inc/authkit-nextjs", () => {
  return {
    withAuth: mockWithAuth,
    getWorkOS: () => ({
      userManagement: {
        getUser: mockGetUser,
      },
      organizations: {
        getOrganization: mockGetOrganization,
      },
    }),
  }
})

mock.module("next/navigation", () => {
  return {
    redirect: mockRedirect,
    useRouter: () => ({
      replace: () => {},
      refresh: () => {},
    }),
    usePathname: () => "/portal/documentations",
    useSearchParams: () => new URLSearchParams(),
  }
})

mock.module("@/components/app-sidebar", () => {
  return {
    AppSidebar: ({ user, organization }: { user: { name: string }; organization: { name: string | null } }) => (
      <aside>
        Sidebar:{user.name}:{organization.name ?? "none"}
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
      <button
        className={className}
        type="button"
      >
        Toggle
      </button>
    ),
  }
})

mock.module("@/components/ui/breadcrumb", () => {
  return {
    Breadcrumb: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
    BreadcrumbList: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
    BreadcrumbItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
    BreadcrumbLink: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
    BreadcrumbSeparator: () => <span>/</span>,
    BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
  }
})

mock.module("@/components/ui/separator", () => {
  return {
    Separator: () => <hr />,
  }
})

mock.module("@/modules/docs/ui/dashboard-docs-drawer", () => {
  return {
    DashboardDocsDrawer: () => <div>Docs Drawer</div>,
  }
})

describe("PortalLayout", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockGetUser.mockClear()
    mockGetOrganization.mockClear()
    mockRedirect.mockClear()
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
  })

  it("renders shared portal shell around children", async () => {
    const layoutModule = await import("@/app/portal/layout")
    const ui = await layoutModule.default({
      children: <div>Child Content</div>,
    })

    const view = render(ui)

    expect(mockWithAuth).toHaveBeenCalledWith({ ensureSignedIn: true })
    expect(mockGetUser).toHaveBeenCalledWith("user_123")
    expect(mockGetOrganization).toHaveBeenCalledWith("org_123")

    expect(view.getByTestId("sidebar-provider")).toBeTruthy()
    expect(view.getByText("Sidebar:Jane Doe:Acme Inc")).toBeTruthy()
    expect(view.getByText("Docs Drawer")).toBeTruthy()
    expect(view.getByText("Documentation")).toBeTruthy()
    expect(view.getByText("Registry")).toBeTruthy()
    expect(view.getByText("Child Content")).toBeTruthy()
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

    const layoutModule = await import("@/app/portal/layout")

    await expect(
      layoutModule.default({ children: <div>Child Content</div> })
    ).rejects.toThrow(
      "REDIRECT:/onboarding/organization?next=%2Fportal"
    )

    expect(mockRedirect).toHaveBeenCalledWith(
      "/onboarding/organization?next=%2Fportal"
    )
  })
})
