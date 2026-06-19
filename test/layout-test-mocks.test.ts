import { describe, expect, it, mock } from "bun:test"

import { createAuthMock, createNavigationMock } from "@/test/layout-test-mocks"

describe("layout test mocks", () => {
  it("builds navigation mock with router helpers", () => {
    const redirect = mock(() => {})
    const navigation = createNavigationMock({
      pathname: "/id/console",
      redirect,
    })

    expect(navigation.usePathname()).toBe("/id/console")
    expect(navigation.useSearchParams()).toBeInstanceOf(URLSearchParams)

    const router = navigation.useRouter()
    expect(typeof router.replace).toBe("function")
    expect(typeof router.push).toBe("function")
    expect(typeof router.refresh).toBe("function")

    navigation.redirect("/id/portal")
    expect(redirect).toHaveBeenCalledWith("/id/portal")
  })

  it("builds auth mock with WorkOS facade", async () => {
    const withAuth = mock(async () => ({ user: "ok" }))
    const getUser = mock(async () => ({ id: "user_1" }))
    const getOrganization = mock(async () => ({ id: "org_1" }))

    const auth = createAuthMock({ withAuth, getUser, getOrganization })
    const workos = auth.getWorkOS()

    expect(await auth.withAuth()).toEqual({ user: "ok" })
    expect(await workos.userManagement.getUser("user_1")).toEqual({
      id: "user_1",
    })
    expect(await workos.organizations.getOrganization("org_1")).toEqual({
      id: "org_1",
    })
  })
})
