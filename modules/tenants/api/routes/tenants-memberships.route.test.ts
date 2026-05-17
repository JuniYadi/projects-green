import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type {
  TenantApiError,
  TenantMembershipSummary,
} from "@/modules/tenants/contracts/tenant-api.contract"

type MockActor = {
  userId: string
  organizationId: string | null
  platformRole: "none" | "super_admin"
  tenantRole: "owner" | "admin" | "member" | null
}

type MockRouteSet = {
  status?: number | string
}

type MockDeleteResult =
  | { success: true }
  | { success: false; reason: "LAST_OWNER_PROTECTED" | "SELF_LEAVE_BLOCKED" }

type MockDemoteResult =
  | { success: true; membership: TenantMembershipSummary }
  | { success: false; reason: "LAST_OWNER_PROTECTED" | "SELF_DEMOTION_BLOCKED" }

const defaultActor: MockActor = {
  userId: "user_actor",
  organizationId: "org_1",
  platformRole: "none",
  tenantRole: "owner",
}

const mockRequireTenantActor = mock(
  async (): Promise<MockActor> => ({ ...defaultActor })
)
const mockEnsureTenantContextAccess = mock(
  (
    _orgId: string,
    _actor: MockActor,
    _set: MockRouteSet
  ): true | TenantApiError => true
)

class MockTenantWorkOSOperationUnsupportedError extends Error {
  readonly operation: string
  constructor(operation: string) {
    super(`Operation '${operation}' is not supported.`)
    this.name = "TenantWorkOSOperationUnsupportedError"
    this.operation = operation
  }
}

const makeMembership = (
  overrides: Partial<TenantMembershipSummary> = {}
): TenantMembershipSummary => ({
  id: "mem_1",
  organizationId: "org_1",
  userId: "user_target",
  status: "active",
  role: "member",
  roleSlug: "user_member",
  profile: null,
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
  ...overrides,
})

const mockListTenantMemberships = mock(async () => [makeMembership()])
const mockGetTenantMembershipById = mock(async () => makeMembership())
const mockUpdateTenantMembershipRole = mock(async () => makeMembership())
const mockDemoteTenantMembershipSafely = mock(async () => ({
  success: true as const,
  membership: makeMembership({ role: "member", roleSlug: "user_member" }),
}))
const mockDeleteTenantMembershipSafely = mock(
  async (): Promise<MockDeleteResult> => ({
    success: true as const,
  })
)

// Unused stubs required by the full service mock
const mockListTenantInvitations = mock(async () => [])
const mockGetTenantInvitationById = mock(async () => null)
const mockSendTenantInvitation = mock(async () => ({}))
const mockRevokeTenantInvitation = mock(async () => ({}))
const mockCancelTenantInvitation = mock(async () => ({}))
const mockResendTenantInvitation = mock(async () => ({}))
const mockGetTenantOrganizationById = mock(async () => null)
const mockUpdateTenantOrganization = mock(async () => {
  throw new Error("not implemented")
})
const mockDeleteTenantOrganization = mock(async () => {})

mock.module("@/modules/tenants/api/tenants.guards", () => ({
  requireTenantActor: mockRequireTenantActor,
  ensureTenantContextAccess: mockEnsureTenantContextAccess,
}))

mock.module("@/modules/tenants/services/tenant-workos.service", () => ({
  TenantWorkOSOperationUnsupportedError:
    MockTenantWorkOSOperationUnsupportedError,
  listTenantMemberships: mockListTenantMemberships,
  getTenantMembershipById: mockGetTenantMembershipById,
  updateTenantMembershipRole: mockUpdateTenantMembershipRole,
  demoteTenantMembershipSafely: mockDemoteTenantMembershipSafely,
  deleteTenantMembershipSafely: mockDeleteTenantMembershipSafely,
  listTenantInvitations: mockListTenantInvitations,
  getTenantInvitationById: mockGetTenantInvitationById,
  sendTenantInvitation: mockSendTenantInvitation,
  revokeTenantInvitation: mockRevokeTenantInvitation,
  cancelTenantInvitation: mockCancelTenantInvitation,
  resendTenantInvitation: mockResendTenantInvitation,
  getTenantOrganizationById: mockGetTenantOrganizationById,
  updateTenantOrganization: mockUpdateTenantOrganization,
  deleteTenantOrganization: mockDeleteTenantOrganization,
}))

const toContextMismatchError = (set: MockRouteSet): TenantApiError => {
  set.status = 403
  return {
    ok: false,
    error: "FORBIDDEN",
    policyCode: "TENANT_CONTEXT_MISMATCH",
    message:
      "The requested tenant does not match your active organization context.",
  }
}

const toUnauthorizedError = (): TenantApiError => ({
  ok: false,
  error: "UNAUTHORIZED",
  message: "You must be signed in to manage tenants.",
})

const getApp = async () => {
  const route = await import(
    "@/modules/tenants/api/routes/tenants-memberships.route"
  )
  return new Elysia().use(route.tenantsMembershipRoutes)
}

const resetAllMocks = () => {
  mockRequireTenantActor.mockReset()
  mockEnsureTenantContextAccess.mockReset()
  mockListTenantMemberships.mockReset()
  mockGetTenantMembershipById.mockReset()
  mockUpdateTenantMembershipRole.mockReset()
  mockDemoteTenantMembershipSafely.mockReset()
  mockDeleteTenantMembershipSafely.mockReset()

  mockRequireTenantActor.mockImplementation(
    async (): Promise<MockActor> => ({ ...defaultActor })
  )
  mockEnsureTenantContextAccess.mockImplementation(
    (
      _orgId: string,
      _actor: MockActor,
      _set: MockRouteSet
    ): true | TenantApiError => true
  )
  mockListTenantMemberships.mockImplementation(async () => [makeMembership()])
  mockGetTenantMembershipById.mockImplementation(async () => makeMembership())
  mockUpdateTenantMembershipRole.mockImplementation(async () =>
    makeMembership()
  )
  mockDemoteTenantMembershipSafely.mockImplementation(async () => ({
    success: true as const,
    membership: makeMembership({ role: "member", roleSlug: "user_member" }),
  }))
  mockDeleteTenantMembershipSafely.mockImplementation(
    async (): Promise<MockDeleteResult> => ({
      success: true as const,
    })
  )
}

describe("tenants-memberships routes", () => {
  beforeEach(resetAllMocks)

  describe("GET /tenants/:orgId/members", () => {
    it("returns member list for authorized owner", async () => {
      const app = await getApp()
      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      const body = (await response.json()) as {
        ok: boolean
        orgId: string
        members: TenantMembershipSummary[]
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.orgId).toBe("org_1")
      expect(body.members).toHaveLength(1)
    })

    it("returns unauthorized when actor is not signed in", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(async () =>
        toUnauthorizedError()
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      const body = (await response.json()) as TenantApiError

      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns context mismatch when org does not match", async () => {
      const app = await getApp()
      mockEnsureTenantContextAccess.mockImplementation(
        (orgId: string, actor: MockActor, set: MockRouteSet) => {
          void orgId
          void actor
          return toContextMismatchError(set)
        }
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_2/members")
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_CONTEXT_MISMATCH")
    })

    it("returns forbidden for member role", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "member",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      mockListTenantMemberships.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members")
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("TENANT_MEMBERS_LIST_FAILED")
    })
  })

  describe("POST /tenants/:orgId/members/:memberId/promote", () => {
    it("promotes a member to admin successfully", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ id: "mem_1", role: "member" })
      )
      mockUpdateTenantMembershipRole.mockImplementation(async () =>
        makeMembership({ id: "mem_1", role: "admin", roleSlug: "user_admin" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "admin" }),
        })
      )
      const body = (await response.json()) as {
        ok: boolean
        membership: TenantMembershipSummary
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.membership.role).toBe("admin")
    })

    it("returns not found when membership does not exist", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_x/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "admin" }),
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when membership belongs to different org", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "admin" }),
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("MEMBERSHIP_ORG_MISMATCH")
    })

    it("returns forbidden when admin promotes to owner", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "owner" }),
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("PROMOTION_FORBIDDEN")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole: "admin" }),
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_MEMBER_PROMOTE_FAILED")
    })
  })

  describe("POST /tenants/:orgId/members/:memberId/demote", () => {
    it("demotes an admin to member successfully", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          id: "mem_admin",
          role: "admin",
          roleSlug: "user_admin",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_admin/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as {
        ok: boolean
        membership: TenantMembershipSummary
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
    })

    it("returns not found when membership does not exist", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_x/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when membership belongs to different org", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("MEMBERSHIP_ORG_MISMATCH")
    })

    it("rejects demotion of already-member role", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: "member" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("DEMOTION_NOT_APPLICABLE")
    })

    it("rejects demotion of null role treated as member", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: null })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("DEMOTION_NOT_APPLICABLE")
    })

    it("returns forbidden when admin demotes owner", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: "owner", roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("DEMOTION_FORBIDDEN")
    })

    it("blocks self-demotion when last owner", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          role: "owner",
          roleSlug: "user_owner",
          userId: "user_actor",
        })
      )
      mockDemoteTenantMembershipSafely.mockImplementation(
        async (): Promise<MockDemoteResult> => ({
          success: false,
          reason: "SELF_DEMOTION_BLOCKED",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("SELF_DEMOTION_BLOCKED")
    })

    it("blocks demotion of last owner by another owner", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          role: "owner",
          roleSlug: "user_owner",
        })
      )
      mockDemoteTenantMembershipSafely.mockImplementation(
        async (): Promise<MockDemoteResult> => ({
          success: false,
          reason: "LAST_OWNER_PROTECTED",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("LAST_OWNER_PROTECTED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: "admin", roleSlug: "user_admin" })
      )
      mockDemoteTenantMembershipSafely.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/demote", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_MEMBER_DEMOTE_FAILED")
    })
  })

  describe("POST /tenants/:orgId/members/:memberId/remove", () => {
    it("removes a member successfully", async () => {
      const app = await getApp()
      // Use role=null, roleSlug=null to bypass canDemoteFromRole check
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: null, roleSlug: null })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as {
        ok: boolean
        removedMemberId: string
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.removedMemberId).toBe("mem_1")
    })

    it("returns not found when membership does not exist", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_x/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when membership belongs to different org", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("MEMBERSHIP_ORG_MISMATCH")
    })

    it("allows self-leave even without manage permission", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          userId: "user_member_1",
          tenantRole: "member",
        })
      )
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          id: "mem_self",
          userId: "user_member_1",
          role: "member",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_self/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as {
        ok: boolean
        removedMemberId: string
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.removedMemberId).toBe("mem_self")
    })

    it("rejects removal by member of another member", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          userId: "user_member_1",
          tenantRole: "member",
        })
      )
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          id: "mem_other",
          userId: "user_target",
          role: "member",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_other/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("rejects removal of user with unmapped role", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: null, roleSlug: "custom_role_slug" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("REMOVE_FORBIDDEN")
    })

    it("rejects removal of owner by admin", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: "owner", roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("REMOVE_FORBIDDEN")
    })

    it("blocks self-leave when last owner", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          role: "owner",
          roleSlug: "user_owner",
          userId: "user_actor",
        })
      )
      mockDeleteTenantMembershipSafely.mockImplementation(
        async (): Promise<MockDeleteResult> => ({
          success: false,
          reason: "SELF_LEAVE_BLOCKED",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("SELF_LEAVE_BLOCKED")
    })

    it("blocks removal of last owner", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: "owner", roleSlug: "user_owner" })
      )
      mockDeleteTenantMembershipSafely.mockImplementation(
        async (): Promise<MockDeleteResult> => ({
          success: false,
          reason: "LAST_OWNER_PROTECTED",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("LAST_OWNER_PROTECTED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      mockGetTenantMembershipById.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/members/mem_1/remove", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_MEMBER_REMOVE_FAILED")
    })
  })
})
