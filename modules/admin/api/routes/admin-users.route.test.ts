import { describe, it, expect, mock, beforeEach } from "bun:test"

mock.module("server-only", () => ({}))

import { Elysia } from "elysia"
import { NotFoundException } from "@workos-inc/node"
import type {
  AdminActorContext,
  AdminApiError,
} from "@/modules/admin/api/admin.guards"

const mockListAdminUsers = mock()
const mockGetAdminUser = mock()

mock.module("@/modules/admin/admin.service", () => ({
  createAdminOrganization: mock(),
  listAdminOrganizations: mock(),
  listAdminOrganizationMembers: mock(),
  sendAdminInvitation: mock(),
  listAdminInvitations: mock(),
  revokeAdminInvitation: mock(),
  listAdminUsers: mockListAdminUsers,
  getAdminUser: mockGetAdminUser,
}))

const { createAdminUsersRoutes } = await import("./admin-users.route")

const BASE = "http://localhost/admin/users"

describe("Admin Users Routes", () => {
  const allowedActor: AdminActorContext = {
    ok: true,
    userId: "admin_user_1",
    platformRole: "super_admin",
  }

  const createRoutes = (overrides = {}) =>
    createAdminUsersRoutes({
      requireSuperAdmin: mock(async () => allowedActor),
      listAdminUsers: mockListAdminUsers,
      getAdminUser: mockGetAdminUser,
      ...overrides,
    })

  beforeEach(() => {
    mockListAdminUsers.mockReset()
    mockGetAdminUser.mockReset()
  })

  describe("GET /admin/users", () => {
    it("returns 401 when guard returns unauthorized", async () => {
      const unauthGuard = mock(async (set: { status?: number | string }) => {
        set.status = 401
        return {
          ok: false as const,
          error: "UNAUTHORIZED",
          message: "Unauthorized",
        } satisfies AdminApiError
      })

      const app = new Elysia()
        .use(createRoutes({ requireSuperAdmin: unauthGuard }))
        .compile()

      const res = await app.handle(new Request(BASE))
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
    })

    it("returns 403 when guard returns forbidden", async () => {
      const forbiddenGuard = mock(async (set: { status?: number | string }) => {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN",
          policyCode: "SUPER_ADMIN_REQUIRED",
          message: "Forbidden",
        } satisfies AdminApiError
      })

      const app = new Elysia()
        .use(createRoutes({ requireSuperAdmin: forbiddenGuard }))
        .compile()

      const res = await app.handle(new Request(BASE))
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.policyCode).toBe("SUPER_ADMIN_REQUIRED")
    })

    it("returns 200 with list of users on success", async () => {
      mockListAdminUsers.mockResolvedValueOnce({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            firstName: "Alice",
            lastName: "Smith",
            emailVerified: true,
            profilePictureUrl: null,
            lastSignInAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        listMetadata: { before: "b1", after: "a1" },
      })

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(new Request(BASE))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.users).toHaveLength(1)
      expect(json.data.users[0].email).toBe("alice@example.com")
      expect(json.data.listMetadata.after).toBe("a1")
      expect(mockListAdminUsers).toHaveBeenCalledWith({
        limit: 10,
        before: undefined,
        after: undefined,
        email: undefined,
        organizationId: undefined,
      })
    })

    it("filters users by search query with ceiling of 50 and slices to limit", async () => {
      mockListAdminUsers.mockResolvedValueOnce({
        users: [
          {
            id: "user_1",
            email: "alice@example.com",
            firstName: "Alice",
            lastName: "Smith",
            emailVerified: true,
            profilePictureUrl: null,
            lastSignInAt: null,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
          {
            id: "user_2",
            email: "alice2@example.com",
            firstName: "Alice",
            lastName: "Cooper",
            emailVerified: true,
            profilePictureUrl: null,
            lastSignInAt: null,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
          {
            id: "user_3",
            email: "bob@example.com",
            firstName: "Bob",
            lastName: "Jones",
            emailVerified: false,
            profilePictureUrl: null,
            lastSignInAt: null,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      })

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(new Request(`${BASE}?search=alice&limit=1`))
      expect(res.status).toBe(200)
      const json = await res.json()
      // Sliced to requested limit of 1
      expect(json.data.users).toHaveLength(1)
      expect(json.data.users[0].email).toBe("alice@example.com")
      expect(mockListAdminUsers).toHaveBeenCalledWith({
        limit: 50,
        before: undefined,
        after: undefined,
        email: undefined,
        organizationId: undefined,
      })
    })

    it("returns error response when listAdminUsers throws", async () => {
      mockListAdminUsers.mockRejectedValueOnce(
        new Error("Database connection error")
      )

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(new Request(BASE))
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("INTERNAL_ERROR")
    })
  })

  describe("GET /admin/users/:id", () => {
    it("returns 200 with user detail and memberships", async () => {
      mockGetAdminUser.mockResolvedValueOnce({
        id: "user_123",
        email: "charlie@example.com",
        firstName: "Charlie",
        lastName: "Brown",
        emailVerified: true,
        profilePictureUrl: null,
        lastSignInAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        memberships: [
          {
            id: "mem_1",
            organizationId: "org_1",
            organizationName: "Charlie Org",
            status: "active",
            roleSlug: "admin",
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
      })

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(new Request(`${BASE}/user_123`))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.id).toBe("user_123")
      expect(json.data.memberships).toHaveLength(1)
      expect(json.data.memberships[0].organizationName).toBe("Charlie Org")
    })

    it("returns 404 when user is not found", async () => {
      mockGetAdminUser.mockRejectedValueOnce(
        new NotFoundException({
          message: "User not found",
          code: "not_found",
          path: "/admin/users",
          requestID: "req_not_found",
        })
      )

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(new Request(`${BASE}/user_not_found`))
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("WORKOS_NOT_FOUND")
    })
  })
})
