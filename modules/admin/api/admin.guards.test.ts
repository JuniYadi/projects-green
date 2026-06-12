import { describe, expect, it, mock, beforeEach } from "bun:test"

type MockAuthValue = {
  user: { id: string; email: string } | null
}

let mockAuthValue: MockAuthValue = { user: null }
let mockPlatformRole: string | null = null

const mockWithAuth = mock(async () => mockAuthValue)
const mockGetPlatformRoleForUser = mock(async () =>
  mockPlatformRole === "SUPER_ADMIN" ? "super_admin" : "none"
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
  getWorkOS: () => ({
    organizations: {},
    userManagement: {},
  }),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRoleForUser,
}))

describe("adminGuards", () => {
  beforeEach(() => {
    mockAuthValue = { user: null }
    mockPlatformRole = null
    mockWithAuth.mockClear()
    mockGetPlatformRoleForUser.mockClear()
  })

  it("toUnauthorizedError sets status to 401", async () => {
    const { toUnauthorizedError } = await import("./admin.guards")
    const set: { status?: number } = {}
    const result = toUnauthorizedError(set)

    expect(set.status).toBe(401)
    expect(result).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    })
  })

  it("toForbiddenError sets status to 403", async () => {
    const { toForbiddenError } = await import("./admin.guards")
    const set: { status?: number } = {}
    const result = toForbiddenError(set)

    expect(set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      policyCode: "SUPER_ADMIN_REQUIRED",
      message: "This action requires super admin access.",
    })
  })

  describe("getAdminActorContext", () => {
    it("returns AdminActorContext when authenticated", async () => {
      mockAuthValue = { user: { id: "user_1", email: "admin@test.com" } }
      mockPlatformRole = "SUPER_ADMIN"

      const { getAdminActorContext } = await import("./admin.guards")
      const result = await getAdminActorContext()

      expect(result).toEqual({
        userId: "user_1",
        platformRole: "super_admin",
      })
    })

    it("returns null when not authenticated", async () => {
      mockAuthValue = { user: null }

      const { getAdminActorContext } = await import("./admin.guards")
      const result = await getAdminActorContext()

      expect(result).toBeNull()
    })
  })

  describe("requireSuperAdmin", () => {
    it("returns actor for super_admin", async () => {
      mockAuthValue = { user: { id: "user_1", email: "admin@test.com" } }
      mockPlatformRole = "SUPER_ADMIN"

      const { requireSuperAdmin } = await import("./admin.guards")
      const set: { status?: number } = {}
      const result = await requireSuperAdmin(set)

      expect(result).toEqual({
        userId: "user_1",
        platformRole: "super_admin",
      })
      expect(set.status).toBeUndefined()
    })

    it("returns UnauthorizedError when no auth", async () => {
      mockAuthValue = { user: null }

      const { requireSuperAdmin } = await import("./admin.guards")
      const set: { status?: number } = {}
      const result = await requireSuperAdmin(set)

      expect(set.status).toBe(401)
      expect(result).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "You must be signed in to perform this action.",
      })
    })

    it("returns ForbiddenError when not super_admin", async () => {
      mockAuthValue = { user: { id: "user_1", email: "admin@test.com" } }
      mockPlatformRole = "ORG_ADMIN"

      const { requireSuperAdmin } = await import("./admin.guards")
      const set: { status?: number } = {}
      const result = await requireSuperAdmin(set)

      expect(set.status).toBe(403)
      expect(result).toEqual({
        ok: false,
        error: "FORBIDDEN",
        policyCode: "SUPER_ADMIN_REQUIRED",
        message: "This action requires super admin access.",
      })
    })
  })
})
