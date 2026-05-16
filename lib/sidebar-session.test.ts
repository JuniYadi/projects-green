import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { User } from "@workos-inc/node"

const mockGetUser = mock(async () => ({
  id: "user_1",
  firstName: "Refreshed",
  lastName: "User",
  email: "refreshed@example.com",
  profilePictureUrl: "https://example.com/avatar.png",
}))

const mockGetOrganization = mock(async () => ({
  id: "org_1",
  name: "  Acme Org  ",
}))

mock.module("@workos-inc/authkit-nextjs", () => {
  return {
    withAuth: async () => ({
      user: null,
      organizationId: null,
    }),
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

const makeUser = (overrides: Partial<User> = {}): User => {
  return {
    object: "user",
    id: "user_1",
    email: "user@example.com",
    firstName: "Jane",
    lastName: "Doe",
    profilePictureUrl: " https://example.com/jane.png ",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    ...overrides,
  } as User
}

describe("sidebar session helpers", () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockGetOrganization.mockReset()

    mockGetUser.mockImplementation(async () => ({
      id: "user_1",
      firstName: "Refreshed",
      lastName: "User",
      email: "refreshed@example.com",
      profilePictureUrl: "https://example.com/avatar.png",
    }))

    mockGetOrganization.mockImplementation(async () => ({
      id: "org_1",
      name: "  Acme Org  ",
    }))
  })

  it("resolves sidebar user identity from names and trims avatar", async () => {
    const { resolveSidebarUser } = await import("@/lib/sidebar-session")

    const result = resolveSidebarUser(makeUser())

    expect(result).toEqual({
      name: "Jane Doe",
      email: "user@example.com",
      avatarUrl: "https://example.com/jane.png",
    })
  })

  it("falls back to email local part and default name", async () => {
    const { resolveSidebarUser } = await import("@/lib/sidebar-session")

    const fromEmail = resolveSidebarUser(
      makeUser({
        firstName: "   ",
        lastName: "",
        email: "  person+tag@example.com ",
        profilePictureUrl: " ",
      })
    )

    const fromDefault = resolveSidebarUser(
      makeUser({
        firstName: undefined,
        lastName: undefined,
        email: "",
        profilePictureUrl: null,
      })
    )

    expect(fromEmail.name).toBe("person+tag")
    expect(fromEmail.avatarUrl).toBeNull()
    expect(fromDefault.name).toBe("User")
  })

  it("returns fresh WorkOS user when fetch succeeds", async () => {
    const { getLatestWorkOSUser } = await import("@/lib/sidebar-session")

    const result = await getLatestWorkOSUser(makeUser({ id: "user_55" }))

    expect(mockGetUser).toHaveBeenCalledWith("user_55")
    expect(result.firstName).toBe("Refreshed")
  })

  it("returns existing user and logs warning when user refresh fails", async () => {
    const { getLatestWorkOSUser } = await import("@/lib/sidebar-session")
    const warn = mock(() => {})
    const originalWarn = console.warn

    mockGetUser.mockImplementation(async () => {
      throw new Error("network down")
    })
    console.warn = warn as unknown as typeof console.warn

    const fallbackUser = makeUser({ id: "user_fallback" })
    const result = await getLatestWorkOSUser(fallbackUser)

    console.warn = originalWarn

    expect(result).toBe(fallbackUser)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("returns null organization details when id is missing", async () => {
    const { resolveSidebarOrganization } = await import("@/lib/sidebar-session")

    const result = await resolveSidebarOrganization(undefined)

    expect(result).toEqual({
      id: null,
      name: null,
    })
    expect(mockGetOrganization).not.toHaveBeenCalled()
  })

  it("returns trimmed organization name and fallback null on error", async () => {
    const { resolveSidebarOrganization } = await import("@/lib/sidebar-session")
    const warn = mock(() => {})
    const originalWarn = console.warn

    const success = await resolveSidebarOrganization("org_1")

    mockGetOrganization.mockImplementation(async () => {
      throw new Error("service unavailable")
    })
    console.warn = warn as unknown as typeof console.warn

    const fallback = await resolveSidebarOrganization("org_2")

    console.warn = originalWarn

    expect(success).toEqual({
      id: "org_1",
      name: "Acme Org",
    })
    expect(fallback).toEqual({
      id: "org_2",
      name: null,
    })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
