import { describe, it, expect, mock, beforeEach } from "bun:test"

mock.module("server-only", () => ({}))

import { Elysia } from "elysia"
import { ConflictException } from "@workos-inc/node"
import type {
  AdminActorContext,
  AdminApiError,
} from "@/modules/admin/api/admin.guards"

const mockSendAdminInvitation = mock()
const mockListAdminInvitations = mock()
const mockRevokeAdminInvitation = mock()

mock.module("@/modules/admin/admin.service", () => ({
  createAdminOrganization: mock(),
  listAdminOrganizations: mock(),
  listAdminOrganizationMembers: mock(),
  sendAdminInvitation: mockSendAdminInvitation,
  listAdminInvitations: mockListAdminInvitations,
  revokeAdminInvitation: mockRevokeAdminInvitation,
  listAdminUsers: mock(),
  getAdminUser: mock(),
}))

const { createAdminInvitationsRoutes } =
  await import("./admin-invitations.route")

const BASE = "http://localhost/admin/invitations"

describe("createAdminInvitationsRoutes", () => {
  const allowedActor: AdminActorContext = {
    ok: true,
    userId: "admin_user_1",
    platformRole: "super_admin",
  }

  const createRoutes = (overrides = {}) =>
    createAdminInvitationsRoutes({
      requireSuperAdmin: mock(async () => allowedActor),
      sendAdminInvitation: mockSendAdminInvitation,
      listAdminInvitations: mockListAdminInvitations,
      revokeAdminInvitation: mockRevokeAdminInvitation,
      ...overrides,
    })

  beforeEach(() => {
    mockSendAdminInvitation.mockReset()
    mockListAdminInvitations.mockReset()
    mockRevokeAdminInvitation.mockReset()
  })

  it("returns 401 when requireSuperAdmin returns unauthorized", async () => {
    const unauthGuard = mock(async (set: { status?: number | string }) => {
      set.status = 401
      return {
        ok: false as const,
        error: "UNAUTHORIZED",
        message: "You must be signed in to perform this action.",
      } satisfies AdminApiError
    })

    const app = new Elysia()
      .use(createRoutes({ requireSuperAdmin: unauthGuard }))
      .compile()

    const res = await app.handle(
      new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newmember@example.com",
          organizationId: "org_1",
          roleSlug: "admin",
        }),
      })
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when requireSuperAdmin returns forbidden", async () => {
    const forbiddenGuard = mock(async (set: { status?: number | string }) => {
      set.status = 403
      return {
        ok: false as const,
        error: "FORBIDDEN",
        policyCode: "SUPER_ADMIN_REQUIRED",
        message: "This action requires super admin access.",
      } satisfies AdminApiError
    })

    const app = new Elysia()
      .use(createRoutes({ requireSuperAdmin: forbiddenGuard }))
      .compile()

    const res = await app.handle(
      new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newmember@example.com",
          organizationId: "org_1",
          roleSlug: "admin",
        }),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FORBIDDEN")
    expect(json.policyCode).toBe("SUPER_ADMIN_REQUIRED")
  })

  it("returns 422 / bad request on invalid body (missing required email)", async () => {
    const app = new Elysia().use(createRoutes()).compile()

    const res = await app.handle(
      new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_1",
          roleSlug: "admin",
        }),
      })
    )

    expect(res.status).toBe(422)
  })

  it("returns 201 with invitation on success", async () => {
    const expectedInvitation = {
      id: "inv_123",
      email: "newmember@example.com",
      state: "pending",
      organizationId: "org_1",
      roleSlug: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-08T00:00:00.000Z",
      acceptedAt: null,
    }

    mockSendAdminInvitation.mockResolvedValueOnce(expectedInvitation)

    const app = new Elysia().use(createRoutes()).compile()

    const res = await app.handle(
      new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "  NewMember@Example.com  ",
          organizationId: "  org_1  ",
          roleSlug: "  admin  ",
          expiresInDays: 7,
        }),
      })
    )

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.invitation).toEqual(expectedInvitation)

    expect(mockSendAdminInvitation).toHaveBeenCalledWith({
      email: "newmember@example.com",
      organizationId: "org_1",
      inviterUserId: "admin_user_1",
      roleSlug: "admin",
      expiresInDays: 7,
    })
  })

  it("returns WorkOS conflict error response when service throws ConflictException", async () => {
    mockSendAdminInvitation.mockRejectedValueOnce(
      new ConflictException({
        message: "The user is already a member of this organization",
        code: "user_already_member",
        error: "conflict",
        requestID: "req_123",
      })
    )

    const app = new Elysia().use(createRoutes()).compile()

    const res = await app.handle(
      new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newmember@example.com",
          organizationId: "org_1",
        }),
      })
    )

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("WORKOS_CONFLICT")
  })

  it("returns internal error response when service throws generic error", async () => {
    mockSendAdminInvitation.mockRejectedValueOnce(
      new Error("Unexpected failure")
    )

    const app = new Elysia().use(createRoutes()).compile()

    const res = await app.handle(
      new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newmember@example.com",
          organizationId: "org_1",
        }),
      })
    )

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INTERNAL_ERROR")
  })

  describe("GET /admin/invitations", () => {
    it("returns 200 with invitations list", async () => {
      mockListAdminInvitations.mockResolvedValueOnce({
        invitations: [
          {
            id: "inv_1",
            email: "user@example.com",
            state: "pending",
            organizationId: "org_1",
            organizationName: "Org 1",
            roleSlug: "member",
            createdAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2026-02-01T00:00:00.000Z",
            acceptedAt: null,
          },
        ],
        listMetadata: {},
      })

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(new Request(BASE))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.invitations).toHaveLength(1)
      expect(json.data.invitations[0].email).toBe("user@example.com")
      expect(mockListAdminInvitations).toHaveBeenCalledWith({
        limit: 10,
        before: undefined,
        after: undefined,
        organizationId: undefined,
      })
    })

    it("filters invitations by status and search query with ceiling of 50 and slices to limit", async () => {
      mockListAdminInvitations.mockResolvedValueOnce({
        invitations: [
          {
            id: "inv_1",
            email: "alice@alpha.com",
            state: "pending",
            organizationId: "org_1",
            organizationName: "Alpha Corp",
            roleSlug: "member",
            createdAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2026-02-01T00:00:00.000Z",
            acceptedAt: null,
          },
          {
            id: "inv_2",
            email: "alice2@alpha.com",
            state: "pending",
            organizationId: "org_1",
            organizationName: "Alpha Corp",
            roleSlug: "member",
            createdAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2026-02-01T00:00:00.000Z",
            acceptedAt: null,
          },
          {
            id: "inv_3",
            email: "bob@beta.com",
            state: "accepted",
            organizationId: "org_2",
            organizationName: "Beta Corp",
            roleSlug: "admin",
            createdAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2026-02-01T00:00:00.000Z",
            acceptedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      })

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(
        new Request(`${BASE}?status=pending&search=alice&limit=1`)
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      // Sliced to requested limit of 1
      expect(json.data.invitations).toHaveLength(1)
      expect(json.data.invitations[0].email).toBe("alice@alpha.com")
      expect(mockListAdminInvitations).toHaveBeenCalledWith({
        limit: 50,
        before: undefined,
        after: undefined,
        organizationId: undefined,
      })
    })

    it("returns error response when listAdminInvitations throws", async () => {
      mockListAdminInvitations.mockRejectedValueOnce(
        new Error("Database error")
      )

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(new Request(BASE))
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("INTERNAL_ERROR")
    })
  })

  describe("DELETE /admin/invitations/:id", () => {
    it("revokes invitation successfully", async () => {
      mockRevokeAdminInvitation.mockResolvedValueOnce({
        id: "inv_123",
        email: "revoked@example.com",
        state: "revoked",
      })

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(
        new Request(`${BASE}/inv_123`, { method: "DELETE" })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.invitation.state).toBe("revoked")
      expect(mockRevokeAdminInvitation).toHaveBeenCalledWith("inv_123")
    })

    it("returns error response when revokeAdminInvitation throws", async () => {
      mockRevokeAdminInvitation.mockRejectedValueOnce(
        new Error("Revoke failed")
      )

      const app = new Elysia().use(createRoutes()).compile()

      const res = await app.handle(
        new Request(`${BASE}/inv_123`, { method: "DELETE" })
      )
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("INTERNAL_ERROR")
    })
  })
})
