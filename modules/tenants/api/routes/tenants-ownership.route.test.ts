import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"

// ── Mock modules before importing route ────────────────

const mockGetTenantMembershipById = mock()
const mockListTenantMemberships = mock()
const mockUpdateTenantMembershipRole = mock()
const mockCanTransferOwnership = mock()

let mockActorContext: TenantActorContext | null = null

mock.module("@/modules/tenants/services/tenant-workos.service", () => ({
  getTenantMembershipById: mockGetTenantMembershipById,
  listTenantMemberships: mockListTenantMemberships,
  updateTenantMembershipRole: mockUpdateTenantMembershipRole,
}))

mock.module("@/modules/tenants/tenant-policy", () => ({
  canTransferOwnership: mockCanTransferOwnership,
}))

mock.module("@/modules/tenants/api/tenants.guards", () => ({
  requireTenantActor: mock(async (set: { status?: number | string }) => {
    if (!mockActorContext) {
      set.status = 401
      return {
        ok: false as const,
        error: "UNAUTHORIZED",
        message: "You must be signed in to perform this action.",
      }
    }
    return mockActorContext
  }),
  ensureTenantContextAccess: mock(
    (
      orgId: string,
      actor: TenantActorContext,
      set: { status?: number | string }
    ) => {
      if (actor.platformRole === "super_admin") {
        return true
      }
      if (!actor.organizationId) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN",
          policyCode: "TENANT_CONTEXT_REQUIRED",
          message:
            "An active tenant context is required to perform this action.",
        }
      }
      if (actor.organizationId !== orgId) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN",
          policyCode: "TENANT_CONTEXT_MISMATCH",
          message:
            "The requested tenant does not match your active organization context.",
        }
      }
      return true
    }
  ),
}))

const { tenantsOwnershipRoutes } = await import("./tenants-ownership.route")

describe("tenantsOwnershipRoutes", () => {
  const defaultActor: TenantActorContext = {
    userId: "user_owner_1",
    organizationId: "org_1",
    platformRole: "none",
    tenantRole: "owner",
  }

  const app = new Elysia().use(tenantsOwnershipRoutes).compile()

  beforeEach(() => {
    mockActorContext = { ...defaultActor }
    mockGetTenantMembershipById.mockReset()
    mockListTenantMemberships.mockReset()
    mockUpdateTenantMembershipRole.mockReset()
    mockCanTransferOwnership.mockReset()

    mockCanTransferOwnership.mockReturnValue(true)
  })

  it("returns 401 when unauthenticated", async () => {
    mockActorContext = null

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_2" }),
      })
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when tenant context mismatches", async () => {
    mockActorContext = {
      userId: "user_owner_1",
      organizationId: "org_other",
      platformRole: "none",
      tenantRole: "owner",
    }

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_2" }),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FORBIDDEN")
    expect(json.policyCode).toBe("TENANT_CONTEXT_MISMATCH")
  })

  it("returns 403 when canTransferOwnership policy check fails", async () => {
    mockCanTransferOwnership.mockReturnValue(false)

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_2" }),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FORBIDDEN")
    expect(json.policyCode).toBe("OWNERSHIP_TRANSFER_FORBIDDEN")
  })

  it("returns 404 when target membership does not exist", async () => {
    mockGetTenantMembershipById.mockResolvedValueOnce(null)

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_nonexistent" }),
      })
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
  })

  it("returns 403 when target membership belongs to a different org", async () => {
    mockGetTenantMembershipById.mockResolvedValueOnce({
      id: "mem_2",
      userId: "user_target_2",
      organizationId: "org_different",
      role: "member",
    })

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_2" }),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FORBIDDEN")
    expect(json.policyCode).toBe("MEMBERSHIP_ORG_MISMATCH")
  })

  it("successfully transfers ownership and demotes original owner to admin", async () => {
    const targetMembership = {
      id: "mem_target_2",
      userId: "user_target_2",
      organizationId: "org_1",
      role: "member",
    }
    const promotedMembership = {
      id: "mem_target_2",
      userId: "user_target_2",
      organizationId: "org_1",
      role: "owner",
    }

    mockGetTenantMembershipById.mockResolvedValueOnce(targetMembership)
    mockUpdateTenantMembershipRole.mockResolvedValueOnce(promotedMembership)
    mockListTenantMemberships.mockResolvedValueOnce([
      {
        id: "mem_actor_1",
        userId: "user_owner_1",
        organizationId: "org_1",
        role: "owner",
      },
      promotedMembership,
    ])

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_target_2" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.ownershipTransferred).toBe(true)
    expect(json.membership.role).toBe("owner")

    expect(mockUpdateTenantMembershipRole).toHaveBeenCalledWith(
      "mem_target_2",
      "owner"
    )
    expect(mockUpdateTenantMembershipRole).toHaveBeenCalledWith(
      "mem_actor_1",
      "admin"
    )
  })

  it("does not demote when super_admin executes the transfer", async () => {
    mockActorContext = {
      userId: "user_super_admin",
      organizationId: null,
      platformRole: "super_admin",
      tenantRole: null,
    }

    const targetMembership = {
      id: "mem_target_2",
      userId: "user_target_2",
      organizationId: "org_1",
      role: "member",
    }
    const promotedMembership = {
      id: "mem_target_2",
      userId: "user_target_2",
      organizationId: "org_1",
      role: "owner",
    }

    mockGetTenantMembershipById.mockResolvedValueOnce(targetMembership)
    mockUpdateTenantMembershipRole.mockResolvedValueOnce(promotedMembership)

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_target_2" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockListTenantMemberships).not.toHaveBeenCalled()
  })

  it("handles transfer when actor is also target user (no-op demotion)", async () => {
    const targetMembership = {
      id: "mem_actor_1",
      userId: "user_owner_1",
      organizationId: "org_1",
      role: "owner",
    }
    const promotedMembership = {
      id: "mem_actor_1",
      userId: "user_owner_1",
      organizationId: "org_1",
      role: "owner",
    }

    mockGetTenantMembershipById.mockResolvedValueOnce(targetMembership)
    mockUpdateTenantMembershipRole.mockResolvedValueOnce(promotedMembership)

    const res = await app.handle(
      new Request("http://localhost/tenants/org_1/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerMembershipId: "mem_actor_1" }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockListTenantMemberships).not.toHaveBeenCalled()
  })
})
