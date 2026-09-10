import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

import {
  requireScopedTenantAdmin,
  scopedTenantAdminGuard,
} from "./admin.guards"

type MockAuthValue = {
  user: { id: string; email: string } | null
  organizationId?: string | null
  role?: string | null
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
        ok: true,
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
        ok: true,
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

  describe("adminAuthGuard plugin", () => {
    const createTestApp = async () => {
      const { adminAuthGuard } = await import("./admin.guards")
      return new Elysia()
        .use(adminAuthGuard)
        .get("/admin/test", () => ({ ok: true, message: "handler ran" }))
    }

    it("returns 401 when unauthenticated", async () => {
      mockAuthValue = { user: null }

      const app = await createTestApp()
      const res = await app.handle(new Request("http://localhost/admin/test"))

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when authenticated but not super_admin", async () => {
      mockAuthValue = { user: { id: "user_1", email: "org@test.com" } }
      mockPlatformRole = "ORG_ADMIN"

      const app = await createTestApp()
      const res = await app.handle(new Request("http://localhost/admin/test"))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("allows request through when super_admin", async () => {
      mockAuthValue = { user: { id: "user_1", email: "admin@test.com" } }
      mockPlatformRole = "SUPER_ADMIN"

      const app = await createTestApp()
      const res = await app.handle(new Request("http://localhost/admin/test"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.message).toBe("handler ran")
    })

    it("does not affect routes on a separate app without the plugin", async () => {
      mockAuthValue = { user: null }

      const app = new Elysia().get("/public", () => ({
        ok: true,
        public: true,
      }))

      const res = await app.handle(new Request("http://localhost/public"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.public).toBe(true)
    })
  })

  describe("requireScopedTenantAdmin", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthValue = { user: null }
      const set: { status?: number } = {}
      const result = await requireScopedTenantAdmin(set)
      expect(set.status).toBe(401)
      expect(result.ok).toBe(false)
    })

    it("allows super_admin unconditionally without org context", async () => {
      mockAuthValue = { user: { id: "u_super", email: "super@test.com" } }
      mockPlatformRole = "SUPER_ADMIN"
      const set: { status?: number } = {}
      const result = await requireScopedTenantAdmin(set)
      expect(result.ok).toBe(true)
      expect(result.isSuperAdmin).toBe(true)
    })

    it("allows super_admin with requested targetOrgId", async () => {
      mockAuthValue = { user: { id: "u_super", email: "super@test.com" } }
      mockPlatformRole = "SUPER_ADMIN"
      const set: { status?: number } = {}
      const result = await requireScopedTenantAdmin(set, {
        targetOrgId: "org_any",
      })
      expect(result.ok).toBe(true)
      expect(result.organizationId).toBe("org_any")
    })

    it("returns 403 when non-super_admin lacks organizationId", async () => {
      mockAuthValue = {
        user: { id: "u_tenant", email: "tenant@test.com" },
        role: "admin",
      }
      mockPlatformRole = "NONE"
      const set: { status?: number } = {}
      const result = await requireScopedTenantAdmin(set)
      expect(set.status).toBe(403)
      expect(result.ok).toBe(false)
      expect(result.policyCode).toBe("ORGANIZATION_CONTEXT_REQUIRED")
    })

    it("returns 403 when non-super_admin has member role", async () => {
      mockAuthValue = {
        user: { id: "u_tenant", email: "tenant@test.com" },
        organizationId: "org_1",
        role: "member",
      }
      mockPlatformRole = "NONE"
      const set: { status?: number } = {}
      const result = await requireScopedTenantAdmin(set)
      expect(set.status).toBe(403)
      expect(result.ok).toBe(false)
      expect(result.policyCode).toBe("ADMIN_ROLE_REQUIRED")
    })

    it("allows tenant admin within their own organization", async () => {
      mockAuthValue = {
        user: { id: "u_tenant", email: "tenant@test.com" },
        organizationId: "org_1",
        role: "admin",
      }
      mockPlatformRole = "NONE"
      const set: { status?: number } = {}
      const result = await requireScopedTenantAdmin(set, {
        targetOrgId: "org_1",
      })
      expect(result.ok).toBe(true)
      expect(result.isSuperAdmin).toBe(false)
      expect(result.organizationId).toBe("org_1")
    })

    it("blocks tenant admin when targetOrgId differs from session organizationId", async () => {
      mockAuthValue = {
        user: { id: "u_tenant", email: "tenant@test.com" },
        organizationId: "org_1",
        role: "admin",
      }
      mockPlatformRole = "NONE"
      const set: { status?: number } = {}
      const result = await requireScopedTenantAdmin(set, {
        targetOrgId: "org_victim",
      })
      expect(set.status).toBe(403)
      expect(result.ok).toBe(false)
      expect(result.policyCode).toBe("CROSS_TENANT_ACCESS_DENIED")
    })

    it("scopedTenantAdminGuard plugin rejects unauthorized callers", async () => {
      mockAuthValue = { user: null }
      const app = new Elysia()
        .use(scopedTenantAdminGuard)
        .get("/admin/scoped", () => ({ ok: true }))
      const res = await app.handle(new Request("http://localhost/admin/scoped"))
      expect(res.status).toBe(401)
    })
  })
})
