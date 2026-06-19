import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type { TenantApiError } from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantRole } from "@/modules/tenants/tenant-policy"
import { createTenantsAuthorizationRoutes } from "@/modules/tenants/api/routes/tenants-authorization.route"

type MockActor = {
  userId: string
  organizationId: string | null
  platformRole: "none" | "super_admin"
  tenantRole: TenantRole | null
}

let actorContext: MockActor | TenantApiError
let contextAccessResponse: true | TenantApiError

const mockRequireTenantActor = mock(async (...args: unknown[]) => {
  void args
  return actorContext
})
const mockEnsureTenantContextAccess = mock((...args: unknown[]) => {
  void args
  return contextAccessResponse
})

const loadApp = async () => {
  return new Elysia().use(
    createTenantsAuthorizationRoutes({
      requireTenantActor: mockRequireTenantActor,
      ensureTenantContextAccess: mockEnsureTenantContextAccess,
    })
  )
}

describe("tenantsAuthorizationRoutes", () => {
  let app: Awaited<ReturnType<typeof loadApp>>

  beforeEach(async () => {
    actorContext = {
      userId: "user_123",
      organizationId: "org_123",
      platformRole: "none",
      tenantRole: "owner",
    }
    contextAccessResponse = true
    mockRequireTenantActor.mockClear()
    mockEnsureTenantContextAccess.mockClear()
    mockRequireTenantActor.mockImplementation(async (...args: unknown[]) => {
      void args
      return actorContext
    })
    mockEnsureTenantContextAccess.mockImplementation((...args: unknown[]) => {
      void args
      return contextAccessResponse
    })

    app = await loadApp()
  })

  it("returns allowed action matrix for owner/admin/member/super_admin", async () => {
    const scenarios: Array<{
      label: string
      actor: MockActor
      expectedActions: string[]
    }> = [
      {
        label: "owner",
        actor: {
          userId: "user_owner",
          organizationId: "org_123",
          platformRole: "none",
          tenantRole: "owner",
        },
        expectedActions: [
          "manage_tenant",
          "invite_member",
          "invite_admin",
          "invite_owner",
          "promote_member",
          "promote_owner",
          "demote_admin",
          "demote_owner",
          "transfer_ownership",
        ],
      },
      {
        label: "admin",
        actor: {
          userId: "user_admin",
          organizationId: "org_123",
          platformRole: "none",
          tenantRole: "admin",
        },
        expectedActions: [
          "manage_tenant",
          "invite_member",
          "promote_member",
          "demote_admin",
        ],
      },
      {
        label: "member",
        actor: {
          userId: "user_member",
          organizationId: "org_123",
          platformRole: "none",
          tenantRole: "member",
        },
        expectedActions: [],
      },
      {
        label: "super_admin",
        actor: {
          userId: "user_super",
          organizationId: null,
          platformRole: "super_admin",
          tenantRole: null,
        },
        expectedActions: [
          "manage_tenant",
          "invite_member",
          "invite_admin",
          "invite_owner",
          "promote_member",
          "promote_owner",
          "demote_admin",
          "demote_owner",
          "transfer_ownership",
        ],
      },
    ]

    for (const scenario of scenarios) {
      actorContext = scenario.actor

      const response = await app.handle(
        new Request("http://localhost/tenants/org_123/authorization")
      )
      const body = (await response.json()) as {
        ok: boolean
        orgId: string
        effectiveTenantRole: string | null
        allowedActions: string[]
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.orgId).toBe("org_123")
      expect(body.effectiveTenantRole).toBe(scenario.actor.tenantRole)
      expect(body.allowedActions).toEqual(scenario.expectedActions)
    }
  })

  it("returns context policy error when org scope is invalid", async () => {
    contextAccessResponse = {
      ok: false,
      error: "FORBIDDEN",
      policyCode: "TENANT_CONTEXT_MISMATCH",
      message:
        "The requested tenant does not match your active organization context.",
    }
    mockEnsureTenantContextAccess.mockImplementation((...args: unknown[]) => {
      const set = args[2] as { status?: number }
      set.status = 403
      return contextAccessResponse
    })

    const response = await app.handle(
      new Request("http://localhost/tenants/org_456/authorization")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      policyCode?: string
    }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(body.policyCode).toBe("TENANT_CONTEXT_MISMATCH")
    expect(mockEnsureTenantContextAccess).toHaveBeenCalledTimes(1)
  })

  it("returns 401 when requireTenantActor fails", async () => {
    mockRequireTenantActor.mockImplementation(async (...args: unknown[]) => {
      const set = args[0] as { status?: number }
      set.status = 401
      return {
        ok: false,
        error: "UNAUTHORIZED",
        policyCode: "NO_SESSION",
        message: "No active session.",
      } as TenantApiError
    })

    const response = await app.handle(
      new Request("http://localhost/tenants/org_123/authorization")
    )
    expect(response.status).toBe(401)

    const body = (await response.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })
})
