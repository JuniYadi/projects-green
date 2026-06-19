import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createTenantsInvitationRoutes } from "@/modules/tenants/api/routes/tenants-invitations.route"
import { createTenantsMembershipRoutes } from "@/modules/tenants/api/routes/tenants-memberships.route"
import type {
  TenantApiError,
  TenantInvitationSummary,
  TenantMembershipSummary,
} from "@/modules/tenants/contracts/tenant-api.contract"
import { TenantWorkOSOperationUnsupportedError } from "@/modules/tenants/services/tenant-workos.errors"

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

const defaultActor: MockActor = {
  userId: "user_actor",
  organizationId: "org_1",
  platformRole: "none",
  tenantRole: "owner",
}

const mockRequireTenantActor = mock(
  async (): Promise<MockActor> => ({ ...defaultActor })
)
/* eslint-disable @typescript-eslint/no-unused-vars */
const mockEnsureTenantContextAccess = mock(
  (
    _orgId: string,
    _actor: MockActor,
    _set: MockRouteSet
  ): true | TenantApiError => true
)
/* eslint-enable @typescript-eslint/no-unused-vars */

const makeMembership = (
  overrides: Partial<TenantMembershipSummary> = {}
): TenantMembershipSummary => ({
  id: "mem_1",
  organizationId: "org_1",
  userId: "user_target",
  displayName: "User Target",
  email: "user_target@example.com",
  avatarUrl: null,
  status: "active",
  role: "member",
  roleSlug: "user_member",
  profile: null,
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
  ...overrides,
})

const makeInvitation = (
  overrides: Partial<TenantInvitationSummary> = {}
): TenantInvitationSummary => ({
  id: "inv_1",
  email: "user@example.com",
  state: "pending",
  organizationId: "org_1",
  inviterUserId: "user_actor",
  acceptedUserId: null,
  roleSlug: "user_member",
  createdAt: "2026-05-17T00:00:00.000Z",
  expiresAt: "2026-06-17T00:00:00.000Z",
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

const mockListTenantInvitations = mock(async () => [makeInvitation()])
const mockGetTenantInvitationById = mock(async () => makeInvitation())
const mockSendTenantInvitation = mock(async () => ({
  id: "inv_2",
  email: "invitee@example.com",
  state: "pending",
  organizationId: "org_1",
  roleSlug: "user_member",
  createdAt: "2026-05-17T00:00:00.000Z",
  expiresAt: "2026-06-17T00:00:00.000Z",
}))
const mockRevokeTenantInvitation = mock(async () => makeInvitation())
const mockCancelTenantInvitation = mock(async () => makeInvitation())
const mockResendTenantInvitation = mock(async () => makeInvitation())
const mockGetTenantOrganizationById = mock(async () => null)
const mockUpdateTenantOrganization = mock(async () => {
  throw new Error("not implemented in memberships/invitations tests")
})
const mockDeleteTenantOrganization = mock(async () => {})

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

const getMembershipApp = async () => {
  return new Elysia().use(
    createTenantsMembershipRoutes({
      requireTenantActor: mockRequireTenantActor,
      ensureTenantContextAccess: mockEnsureTenantContextAccess,
      listTenantMemberships: mockListTenantMemberships,
      getTenantMembershipById: mockGetTenantMembershipById,
      updateTenantMembershipRole: mockUpdateTenantMembershipRole,
      demoteTenantMembershipSafely: mockDemoteTenantMembershipSafely,
      deleteTenantMembershipSafely: mockDeleteTenantMembershipSafely,
    })
  )
}

const getInvitationApp = async () => {
  return new Elysia().use(
    createTenantsInvitationRoutes({
      requireTenantActor: mockRequireTenantActor,
      ensureTenantContextAccess: mockEnsureTenantContextAccess,
      listTenantInvitations: mockListTenantInvitations,
      getTenantInvitationById: mockGetTenantInvitationById,
      sendTenantInvitation: mockSendTenantInvitation,
      revokeTenantInvitation: mockRevokeTenantInvitation,
      cancelTenantInvitation: mockCancelTenantInvitation,
      resendTenantInvitation: mockResendTenantInvitation,
    })
  )
}

describe("tenant admin routes", () => {
  beforeEach(() => {
    mockRequireTenantActor.mockReset()
    mockEnsureTenantContextAccess.mockReset()
    mockListTenantMemberships.mockReset()
    mockGetTenantMembershipById.mockReset()
    mockUpdateTenantMembershipRole.mockReset()
    mockDemoteTenantMembershipSafely.mockReset()
    mockDeleteTenantMembershipSafely.mockReset()
    mockListTenantInvitations.mockReset()
    mockGetTenantInvitationById.mockReset()
    mockSendTenantInvitation.mockReset()
    mockRevokeTenantInvitation.mockReset()
    mockCancelTenantInvitation.mockReset()
    mockResendTenantInvitation.mockReset()
    mockGetTenantOrganizationById.mockReset()
    mockUpdateTenantOrganization.mockReset()
    mockDeleteTenantOrganization.mockReset()

    mockRequireTenantActor.mockImplementation(
      async (): Promise<MockActor> => ({ ...defaultActor })
    )
    mockEnsureTenantContextAccess.mockImplementation(
      (): true | TenantApiError => true
    )
    mockListTenantMemberships.mockImplementation(async () => [makeMembership()])
    mockGetTenantMembershipById.mockImplementation(async () => makeMembership())
    mockUpdateTenantMembershipRole.mockImplementation(async () =>
      makeMembership()
    )
    mockDemoteTenantMembershipSafely.mockImplementation(async () => ({
      success: true,
      membership: makeMembership({ role: "member", roleSlug: "user_member" }),
    }))
    mockDeleteTenantMembershipSafely.mockImplementation(
      async (): Promise<MockDeleteResult> => ({
        success: true,
      })
    )
    mockListTenantInvitations.mockImplementation(async () => [makeInvitation()])
    mockGetTenantInvitationById.mockImplementation(async () => makeInvitation())
    mockSendTenantInvitation.mockImplementation(async () => ({
      id: "inv_2",
      email: "invitee@example.com",
      state: "pending",
      organizationId: "org_1",
      roleSlug: "user_member",
      createdAt: "2026-05-17T00:00:00.000Z",
      expiresAt: "2026-06-17T00:00:00.000Z",
    }))
    mockRevokeTenantInvitation.mockImplementation(async () => makeInvitation())
    mockCancelTenantInvitation.mockImplementation(async () => makeInvitation())
    mockResendTenantInvitation.mockImplementation(async () => makeInvitation())
    mockGetTenantOrganizationById.mockImplementation(async () => null)
    mockUpdateTenantOrganization.mockImplementation(async () => {
      throw new Error("not implemented in memberships/invitations tests")
    })
    mockDeleteTenantOrganization.mockImplementation(async () => {})
  })

  it("lists members with profile data when available", async () => {
    const app = await getMembershipApp()

    mockListTenantMemberships.mockImplementation(async () => [
      makeMembership({
        displayName: "Jane Doe",
        email: "jane@example.com",
        avatarUrl: "https://example.com/jane.png",
        profile: {
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Doe",
          profilePictureUrl: "https://example.com/jane.png",
          displayName: "Jane Doe",
        },
      }),
    ])

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/members")
    )
    const body = (await response.json()) as {
      ok: boolean
      members: TenantMembershipSummary[]
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.members[0]?.displayName).toBe("Jane Doe")
    expect(body.members[0]?.email).toBe("jane@example.com")
    expect(body.members[0]?.avatarUrl).toBe("https://example.com/jane.png")
    expect(body.members[0]?.profile?.displayName).toBe("Jane Doe")
  })

  it("returns forbidden when member invites owner", async () => {
    const app = await getInvitationApp()

    mockRequireTenantActor.mockImplementation(
      async (): Promise<MockActor> => ({
        ...defaultActor,
        tenantRole: "admin",
      })
    )

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "new@example.com",
          targetRole: "owner",
        }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.policyCode).toBe("INVITE_ROLE_FORBIDDEN")
  })

  it("returns context mismatch from tenant guard", async () => {
    const app = await getMembershipApp()

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
    expect(body.ok).toBe(false)
    expect(body.policyCode).toBe("TENANT_CONTEXT_MISMATCH")
  })

  it("allows self-leave even without tenant manage permission", async () => {
    const app = await getMembershipApp()

    mockRequireTenantActor.mockImplementation(
      async (): Promise<MockActor> => ({
        ...defaultActor,
        userId: "user_member_1",
        tenantRole: "member",
      })
    )
    mockGetTenantMembershipById.mockImplementation(async () =>
      makeMembership({
        id: "mem_self_1",
        userId: "user_member_1",
        role: "member",
        roleSlug: "user_member",
      })
    )

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/members/mem_self_1/remove", {
        method: "POST",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      removedMemberId: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.removedMemberId).toBe("mem_self_1")
    expect(mockDeleteTenantMembershipSafely).toHaveBeenCalledTimes(1)
  })

  it("blocks removal of the last active owner", async () => {
    const app = await getMembershipApp()

    mockGetTenantMembershipById.mockImplementation(async () =>
      makeMembership({
        id: "mem_owner_1",
        role: "owner",
        roleSlug: "user_owner",
      })
    )
    mockDeleteTenantMembershipSafely.mockImplementation(
      async (): Promise<MockDeleteResult> => ({
        success: false,
        reason: "LAST_OWNER_PROTECTED",
      })
    )

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/members/mem_owner_1/remove", {
        method: "POST",
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.policyCode).toBe("LAST_OWNER_PROTECTED")
  })

  it("cancels invitation successfully", async () => {
    const app = await getInvitationApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/invitations/inv_1/cancel", {
        method: "POST",
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      canceledInvitationId: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.canceledInvitationId).toBe("inv_1")
    expect(mockCancelTenantInvitation).toHaveBeenCalledWith("inv_1")
  })

  it("returns consistent unsupported-operation error for resend", async () => {
    const app = await getInvitationApp()

    mockResendTenantInvitation.mockImplementation(async () => {
      throw new TenantWorkOSOperationUnsupportedError("resendInvitation")
    })

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/invitations/inv_1/resend", {
        method: "POST",
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(501)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("WORKOS_OPERATION_UNSUPPORTED")
  })
})
