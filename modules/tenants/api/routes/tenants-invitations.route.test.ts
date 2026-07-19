import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type {
  TenantApiError,
  TenantInvitationSummary,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import { createTenantsInvitationRoutes } from "@/modules/tenants/api/routes/tenants-invitations.route"
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

const defaultActor: MockActor = {
  userId: "user_actor",
  organizationId: "org_1",
  platformRole: "none",
  tenantRole: "owner",
}

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

const mockRequireTenantActor = mock(
  async (): Promise<TenantActorContext | TenantApiError> => ({
    ...defaultActor,
  })
)
const mockEnsureTenantContextAccess = mock(
  (
    _orgId: string,
    _actor: MockActor,
    _set: MockRouteSet
  ): true | TenantApiError => true
)

const mockListTenantInvitations = mock(async () => [makeInvitation()])
const mockGetTenantInvitationById = mock(
  async (): Promise<TenantInvitationSummary | null> => makeInvitation()
)
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

const resetAllMocks = () => {
  mockRequireTenantActor.mockReset()
  mockEnsureTenantContextAccess.mockReset()
  mockListTenantInvitations.mockReset()
  mockGetTenantInvitationById.mockReset()
  mockSendTenantInvitation.mockReset()
  mockRevokeTenantInvitation.mockReset()
  mockCancelTenantInvitation.mockReset()
  mockResendTenantInvitation.mockReset()

  mockRequireTenantActor.mockImplementation(
    async (): Promise<TenantActorContext | TenantApiError> => ({
      ...defaultActor,
    })
  )
  mockEnsureTenantContextAccess.mockImplementation(
    (): true | TenantApiError => true
  )
  mockListTenantInvitations.mockImplementation(async () => [makeInvitation()])
  mockGetTenantInvitationById.mockImplementation(
    async (): Promise<TenantInvitationSummary | null> => makeInvitation()
  )
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
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> =>
          toUnauthorizedError()
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations")
      )
      const body = (await response.json()) as TenantApiError

      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 401 status when requireTenantActor fails", async () => {
      mockRequireTenantActor.mockImplementation(((set: { status?: number }) => {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          policyCode: "NO_SESSION",
          message: "No active session.",
        } as TenantApiError
      }) as unknown as typeof mockRequireTenantActor)

      const app = await getApp()

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations")
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(401)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns context mismatch", async () => {
      const app = await getApp()
      mockEnsureTenantContextAccess.mockImplementation(
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
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
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
      mockListTenantInvitations.mockImplementation(async () => {
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
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
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
      mockSendTenantInvitation.mockImplementation(async () => {
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
        new Request("http://localhost/tenants/org_1/invitations/inv_1/revoke", {
          method: "POST",
        })
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
      mockGetTenantInvitationById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_x/revoke", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when invitation belongs to different org", async () => {
      const app = await getApp()
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/revoke", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_ORG_MISMATCH")
    })

    it("returns error for invitation with invalid role", async () => {
      const app = await getApp()
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: null })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/revoke", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_INVALID_ROLE")
    })

    it("returns forbidden when admin revokes owner invitation", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/revoke", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_REVOKE_FORBIDDEN")
    })

    it("returns forbidden for member role", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
          ...defaultActor,
          tenantRole: "member",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/revoke", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      mockRevokeTenantInvitation.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/revoke", {
          method: "POST",
        })
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
    })

    it("returns not found when invitation does not exist", async () => {
      const app = await getApp()
      mockGetTenantInvitationById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_x/cancel", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when invitation belongs to different org", async () => {
      const app = await getApp()
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/cancel", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_ORG_MISMATCH")
    })

    it("returns error for invitation with invalid role", async () => {
      const app = await getApp()
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: null })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/cancel", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_INVALID_ROLE")
    })

    it("returns forbidden when admin cancels owner invitation", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/cancel", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_CANCEL_FORBIDDEN")
    })

    it("returns forbidden for member role", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
          ...defaultActor,
          tenantRole: "member",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/cancel", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      mockCancelTenantInvitation.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/cancel", {
          method: "POST",
        })
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
        new Request("http://localhost/tenants/org_1/invitations/inv_1/resend", {
          method: "POST",
        })
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
      mockGetTenantInvitationById.mockImplementation(async () => null)

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_x/resend", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(404)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns mismatch when invitation belongs to different org", async () => {
      const app = await getApp()
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ organizationId: "org_other" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/resend", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_ORG_MISMATCH")
    })

    it("returns error for invitation with invalid role", async () => {
      const app = await getApp()
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: null })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/resend", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_INVALID_ROLE")
    })

    it("returns forbidden when admin resends owner invitation", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
          ...defaultActor,
          tenantRole: "admin",
        })
      )
      mockGetTenantInvitationById.mockImplementation(async () =>
        makeInvitation({ roleSlug: "user_owner" })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/resend", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("INVITATION_RESEND_FORBIDDEN")
    })

    it("returns forbidden for member role", async () => {
      const app = await getApp()
      mockRequireTenantActor.mockImplementation(
        async (): Promise<TenantActorContext | TenantApiError> => ({
          ...defaultActor,
          tenantRole: "member",
        })
      )

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/resend", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(403)
      expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
    })

    it("returns workos error on service failure", async () => {
      const app = await getApp()
      mockResendTenantInvitation.mockImplementation(async () => {
        throw new Error("network error")
      })

      const response = await app.handle(
        new Request("http://localhost/tenants/org_1/invitations/inv_1/resend", {
          method: "POST",
        })
      )
      const body = (await response.json()) as TenantApiError

      expect(response.status).toBe(500)
      expect(body.error).toBe("TENANT_INVITATION_RESEND_FAILED")
    })

    it("returns unsupported operation error", async () => {
      const app = await getApp()
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
      expect(body.error).toBe("WORKOS_OPERATION_UNSUPPORTED")
    })
  })
})
