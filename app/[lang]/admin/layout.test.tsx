import { beforeEach, describe, expect, it, mock } from "bun:test"
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
    profilePictureUrl: "https://example.com/avatar.png",
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

const mockGetPlatformRoleForUser = mock(
  async (): Promise<"super_admin" | "admin" | "member" | "none"> =>
    "super_admin"
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

const mockUsePathname = mock(() => "/en/admin")

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
  usePathname: mockUsePathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: mock(() => {}), refresh: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/platform-role", () => {
  return {
    getPlatformRoleForUser: mockGetPlatformRoleForUser,
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
    SidebarProvider: ({
      children,
      defaultOpen,
    }: {
      children: React.ReactNode
      defaultOpen?: boolean
    }) => (
      <div
        data-testid="sidebar-provider"
        data-default-open={String(defaultOpen)}
      >
        {children}
      </div>
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
    BreadcrumbLink: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
    BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
    BreadcrumbSeparator: () => <span>/</span>,
  }
})

mock.module("@/modules/docs/ui/thunder-ai-help-drawer", () => ({
  ThunderAiHelpDrawer: () => <div data-testid="thunder-ai-help" />,
}))

describe("AdminLayout", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockGetUser.mockClear()
    mockGetOrganization.mockClear()
    mockRedirect.mockClear()
    mockGetPlatformRoleForUser.mockClear()
    mockGetPlatformRoleForUser.mockResolvedValue("super_admin")
    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_123",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        profilePictureUrl: "https://example.com/avatar.png",
      },
      organizationId: "org_123",
    }))
    mockUsePathname.mockReturnValue("/en/admin")
  })

  it("renders shared admin shell around children with defaultOpen true", async () => {
    const layoutModule = await import("@/app/[lang]/admin/layout")
    const ui = await layoutModule.default({
      children: <div>Admin Content</div>,
      params: Promise.resolve({ lang: "en" }),
    })

    const view = render(ui)

    expect(mockWithAuth).toHaveBeenCalledWith({ ensureSignedIn: true })
    expect(view.getByTestId("sidebar-provider")).toHaveAttribute(
      "data-default-open",
      "true"
    )
    expect(view.getByText("Admin Content")).toBeInTheDocument()
  })

  it("redirects non-super_admin users to console", async () => {
    mockGetPlatformRoleForUser.mockResolvedValue("none")

    const layoutModule = await import("@/app/[lang]/admin/layout")
    await expect(
      layoutModule.default({
        children: <div>Admin Content</div>,
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/console")
  })

  it("redirects to onboarding when organization is missing", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: {
        id: "user_123",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        profilePictureUrl: "https://example.com/avatar.png",
      },
      organizationId: undefined,
    }))

    const layoutModule = await import("@/app/[lang]/admin/layout")
    await expect(
      layoutModule.default({
        children: <div>Admin Content</div>,
        params: Promise.resolve({ lang: "en" }),
      })
    ).rejects.toThrow("REDIRECT:/en/onboarding/organization?next=%2Fen%2Fadmin")
  })
})
