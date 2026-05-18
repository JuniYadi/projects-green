import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type {
  TenantApiError,
  TenantInvitationSummary,
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

// Register mock.module — these may be no-ops if another test file
// already registered mocks for the same paths (bun keeps the first).
mock.module("@/modules/tenants/api/tenants.guards", () => ({
  requireTenantActor: mock(
    async (): Promise<MockActor> => ({ ...defaultActor })
  ),
  ensureTenantContextAccess: mock(
    (
      _orgId: string,
      _actor: MockActor,
      _set: MockRouteSet
    ): true | TenantApiError => true
  ),
}))

mock.module("@/modules/tenants/services/tenant-workos.service", () => ({
  TenantWorkOSOperationUnsupportedError:
    MockTenantWorkOSOperationUnsupportedError,
  listTenantMemberships: mock(async () => [makeMembership()]),
  getTenantMembershipById: mock(async () => makeMembership()),
  updateTenantMembershipRole: mock(async () => makeMembership()),
  demoteTenantMembershipSafely: mock(async () => ({
    success: true,
    membership: makeMembership(),
  })),
  deleteTenantMembershipSafely: mock(async () => ({ success: true })),
  listTenantInvitations: mock(async () => [makeInvitation()]),
  getTenantInvitationById: mock(
    async (): Promise<TenantInvitationSummary | null> => makeInvitation()
  ),
  sendTenantInvitation: mock(async () => ({
    id: "inv_2",
    email: "invitee@example.com",
    state: "pending",
    organizationId: "org_1",
    roleSlug: "user_member",
    createdAt: "2026-05-17T00:00:00.000Z",
    expiresAt: "2026-06-17T00:00:00.000Z",
  })),
  revokeTenantInvitation: mock(async () => makeInvitation()),
  cancelTenantInvitation: mock(async () => makeInvitation()),
  resendTenantInvitation: mock(async () => makeInvitation()),
  getTenantOrganizationById: mock(async () => null),
  updateTenantOrganization: mock(async () => {
    throw new Error("not implemented")
  }),
  deleteTenantOrganization: mock(async () => {}),
}))

// Retrieve the LIVE mock functions from the already-mocked modules.
// If another test file registered mock.module first, we get their
// mock refs — ensuring mockImplementation calls affect the right object.
const guards = await import("@/modules/tenants/api/tenants.guards")
const liveRequireTenantActor = guards.requireTenantActor as ReturnType<
  typeof mock
>
const liveEnsureTenantContextAccess =
  guards.ensureTenantContextAccess as ReturnType<typeof mock>

const service = await import(
  "@/modules/tenants/services/tenant-workos.service"
)
const liveListTenantInvitations = service.listTenantInvitations as ReturnType<
  typeof mock
>
const liveGetTenantInvitationById =
  service.getTenantInvitationById as ReturnType<typeof mock>
const liveSendTenantInvitation = service.sendTenantInvitation as ReturnType<
  typeof mock
>
const liveRevokeTenantInvitation =
  service.revokeTenantInvitation as ReturnType<typeof mock>
const liveCancelTenantInvitation =
  service.cancelTenantInvitation as ReturnType<typeof mock>
const liveResendTenantInvitation =
  service.resendTenantInvitation as ReturnType<typeof mock>

const toUnauthorizedError = (): TenantApiError => ({
  ok: false,
  error: "UNAUTHORIZED",
  message: "You must be signed in to manage tenants.",
})

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

const getApp = async () => {
  const route = await import(
    "@/modules/tenants/api/routes/tenants-invitations.route"
  )
  return new Elysia().use(route.tenantsInvitationRoutes)
}

const resetAllMocks = () => {
  liveRequireTenantActor.mockReset()
  liveEnsureTenantContextAccess.mockReset()
  liveListTenantInvitations.mockReset()
  liveGetTenantInvitationById.mockReset()
  liveSendTenantInvitation.mockReset()
  liveRevokeTenantInvitation.mockReset()
  liveCancelTenantInvitation.mockReset()
  liveResendTenantInvitation.mockReset()

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
  liveListTenantInvitations.mockImplementation(async () => [makeInvitation()])
  liveGetTenantInvitationById.mockImplementation(
    async (): Promise<TenantInvitationSummary | null> => makeInvitation()
  )
  liveSendTenantInvitation.mockImplementation(async () => ({
    id: "inv_2",
    email: "invitee@example.com",
    state: "pending",
    organizationId: "org_1",
    roleSlug: "user_member",
    createdAt: "2026-05-17T00:00:00.000Z",
    expiresAt: "2026-06-17T00:00:00.000Z",
  }))
  liveRevokeTenantInvitation.mockImplementation(async () => makeInvitation())
  liveCancelTenantInvitation.mockImplementation(async () => makeInvitation())
  liveResendTenantInvitation.mockImplementation(async () => makeInvitation())
}

describe("tenants-invitations routes", () => {
  beforeEach(resetAllMocks)

  describe("GET /tenants/:orgId/invitations", () => {
    it("returns invitation list for authorized owner", async () => {
      const app = await getApp()
      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations")
      )
      const body = (await response.json()) as {
        ok: boolean
        orgId: string
        invitations: TenantInvitationSummary[]
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.orgId).toBe("org_1")
      expect(body.invitations).toHaveLength(1)
    })

    it("returns unauthorized when actor is not signed in", async () => {
      const app = await getApp()
      liveRequireTenantActor.mockImplementation(async () =>
        toUnauthorizedError()
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations")
      )
      const body = (await response.json()) as TenantApiError

      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns context mismatch", async () => {
      const app = await getApp()
      liveEnsureTenantContextAccess.mockImplementation(
        (orgId: string, actor: MockActor, set: MockRouteSet) => {
          void orgId
          void actor
          return toContextMismatchError(set)
        }
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_2/invitations")
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
        new Request("http://localhost/tenants/org_1/invitations")
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      liveListTenantInvitations.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations")
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_INVITATIONS_LIST_FAILED")
    })
  })

  describe("POST /tenants/:orgId/invitations (create)", () => {
    it("creates invitation successfully", async () => {
      const app = await getApp()

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "new@example.com",
            targetRole: "member",
          }),
        })
      )
      const body = (await response.json()) as {
        ok: boolean
        invitation: { id: string }
      }

      expect(response.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(body.invitation.id).toBe("inv_2")
    })

    it("rejects admin inviting as owner", async () => {
      const app = await getApp()
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "new@example.com",
            targetRole: "owner",
          }),
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITE_ROLE_FORBIDDEN")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      liveSendTenantInvitation.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "new@example.com",
            targetRole: "member",
          }),
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_INVITATION_CREATE_FAILED")
    })
  })

  describe("POST /tenants/:orgId/invitations/:invitationId/revoke", () => {
    it("revokes invitation successfully", async () => {
      const app = await getApp()

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/revoke",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as {
        ok: boolean
        revokedInvitationId: string
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.revokedInvitationId).toBe("inv_1")
    })

    it("returns not found when invitation does not exist", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_x/revoke",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when invitation belongs to different org", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/revoke",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_ORG_MISMATCH")
    })

    it("returns error for invitation with invalid role", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: null })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/revoke",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_INVALID_ROLE")
    })

    it("returns forbidden when admin revokes owner invitation", async () => {
      const app = await getApp()
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/revoke",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_REVOKE_FORBIDDEN")
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
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/revoke",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      liveRevokeTenantInvitation.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/revoke",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_INVITATION_REVOKE_FAILED")
    })
  })

  describe("POST /tenants/:orgId/invitations/:invitationId/cancel", () => {
    it("cancels invitation successfully", async () => {
      const app = await getApp()

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/cancel",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as {
        ok: boolean
        canceledInvitationId: string
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.canceledInvitationId).toBe("inv_1")
    })

    it("returns not found when invitation does not exist", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_x/cancel",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when invitation belongs to different org", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/cancel",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_ORG_MISMATCH")
    })

    it("returns error for invitation with invalid role", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: null })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/cancel",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_INVALID_ROLE")
    })

    it("returns forbidden when admin cancels owner invitation", async () => {
      const app = await getApp()
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/cancel",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_CANCEL_FORBIDDEN")
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
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/cancel",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      liveCancelTenantInvitation.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/cancel",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_INVITATION_CANCEL_FAILED")
    })
  })

  describe("POST /tenants/:orgId/invitations/:invitationId/resend", () => {
    it("resends invitation successfully", async () => {
      const app = await getApp()

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as {
        ok: boolean
        invitation: TenantInvitationSummary
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
    })

    it("returns not found when invitation does not exist", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_x/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when invitation belongs to different org", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_ORG_MISMATCH")
    })

    it("returns error for invitation with invalid role", async () => {
      const app = await getApp()
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: null })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_INVALID_ROLE")
    })

    it("returns forbidden when admin resends owner invitation", async () => {
      const app = await getApp()
      liveRequireTenantActor.mockImplementation(
        async (): Promise<MockActor> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      liveGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_RESEND_FORBIDDEN")
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
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      liveResendTenantInvitation.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_INVITATION_RESEND_FAILED")
    })

    it("returns unsupported operation error", async () => {
      const app = await getApp()
      liveResendTenantInvitation.mockImplementation(async () => {
        throw new MockTenantWorkOSOperationUnsupportedError("resendInvitation")
      })

      const response = await app.handle(
        new Request(
          "http://localhost/tenants/org_1/invitations/inv_1/resend",
          { method: "POST" }
        )
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(501)
      expect(body.error).toBe("WORKOS_OPERATION_UNSUPPORTED")
    })
  })
})
