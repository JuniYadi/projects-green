import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

type MockActor = {
  userId: string
  organizationId: string
  platformRole: "none" | "super_admin"
  tenantRole: "owner" | "admin" | "member" | null
}

let actorContext: MockActor

const mockRequireTenantActor = mock(
  async (...args: unknown[]) => {
    void args
    return actorContext
  }
)

const mockEnsureTenantContextAccess = mock(() => true)

const mockGetTenantOrganizationById = mock(async () => ({
  id: "org_123",
  name: "Acme Org",
  allowProfilesOutsideOrganization: false,
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
}))

const mockDeleteTenantOrganization = mock(async () => {})
const mockUpdateTenantOrganization = mock(async () => ({
  id: "org_123",
  name: "Acme Org",
  allowProfilesOutsideOrganization: false,
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
}))

mock.module("@/modules/tenants/api/tenants.guards", () => {
  return {
    requireTenantActor: mockRequireTenantActor,
    ensureTenantContextAccess: mockEnsureTenantContextAccess,
  }
})

mock.module("@/modules/tenants/services/tenant-workos.service", () => {
  return {
    getTenantOrganizationById: mockGetTenantOrganizationById,
    deleteTenantOrganization: mockDeleteTenantOrganization,
    updateTenantOrganization: mockUpdateTenantOrganization,
  }
})

const loadApp = async () => {
  const { tenantsOrganizationRoutes } = await import(
    "@/modules/tenants/api/routes/tenants-organization.route"
  )

  return new Elysia().use(tenantsOrganizationRoutes)
}

describe("tenantsOrganizationRoutes", () => {
  beforeEach(() => {
    actorContext = {
      userId: "user_owner",
      organizationId: "org_123",
      platformRole: "none",
      tenantRole: "owner",
    }

    mockRequireTenantActor.mockClear()
    mockEnsureTenantContextAccess.mockClear()
    mockGetTenantOrganizationById.mockClear()
    mockDeleteTenantOrganization.mockClear()
    mockUpdateTenantOrganization.mockClear()

    mockRequireTenantActor.mockImplementation(
      async (...args: unknown[]) => {
        void args
        return actorContext
      }
    )
    mockEnsureTenantContextAccess.mockImplementation(() => true)
    mockGetTenantOrganizationById.mockImplementation(async () => ({
      id: "org_123",
      name: "Acme Org",
      allowProfilesOutsideOrganization: false,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    }))
  })

  it("blocks deletion when confirmation text does not match organization name", async () => {
    const app = await loadApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_123/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmOrganizationName: "Acme",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_DELETE_CONFIRMATION_MISMATCH")
    expect(mockDeleteTenantOrganization).not.toHaveBeenCalled()
  })

  it("deletes organization after owner confirmation", async () => {
    const app = await loadApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_123/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmOrganizationName: "Acme Org",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      organizationDeleted: boolean
      organizationId: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.organizationDeleted).toBe(true)
    expect(body.organizationId).toBe("org_123")
    expect(mockDeleteTenantOrganization).toHaveBeenCalledTimes(1)
    expect(mockDeleteTenantOrganization).toHaveBeenCalledWith("org_123")
  })

  it("rejects deletion for admin role", async () => {
    const app = await loadApp()

    actorContext = {
      userId: "user_admin",
      organizationId: "org_123",
      platformRole: "none",
      tenantRole: "admin",
    }

    const response = await app.handle(
      new Request("http://localhost/tenants/org_123/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmOrganizationName: "Acme Org",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      policyCode?: string
    }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(body.policyCode).toBe("ORGANIZATION_DELETE_FORBIDDEN")
    expect(mockDeleteTenantOrganization).not.toHaveBeenCalled()
  })
})
