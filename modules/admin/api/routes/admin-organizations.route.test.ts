/**
 * Admin Organizations — API Routes Tests
 */

import { describe, it, expect, mock } from "bun:test"
import { Elysia } from "elysia"

const mockListOrganizations = mock<(...args: unknown[]) => unknown>(async () => ({
  organizations: [
    {
      id: "org_1",
      name: "Acme Corp",
      externalId: "acme-123",
      allowProfilesOutsideOrganization: false,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
    {
      id: "org_2",
      name: "Globex Inc",
      externalId: null,
      allowProfilesOutsideOrganization: true,
      createdAt: "2025-01-02T00:00:00.000Z",
      updatedAt: "2025-01-02T00:00:00.000Z",
    },
  ],
  listMetadata: undefined,
}))

mock.module("@/modules/admin/admin.service", () => ({
  listAdminOrganizations: mockListOrganizations,
  createAdminOrganization: mockCreateAdminOrganization,
  listAdminOrganizationMembers: mockListAdminOrganizationMembers,
}))

const mockCreateAdminOrganization = mock<(...args: unknown[]) => unknown>(async () => ({
  id: "new_org_1",
  name: "New Org",
  domains: [],
  externalId: null,
  allowProfilesOutsideOrganization: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
}))

const mockListAdminOrganizationMembers = mock<(...args: unknown[]) => unknown>(async () => ({
  data: [{ id: "user-1", email: "user@example.com" }],
}))

const mockRequireSuperAdmin = mock<(...args: unknown[]) => unknown>(async (set: unknown) => {
  ;(set as { status?: number | string }).status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to perform this action.",
  }
})

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
  getAdminActorContext: mock<() => Promise<null>>(async () => null),
  toUnauthorizedError: (set: { status?: number | string }) => {
    set.status = 401
    return { ok: false as const, error: "UNAUTHORIZED", message: "You must be signed in" }
  },
  toForbiddenError: (set: { status?: number | string }) => {
    set.status = 403
    return { ok: false as const, error: "FORBIDDEN", policyCode: "SUPER_ADMIN_REQUIRED", message: "Forbidden" }
  },
}))

const { createAdminOrganizationsRoutes } = await import(
  "@/modules/admin/api/routes/admin-organizations.route"
)

const BASE = "http://localhost/admin/organizations"

describe("Admin Organizations Routes", () => {
  describe("GET /admin/organizations", () => {
    it("returns 200 with list of organizations when guard allows", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))
      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      const res = await app.handle(new Request(`${BASE}/`, { method: "GET" }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.organizations).toHaveLength(2)
      expect(body.data.organizations[0].id).toBe("org_1")
      expect(body.data.organizations[0].name).toBe("Acme Corp")
    })

    it("returns 401 when guard returns unauthorized", async () => {
      const app = new Elysia().use(createAdminOrganizationsRoutes())
      const res = await app.handle(new Request(`${BASE}/`, { method: "GET" }))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when guard returns forbidden", async () => {
      const forbiddenGuard = mock<(...args: unknown[]) => unknown>(async (set: unknown) => {
        ;(set as { status?: number | string }).status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          policyCode: "SUPER_ADMIN_REQUIRED" as const,
          message: "This action requires super admin access.",
        }
      })
      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: forbiddenGuard })
      )
      const res = await app.handle(new Request(`${BASE}/`, { method: "GET" }))
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
      expect(body.policyCode).toBe("SUPER_ADMIN_REQUIRED")
    })

    it("calls listAdminOrganizations on success", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))
      mockListOrganizations.mockClear()
      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      await app.handle(new Request(`${BASE}/`, { method: "GET" }))

      expect(mockListOrganizations).toHaveBeenCalled()
    })
  })

  describe("POST /admin/organizations", () => {
    it("returns 401 when guard returns unauthorized", async () => {
      const app = new Elysia().use(createAdminOrganizationsRoutes())
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Org" }),
        })
      )

      expect(res.status).toBe(401)
    })

    it("returns 403 when guard returns forbidden on POST", async () => {
      const forbiddenGuard = mock<(...args: unknown[]) => unknown>(async (set: unknown) => {
        ;(set as { status?: number | string }).status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          policyCode: "SUPER_ADMIN_REQUIRED" as const,
          message: "Forbidden",
        }
      })
      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: forbiddenGuard })
      )
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Org" }),
        })
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 201 with created organization on valid POST", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))

      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Org" }),
        })
      )

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.organization.id).toBe("new_org_1")
      expect(body.organization.name).toBe("New Org")
    })

    it("returns WorkOS error when createAdminOrganization throws", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))
      mockCreateAdminOrganization.mockRejectedValueOnce(new Error("WORKOS_ERROR"))

      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      const res = await app.handle(
        new Request(`${BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Org" }),
        })
      )

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.ok).toBe(false)
    })
  })

  describe("GET /admin/organizations/:id/members", () => {
    it("returns 401 when guard returns unauthorized", async () => {
      const app = new Elysia().use(createAdminOrganizationsRoutes())
      const res = await app.handle(new Request(`${BASE}/org_1/members`, { method: "GET" }))

      expect(res.status).toBe(401)
    })

    it("returns 200 with members list when guard allows", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))

      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      const res = await app.handle(new Request(`${BASE}/org_1/members`, { method: "GET" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.data).toHaveLength(1)
      expect(body.data.data[0].id).toBe("user-1")
    })

    it("returns WorkOS error when listAdminOrganizationMembers throws", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))
      mockListAdminOrganizationMembers.mockRejectedValueOnce(new Error("WORKOS_ERROR"))

      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      const res = await app.handle(new Request(`${BASE}/org_1/members`, { method: "GET" }))

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.ok).toBe(false)
    })
  })

  describe("GET /admin/organizations — search filter", () => {
    it("filters organizations by search query", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))

      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      const res = await app.handle(new Request(`${BASE}/?search=acme`, { method: "GET" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      // Only Acme Corp should match "acme"
      expect(body.data.organizations).toHaveLength(1)
      expect(body.data.organizations[0].id).toBe("org_1")
    })

    it("returns WorkOS error when listAdminOrganizations throws", async () => {
      const allowedGuard = mock<() => Promise<{ userId: string; platformRole: "super_admin" }>>(async () => ({
        userId: "admin-1",
        platformRole: "super_admin" as const,
      }))
      mockListOrganizations.mockRejectedValueOnce(new Error("WORKOS_TIMEOUT"))

      const app = new Elysia().use(
        createAdminOrganizationsRoutes({ requireSuperAdmin: allowedGuard })
      )
      const res = await app.handle(new Request(`${BASE}/`, { method: "GET" }))

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.ok).toBe(false)
    })
  })
})
