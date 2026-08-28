import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { ConflictException } from "@workos-inc/node"
import type {
  AdminActorContext,
  AdminApiError,
} from "@/modules/admin/api/admin.guards"

const mockSendAdminInvitation = mock()

mock.module("@/modules/admin/admin.service", () => ({
  sendAdminInvitation: mockSendAdminInvitation,
}))

// Test seam: dynamic import after mock.module to ensure mock resolution
const { createAdminInvitationsRoutes } =
  await import("./admin-invitations.route")

const BASE = "http://localhost/admin/invitations"

describe("createAdminInvitationsRoutes", () => {
  const allowedActor: AdminActorContext = {
    ok: true,
    userId: "admin_user_1",
    platformRole: "super_admin",
  }

  beforeEach(() => {
    mockSendAdminInvitation.mockReset()
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
      .use(createAdminInvitationsRoutes({ requireSuperAdmin: unauthGuard }))
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
      .use(createAdminInvitationsRoutes({ requireSuperAdmin: forbiddenGuard }))
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
    const allowedGuard = mock(async () => allowedActor)

    const app = new Elysia()
      .use(createAdminInvitationsRoutes({ requireSuperAdmin: allowedGuard }))
      .compile()

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
    const allowedGuard = mock(async () => allowedActor)
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

    const app = new Elysia()
      .use(createAdminInvitationsRoutes({ requireSuperAdmin: allowedGuard }))
      .compile()

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
    const allowedGuard = mock(async () => allowedActor)
    mockSendAdminInvitation.mockRejectedValueOnce(
      new ConflictException({
        message: "The user is already a member of this organization",
        code: "user_already_member",
        error: "conflict",
        requestID: "req_123",
      })
    )

    const app = new Elysia()
      .use(createAdminInvitationsRoutes({ requireSuperAdmin: allowedGuard }))
      .compile()

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
    const allowedGuard = mock(async () => allowedActor)
    mockSendAdminInvitation.mockRejectedValueOnce(
      new Error("Unexpected failure")
    )

    const app = new Elysia()
      .use(createAdminInvitationsRoutes({ requireSuperAdmin: allowedGuard }))
      .compile()

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
})
