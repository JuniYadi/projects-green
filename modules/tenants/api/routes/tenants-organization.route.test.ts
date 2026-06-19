import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { workosNodeMock } from "@/test/workos-node-mock"

// Mock @workos-inc/node upfront so the module is consistent in both
// isolated (no coverage) and single-process (coverage) mode.
mock.module("@workos-inc/node", () => workosNodeMock)

const { NotFoundException, UnprocessableEntityException } = workosNodeMock

import { createTenantsOrganizationRoutes } from "@/modules/tenants/api/routes/tenants-organization.route"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"

type MockOrganization = {
  id: string
  name: string
  metadata: Record<string, string>
  allowProfilesOutsideOrganization: boolean
  createdAt: string
  updatedAt: string
}

const createOrganization = (): MockOrganization => ({
  id: "org_1",
  name: "Acme Co",
  metadata: {
    region: "APAC",
  },
  allowProfilesOutsideOrganization: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
})

const mockRequireTenantActor = mock(async () => ({
  userId: "user_1",
  organizationId: "org_1",
  platformRole: "none" as const,
  tenantRole: "owner" as const,
}))

const mockEnsureTenantContextAccess = mock((): true => true)
const mockCanManageTenant = mock((): boolean => true)
const mockCanTransferOwnership = mock((): boolean => true)

const mockGetTenantOrganizationById = mock(
  async (): Promise<MockOrganization | null> => createOrganization()
)

const mockUpdateTenantOrganization = mock(async (params: unknown) => {
  const payload = params as {
    organizationId: string
    name?: string
    metadata?: Record<string, string>
  }

  return {
    id: payload.organizationId,
    name: payload.name ?? "Acme Co",
    metadata: payload.metadata ?? {},
    allowProfilesOutsideOrganization: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  }
})

const mockDeleteTenantOrganization = mock(async () => {})

const createApp = async () => {
  return new Elysia().use(
    createTenantsOrganizationRoutes({
      requireTenantActor: mockRequireTenantActor,
      ensureTenantContextAccess: mockEnsureTenantContextAccess,
      getTenantOrganizationById: mockGetTenantOrganizationById,
      updateTenantOrganization: mockUpdateTenantOrganization,
      deleteTenantOrganization: mockDeleteTenantOrganization,
      canManageTenant: mockCanManageTenant,
      canTransferOwnership: mockCanTransferOwnership,
    })
  )
}

describe("tenantsOrganizationRoutes", () => {
  beforeEach(() => {
    mockRequireTenantActor.mockClear()
    mockEnsureTenantContextAccess.mockClear()
    mockCanManageTenant.mockClear()
    mockCanTransferOwnership.mockClear()
    mockGetTenantOrganizationById.mockClear()
    mockUpdateTenantOrganization.mockClear()
    mockDeleteTenantOrganization.mockClear()

    mockRequireTenantActor.mockImplementation(async () => ({
      userId: "user_1",
      organizationId: "org_1",
      platformRole: "none",
      tenantRole: "owner",
    }))
    mockEnsureTenantContextAccess.mockImplementation((): true => true)
    mockCanManageTenant.mockImplementation((): boolean => true)
    mockCanTransferOwnership.mockImplementation((): boolean => true)
    mockGetTenantOrganizationById.mockImplementation(async () =>
      createOrganization()
    )
    mockUpdateTenantOrganization.mockImplementation(async (params: unknown) => {
      const payload = params as {
        organizationId: string
        name?: string
        metadata?: Record<string, string>
      }

      return {
        id: payload.organizationId,
        name: payload.name ?? "Acme Co",
        metadata: payload.metadata ?? {},
        allowProfilesOutsideOrganization: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      }
    })
    mockDeleteTenantOrganization.mockImplementation(async () => {})
  })

  it("returns organization details for authorized tenant managers", async () => {
    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization")
    )
    const body = (await response.json()) as {
      ok: boolean
      orgId: string
      organization: { id: string; metadata: Record<string, unknown> }
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.orgId).toBe("org_1")
    expect(body.organization.id).toBe("org_1")
    expect(body.organization.metadata.region).toBe("APAC")
  })

  it("returns unauthorized error when actor cannot be resolved", async () => {
    // Create a custom mock for this test that returns an error and sets status
    const unauthorizedMock = mock(
      async (set: {
        status?: number | string
      }): Promise<TenantActorContext> => {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "You must be signed in to manage tenants.",
        } as unknown as TenantActorContext
      }
    )

    const app = new Elysia().use(
      createTenantsOrganizationRoutes({
        requireTenantActor: unauthorizedMock,
        ensureTenantContextAccess: mockEnsureTenantContextAccess,
        getTenantOrganizationById: mockGetTenantOrganizationById,
        updateTenantOrganization: mockUpdateTenantOrganization,
        deleteTenantOrganization: mockDeleteTenantOrganization,
        canManageTenant: mockCanManageTenant,
        canTransferOwnership: mockCanTransferOwnership,
      })
    )
    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization")
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns context mismatch policy error when tenant context access fails", async () => {
    // Create a custom mock that returns a policy error and sets status
    const authenticatedMock = mock(
      async (): Promise<TenantActorContext> => ({
        userId: "user_1",
        organizationId: "org_1",
        platformRole: "none" as const,
        tenantRole: "owner" as const,
      })
    )
    const contextAccessMock = mock(
      (
        _orgId: string,
        _actor: TenantActorContext,
        set: { status?: number | string }
      ) => {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          policyCode: "ORGANIZATION_CONTEXT_MISMATCH",
          message:
            "Organization context mismatch. Switch organization and try again.",
        } as unknown as true
      }
    )

    const app = new Elysia().use(
      createTenantsOrganizationRoutes({
        requireTenantActor: authenticatedMock,
        ensureTenantContextAccess: contextAccessMock,
        getTenantOrganizationById: mockGetTenantOrganizationById,
        updateTenantOrganization: mockUpdateTenantOrganization,
        deleteTenantOrganization: mockDeleteTenantOrganization,
        canManageTenant: mockCanManageTenant,
        canTransferOwnership: mockCanTransferOwnership,
      })
    )
    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      policyCode: string
    }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(body.policyCode).toBe("ORGANIZATION_CONTEXT_MISMATCH")
  })

  it("returns 404 when organization lookup returns null", async () => {
    mockGetTenantOrganizationById.mockImplementation(async () => null)

    const app = await createApp()
    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")
    expect(body.message).toBe("Organization not found.")
  })

  it("returns 403 when actor cannot manage organization settings", async () => {
    mockCanManageTenant.mockImplementation((): boolean => false)

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      policyCode: string
    }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(body.policyCode).toBe("TENANT_MANAGE_REQUIRED")
  })

  it("updates organization name and metadata", async () => {
    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "  Acme Labs  ",
          metadata: {
            region: "EMEA",
            tier: "enterprise",
          },
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      organization: { name: string; metadata: Record<string, unknown> }
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockUpdateTenantOrganization).toHaveBeenCalledWith({
      organizationId: "org_1",
      name: "Acme Labs",
      metadata: {
        region: "EMEA",
        tier: "enterprise",
      },
    })
    expect(body.organization.name).toBe("Acme Labs")
  })

  it("returns 422 when update payload has no editable fields", async () => {
    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(422)
  })

  it("returns 422 when organization update is rejected", async () => {
    mockUpdateTenantOrganization.mockImplementation(async () => {
      throw new UnprocessableEntityException({
        message: "invalid metadata field",
        code: "unprocessable_entity",
        requestID: "req_1",
        errors: [],
      })
    })

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Acme Labs",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_UPDATE_INVALID")
    expect(body.message.length).toBeGreaterThan(0)
  })

  it("returns 404 when organization update target is not found", async () => {
    mockUpdateTenantOrganization.mockImplementation(async () => {
      throw new NotFoundException({
        message: "organization not found",
        code: "not_found",
        requestID: "req_update_404",
        path: "/tenants/organization",
      })
    })

    const app = await createApp()
    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme Labs" }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_NOT_FOUND")
    expect(body.message).toBe("The organization could not be found.")
  })

  it("returns 500 when organization update fails unexpectedly", async () => {
    mockUpdateTenantOrganization.mockImplementation(async () => {
      throw new Error("upstream unavailable")
    })

    const app = await createApp()
    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme Labs" }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_UPDATE_FAILED")
    expect(body.message).toBe(
      "Unable to update organization settings right now."
    )
  })

  it("blocks delete endpoint for non-owner and non-super-admin actors", async () => {
    mockCanTransferOwnership.mockImplementation((): boolean => false)

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_1",
          confirmOrganizationName: "Acme Co",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      policyCode: string
    }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(body.policyCode).toBe("ORGANIZATION_DELETE_FORBIDDEN")
  })

  it("returns 422 when delete confirmation does not match organization id", async () => {
    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_2",
          confirmOrganizationName: "Acme Co",
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

  it("returns 422 when delete confirmation does not match organization name", async () => {
    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_1",
          confirmOrganizationName: "Wrong Name",
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

  it("returns 404 when organization does not exist before deletion", async () => {
    mockGetTenantOrganizationById.mockImplementation(async () => null)

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_1",
          confirmOrganizationName: "Acme Co",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")
    expect(body.message).toBe("Organization not found.")
  })

  it("returns 500 when organization deletion fails unexpectedly", async () => {
    mockDeleteTenantOrganization.mockImplementation(async () => {
      throw new Error("upstream unavailable")
    })

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_1",
          confirmOrganizationName: "Acme Co",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_DELETE_FAILED")
    expect(body.message).toBe("Unable to delete organization right now.")
  })

  it("returns 404 when delete target disappears before deletion", async () => {
    mockDeleteTenantOrganization.mockImplementation(async () => {
      throw new NotFoundException({
        message: "not found",
        code: "not_found",
        requestID: "req_delete_404",
        path: "/tenants/organization/delete",
      })
    })

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_1",
          confirmOrganizationName: "Acme Co",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_NOT_FOUND")
  })

  it("returns 422 when deletion request is rejected by provider", async () => {
    mockDeleteTenantOrganization.mockImplementation(async () => {
      throw new UnprocessableEntityException({
        message: "cannot delete organization with active dependency",
        code: "unprocessable_entity",
        requestID: "req_delete_422",
        errors: [],
      })
    })

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_1",
          confirmOrganizationName: "Acme Co",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_DELETE_INVALID")
    expect(body.message.length).toBeGreaterThan(0)
  })

  it("deletes organization when confirmation and permissions are valid", async () => {
    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmDeletion: true,
          confirmOrganizationId: "org_1",
          confirmOrganizationName: "Acme Co",
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
    expect(body.organizationId).toBe("org_1")
    expect(mockDeleteTenantOrganization).toHaveBeenCalledWith("org_1")
  })

  it("returns 401 when requireTenantActor fails on update endpoint", async () => {
    mockRequireTenantActor.mockImplementation(((set: { status?: number }) => {
      set.status = 401
      return {
        ok: false,
        error: "UNAUTHORIZED",
        policyCode: "NO_SESSION",
        message: "No active session.",
      } as unknown as TenantActorContext
    }) as unknown as typeof mockRequireTenantActor)

    const app = await createApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/org_1/organization/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme Labs" }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })
})
