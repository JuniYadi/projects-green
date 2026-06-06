import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import { createTenantsOrganizationsRoutes } from "@/modules/tenants/api/routes/tenants-organizations.route"
import type {
  TenantApiError,
  TenantBootstrapMembership,
} from "@/modules/tenants/contracts/tenant-api.contract"

type MockActor = {
  userId: string
  organizationId: string | null
  platformRole: "none" | "super_admin"
  tenantRole: "owner" | "admin" | "member" | null
}

const defaultActor: MockActor = {
  userId: "user_1",
  organizationId: "org_current",
  platformRole: "none",
  tenantRole: "member",
}

const makeBootstrapMembership = (
  overrides: Partial<TenantBootstrapMembership> = {}
): TenantBootstrapMembership => ({
  organizationId: "org_new",
  organizationName: "Acme New",
  status: "active",
  roleSlug: "user_owner",
  ...overrides,
})

const mockRequireTenantActor = mock(
  async (set?: { status?: number }): Promise<MockActor | TenantApiError> => {
    void set
    return { ...defaultActor }
  }
)
const mockListTenantBootstrapMembershipsForUser = mock(
  async (): Promise<TenantBootstrapMembership[]> => [
    makeBootstrapMembership(),
  ]
)
const mockCreateTenantOrganization = mock(async () => ({
  id: "org_new",
  object: "organization",
  name: "Acme",
  allowProfilesOutsideOrganization: false,
  domains: [],
  metadata: {},
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
  externalId: null,
}))
const mockHasBootstrapCreatorRole = mock(async () => true)
const mockCreateTenantMembership = mock(
  async (params: {
    organizationId: string
    userId: string
    roleSlug: string
  }) => ({
    id: "mem_new",
    object: "organization_membership",
    organizationId: params.organizationId,
    organizationName: "Acme",
    userId: params.userId,
    status: "active",
    role: { slug: "user_owner" },
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
  })
)
const mockDeleteTenantOrganization = mock(async () => undefined)
const mockGetBootstrapCreatorRoleSlug = mock(() => "user_owner")

type OrganizationsRouteDeps = NonNullable<
  Parameters<typeof createTenantsOrganizationsRoutes>[0]
>

const toUnauthorizedError = (): TenantApiError => ({
  ok: false,
  error: "UNAUTHORIZED",
  message: "You must be signed in to manage tenants.",
})

const getApp = async () => {
  const deps: OrganizationsRouteDeps = {
    requireTenantActor:
      mockRequireTenantActor as OrganizationsRouteDeps["requireTenantActor"],
    listTenantBootstrapMembershipsForUser:
      mockListTenantBootstrapMembershipsForUser as OrganizationsRouteDeps["listTenantBootstrapMembershipsForUser"],
    createTenantOrganization:
      mockCreateTenantOrganization as unknown as OrganizationsRouteDeps["createTenantOrganization"],
    hasBootstrapCreatorRole:
      mockHasBootstrapCreatorRole as OrganizationsRouteDeps["hasBootstrapCreatorRole"],
    createTenantMembership:
      mockCreateTenantMembership as unknown as OrganizationsRouteDeps["createTenantMembership"],
    deleteTenantOrganization:
      mockDeleteTenantOrganization as OrganizationsRouteDeps["deleteTenantOrganization"],
    getBootstrapCreatorRoleSlug:
      mockGetBootstrapCreatorRoleSlug as OrganizationsRouteDeps["getBootstrapCreatorRoleSlug"],
  }

  return new Elysia().use(createTenantsOrganizationsRoutes(deps))
}

describe("tenants-organizations routes", () => {
  beforeEach(() => {
    mockRequireTenantActor.mockReset()
    mockListTenantBootstrapMembershipsForUser.mockReset()
    mockCreateTenantOrganization.mockReset()
    mockHasBootstrapCreatorRole.mockReset()
    mockCreateTenantMembership.mockReset()
    mockDeleteTenantOrganization.mockReset()
    mockGetBootstrapCreatorRoleSlug.mockReset()

    mockRequireTenantActor.mockImplementation(
      async (): Promise<MockActor | TenantApiError> => {
        return { ...defaultActor }
      }
    )
    mockListTenantBootstrapMembershipsForUser.mockImplementation(async () => [
      makeBootstrapMembership(),
    ])
    mockCreateTenantOrganization.mockImplementation(async () => ({
      id: "org_new",
      object: "organization",
      name: "Acme",
      allowProfilesOutsideOrganization: false,
      domains: [],
      metadata: {},
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
      externalId: null,
    }))
    mockHasBootstrapCreatorRole.mockImplementation(async () => true)
    mockCreateTenantMembership.mockImplementation(
      async (params: {
        organizationId: string
        userId: string
        roleSlug: string
      }) => ({
        id: "mem_new",
        object: "organization_membership",
        organizationId: params.organizationId,
        organizationName: "Acme",
        userId: params.userId,
        status: "active",
        role: { slug: "user_owner" },
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      })
    )
    mockDeleteTenantOrganization.mockImplementation(async () => undefined)
    mockGetBootstrapCreatorRoleSlug.mockImplementation(() => "user_owner")
  })

  it("creates organization while user already has active context", async () => {
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      organizationId: string
    }

    expect(response.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.organizationId).toBe("org_new")
    expect(mockCreateTenantMembership).toHaveBeenCalledWith({
      organizationId: "org_new",
      userId: "user_1",
      roleSlug: "user_owner",
    })
  })

  it("returns 422 when payload validation fails", async () => {
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "" }),
      })
    )

    expect(response.status).toBe(422)
    expect(mockCreateTenantOrganization).not.toHaveBeenCalled()
  })

  it("returns 422 when creator role is missing and rolls back", async () => {
    mockHasBootstrapCreatorRole.mockImplementation(async () => false)
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("CREATOR_ROLE_MISSING")
    expect(mockDeleteTenantOrganization).toHaveBeenCalledWith("org_new")
  })

  it("returns 500 when membership creation fails and rolls back", async () => {
    mockCreateTenantMembership.mockImplementation(async () => {
      throw new Error("membership failure")
    })
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_BOOTSTRAP_FAILED")
    expect(mockDeleteTenantOrganization).toHaveBeenCalledWith("org_new")
  })

  it("returns conflict when organization creation raises ConflictException", async () => {
    mockCreateTenantOrganization.mockImplementation(async () => {
      throw new ConflictException({
        message: "conflict",
        code: "conflict",
        requestID: "req_conflict",
      })
    })
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(409)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_CONFLICT")
  })

  it("returns 422 when organization creation raises UnprocessableEntityException", async () => {
    mockCreateTenantOrganization.mockImplementation(async () => {
      throw new UnprocessableEntityException({
        message: "invalid organization",
        code: "unprocessable_entity",
        requestID: "req_422",
        errors: [],
      })
    })
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_BOOTSTRAP_INVALID")
  })

  it("returns 404 when organization creation raises NotFoundException", async () => {
    mockCreateTenantOrganization.mockImplementation(async () => {
      throw new NotFoundException({
        message: "missing dependency",
        code: "not_found",
        path: "/organizations/create",
        requestID: "req_404",
      })
    })
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_BOOTSTRAP_NOT_FOUND")
  })

  it("returns 500 when organization creation throws unknown error", async () => {
    mockCreateTenantOrganization.mockImplementation(async () => {
      throw new Error("unexpected")
    })
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_BOOTSTRAP_FAILED")
  })

  it("returns unauthorized actor failures without creating organization", async () => {
    mockRequireTenantActor.mockImplementation(async () => toUnauthorizedError())
    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
    expect(mockCreateTenantOrganization).not.toHaveBeenCalled()
  })

  it("returns 401 status when requireTenantActor returns error", async () => {
    mockRequireTenantActor.mockImplementation(
      async (...args: unknown[]) => {
        const set = args[0] as { status?: number }
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          policyCode: "NO_SESSION",
          message: "No active session.",
        } as TenantApiError
      }
    )

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme New" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
    expect(mockCreateTenantOrganization).not.toHaveBeenCalled()
  })
})
