import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import type { TenantApiError } from "@/modules/tenants/contracts/tenant-api.contract"
import type { RouteSet } from "@/modules/tenants/api/tenants.errors"

// ── Mock AuthService ───────────────────────────────────

const mockGetUserDetails = mock()

mock.module("@/modules/auth/auth.service", () => ({
  authService: {
    getUserDetails: mockGetUserDetails,
  },
}))

// ── Import route after auth service mock ───────────────

const { createTenantsMembershipRoutes } =
  await import("./tenants-memberships.route")

describe("TenantsMembershipsRoute", () => {
  let mockActor: TenantActorContext | TenantApiError
  let mockContextAccess: true | TenantApiError

  const mockListTenantMemberships = mock()
  const mockGetTenantMembershipById = mock()
  const mockUpdateTenantMembershipRole = mock()
  const mockDemoteTenantMembershipSafely = mock()
  const mockDeleteTenantMembershipSafely = mock()
  const mockCanManageTenant = mock()
  const mockCanPromoteToRole = mock()
  const mockCanDemoteFromRole = mock()

  const defaultActor: TenantActorContext = {
    userId: "user_actor_1",
    organizationId: "org_1",
    platformRole: "none",
    tenantRole: "owner",
  }

  function createApp(overrides: Record<string, unknown> = {}) {
    const deps = {
      requireTenantActor: mock(async (set: RouteSet) => {
        if ("ok" in mockActor && !mockActor.ok) {
          set.status = 401
          return mockActor
        }
        return mockActor
      }),
      ensureTenantContextAccess: mock(
        async (_orgId: string, _actor: TenantActorContext, set: RouteSet) => {
          if (mockContextAccess !== true) {
            set.status = 403
            return mockContextAccess
          }
          return true
        }
      ),
      listTenantMemberships: mockListTenantMemberships,
      getTenantMembershipById: mockGetTenantMembershipById,
      updateTenantMembershipRole: mockUpdateTenantMembershipRole,
      demoteTenantMembershipSafely: mockDemoteTenantMembershipSafely,
      deleteTenantMembershipSafely: mockDeleteTenantMembershipSafely,
      canManageTenant: mockCanManageTenant,
      canPromoteToRole: mockCanPromoteToRole,
      canDemoteFromRole: mockCanDemoteFromRole,
      ...overrides,
    }

    return new Elysia()
      .use(
        createTenantsMembershipRoutes(
          deps as unknown as Parameters<typeof createTenantsMembershipRoutes>[0]
        )
      )
      .compile()
  }

  beforeEach(() => {
    mockActor = { ...defaultActor }
    mockContextAccess = true

    mockListTenantMemberships.mockReset()
    mockGetTenantMembershipById.mockReset()
    mockUpdateTenantMembershipRole.mockReset()
    mockDemoteTenantMembershipSafely.mockReset()
    mockDeleteTenantMembershipSafely.mockReset()
    mockCanManageTenant.mockReset()
    mockCanPromoteToRole.mockReset()
    mockCanDemoteFromRole.mockReset()
    mockGetUserDetails.mockReset()

    mockCanManageTenant.mockReturnValue(true)
    mockCanPromoteToRole.mockReturnValue(true)
    mockCanDemoteFromRole.mockReturnValue(true)
  })

  describe("GET /tenants/:orgId/members", () => {
    it("returns error if requireTenantActor fails", async () => {
      mockActor = {
        ok: false,
        error: "UNAUTHORIZED",
        message: "Sign in required.",
      }
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns error if ensureTenantContextAccess fails", async () => {
      mockContextAccess = {
        ok: false,
        error: "FORBIDDEN",
        message: "No access.",
      }
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns 403 if user cannot manage tenant", async () => {
      mockCanManageTenant.mockReturnValue(false)
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns membership list when authorized", async () => {
      const sampleMembers = [
        { id: "mem_1", userId: "user_1", role: "owner" },
        { id: "mem_2", userId: "user_2", role: "member" },
      ]
      mockListTenantMemberships.mockResolvedValueOnce(sampleMembers)
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.orgId).toBe("org_1")
      expect(json.members).toHaveLength(2)
    })

    it("returns 500 when listing memberships throws", async () => {
      mockListTenantMemberships.mockRejectedValueOnce(new Error("WorkOS error"))
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("TENANT_MEMBERS_LIST_FAILED")
    })
  })

  describe("POST /tenants/:orgId/members/:memberId/promote", () => {
    it("returns 404 if membership not found", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce(null)
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_999/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "admin" }),
        })
      )

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("NOT_FOUND")
    })

    it("returns 403 if membership organization does not match", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        organizationId: "other_org",
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "admin" }),
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("MEMBERSHIP_ORG_MISMATCH")
    })

    it("returns 403 if actor cannot promote to role", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        organizationId: "org_1",
      })
      mockCanPromoteToRole.mockReturnValue(false)
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "owner" }),
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("PROMOTION_FORBIDDEN")
    })

    it("successfully promotes member", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        organizationId: "org_1",
      })
      mockUpdateTenantMembershipRole.mockResolvedValueOnce({
        id: "mem_1",
        role: "admin",
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "admin" }),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.membership.role).toBe("admin")
    })
  })

  describe("POST /tenants/:orgId/members/:memberId/demote", () => {
    it("returns 403 if target member is already member role", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        organizationId: "org_1",
        role: "member",
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("DEMOTION_NOT_APPLICABLE")
    })

    it("returns 403 if actor cannot demote from role", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        organizationId: "org_1",
        role: "owner",
      })
      mockCanDemoteFromRole.mockReturnValue(false)
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("DEMOTION_FORBIDDEN")
    })

    it("returns error if demoteTenantMembershipSafely fails (LAST_OWNER_PROTECTED)", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        organizationId: "org_1",
        role: "owner",
      })
      mockDemoteTenantMembershipSafely.mockResolvedValueOnce({
        success: false,
        reason: "LAST_OWNER_PROTECTED",
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("LAST_OWNER_PROTECTED")
    })

    it("successfully demotes member", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        organizationId: "org_1",
        role: "admin",
      })
      mockDemoteTenantMembershipSafely.mockResolvedValueOnce({
        success: true,
        membership: { id: "mem_1", role: "member" },
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.membership.role).toBe("member")
    })
  })

  describe("POST /tenants/:orgId/members/:memberId/remove", () => {
    it("returns 403 when non-manager tries to remove another member", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_2",
        userId: "user_other",
        organizationId: "org_1",
        role: "member",
      })
      mockCanManageTenant.mockReturnValue(false)
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_2/remove", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns 403 when user has unmapped roleSlug", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_2",
        userId: "user_other",
        organizationId: "org_1",
        role: null,
        roleSlug: "unknown_custom_slug",
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_2/remove", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("REMOVE_FORBIDDEN")
    })

    it("returns error if deleteTenantMembershipSafely fails (SELF_LEAVE_BLOCKED)", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_actor",
        userId: defaultActor.userId,
        organizationId: "org_1",
        role: "owner",
      })
      mockDeleteTenantMembershipSafely.mockResolvedValueOnce({
        success: false,
        reason: "SELF_LEAVE_BLOCKED",
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_actor/remove", {
          method: "POST",
        })
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
      expect(json.policyCode).toBe("SELF_LEAVE_BLOCKED")
    })

    it("successfully removes member", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_2",
        userId: "user_2",
        organizationId: "org_1",
        role: "member",
      })
      mockDeleteTenantMembershipSafely.mockResolvedValueOnce({
        success: true,
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_2/remove", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.removedMemberId).toBe("mem_2")
    })
  })

  describe("GET /tenants/:orgId/members/:memberId/details", () => {
    it("returns 404 if membership does not exist", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce(null)
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_999/details")
      )

      expect(res.status).toBe(404)
    })

    it("returns details for membership", async () => {
      mockGetTenantMembershipById.mockResolvedValueOnce({
        id: "mem_1",
        userId: "user_1",
        organizationId: "org_1",
        role: "member",
      })
      mockGetUserDetails.mockResolvedValueOnce({
        user: { id: "user_1", email: "user1@example.com" },
        sessions: [],
      })
      const app = createApp()

      const res = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/details")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.membership.id).toBe("mem_1")
      expect(json.user.id).toBe("user_1")
    })
  })
})
