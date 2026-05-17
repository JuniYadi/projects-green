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

// Register mock.module BEFORE any imports that depend on them.
// bun ignores duplicate mock.module calls for the same path, so if
// tenants-admin.route.test.ts already registered these mocks, our
// mock.module calls are no-ops. We therefore retrieve the live mock
// functions from the module after registration and manipulate those.

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

// Retrieve the LIVE mock functions from the already-mocked module.
// If another test file registered mock.module first, its factory's
// return values are what the module actually exposes.  We grab those
// references so our mockImplementation calls mutate the right object.
const guards = await import("@/modules/tenants/api/tenants.guards")
const liveRequireTenantActor = guards.requireTenantActor as ReturnType<
  typeof mock
>
const liveEnsureTenantContextAccess =
  guards.ensureTenantContextAccess as ReturnType<typeof mock>

const service = await import(
  "@/modules/tenants/services/tenant-workos.service"
)
const liveListTenantMemberships =
  service.listTenantMemberships as ReturnType<typeof mock>
const liveGetTenantMembershipById =
  service.getTenantMembershipById as ReturnType<typeof mock>
const liveUpdateTenantMembershipRole =
  service.updateTenantMembershipRole as ReturnType<typeof mock>
const liveDemoteTenantMembershipSafely =
  service.demoteTenantMembershipSafely as ReturnType<typeof mock>
const liveDeleteTenantMembershipSafely =
  service.deleteTenantMembershipSafely as ReturnType<typeof mock>

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
  liveRequireTenantActor.mockReset()
  liveEnsureTenantContextAccess.mockReset()
  liveListTenantMemberships.mockReset()
  liveGetTenantMembershipById.mockReset()
  liveUpdateTenantMembershipRole.mockReset()
  liveDemoteTenantMembershipSafely.mockReset()
  liveDeleteTenantMembershipSafely.mockReset()

  liveRequireTenantActor.mockImplementation(
    async (): Promise<MockActor> => ({ ...defaultActor })
  )
  liveEnsureTenantContextAccess.mockImplementation(
    (
      _orgId: string,
      _actor: MockActor,
      _set: MockRouteSet
    ): true | TenantApiError => true
  )
  liveListTenantMemberships.mockImplementation(async () => [makeMembership()])
  liveGetTenantMembershipById.mockImplementation(async () => makeMembership())
  liveUpdateTenantMembershipRole.mockImplementation(async () =>
    makeMembership()
  )
  liveDemoteTenantMembershipSafely.mockImplementation(async () => ({
    success: true as const,
    membership: makeMembership({ role: "member", roleSlug: "user_member" }),
  }))
  liveDeleteTenantMembershipSafely.mockImplementation(
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
      liveRequireTenantActor.mockImplementation(async () =>
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
      liveEnsureTenantContextAccess.mockImplementation(
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
      liveRequireTenantActor.mockImplementation(
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
      liveListTenantMemberships.mockImplementation(async () => {
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
      liveGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ id: "mem_1", role: "member" })
      )
      liveUpdateTenantMembershipRole.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () => null)

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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveRequireTenantActor.mockImplementation(
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
      liveGetTenantMembershipById.mockImplementation(async () => {
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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () => null)

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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          role: "owner",
          roleSlug: "user_owner",
          userId: "user_actor",
        })
      )
      liveDemoteTenantMembershipSafely.mockImplementation(
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
      liveGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          role: "owner",
          roleSlug: "user_owner",
        })
      )
      liveDemoteTenantMembershipSafely.mockImplementation(
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
      liveGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: "admin", roleSlug: "user_admin" })
      )
      liveDemoteTenantMembershipSafely.mockImplementation(async () => {
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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () => null)

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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          userId: "user_member_1",
          tenantRole: "member",
        })
      )
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          userId: "user_member_1",
          tenantRole: "member",
        })
      )
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      liveGetTenantMembershipById.mockImplementation(async () =>
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
      liveGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({
          role: "owner",
          roleSlug: "user_owner",
          userId: "user_actor",
        })
      )
      liveDeleteTenantMembershipSafely.mockImplementation(
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
      liveGetTenantMembershipById.mockImplementation(async () =>
        makeMembership({ role: "owner", roleSlug: "user_owner" })
      )
      liveDeleteTenantMembershipSafely.mockImplementation(
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
      liveGetTenantMembershipById.mockImplementation(async () => {
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
