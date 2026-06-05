import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import { createTenantsBootstrapRoutes } from "@/modules/tenants/api/routes/tenants-bootstrap.route"
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
  organizationId: null,
  platformRole: "none",
  tenantRole: null,
}

const makeBootstrapMembership = (
  overrides: Partial<TenantBootstrapMembership> = {}
): TenantBootstrapMembership => ({
  organizationId: "org_1",
  organizationName: "Acme",
  status: "active",
  roleSlug: "user_owner",
  ...overrides,
})

const mockRequireTenantActor = mock(
  async (): Promise<MockActor | TenantApiError> => {
    return { ...defaultActor }
  }
)
const mockListTenantBootstrapMembershipsForUser = mock(
  async (): Promise<TenantBootstrapMembership[]> => []
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
type BootstrapRouteDeps = NonNullable<
  Parameters<typeof createTenantsBootstrapRoutes>[0]
>

const toUnauthorizedError = (): TenantApiError => ({
  ok: false,
  error: "UNAUTHORIZED",
  message: "You must be signed in to manage tenants.",
})

const getApp = async () => {
  const deps: BootstrapRouteDeps = {
    requireTenantActor:
      mockRequireTenantActor as BootstrapRouteDeps["requireTenantActor"],
    listTenantBootstrapMembershipsForUser:
      mockListTenantBootstrapMembershipsForUser as BootstrapRouteDeps["listTenantBootstrapMembershipsForUser"],
    createTenantOrganization:
      mockCreateTenantOrganization as unknown as BootstrapRouteDeps["createTenantOrganization"],
    hasBootstrapCreatorRole:
      mockHasBootstrapCreatorRole as BootstrapRouteDeps["hasBootstrapCreatorRole"],
    createTenantMembership:
      mockCreateTenantMembership as unknown as BootstrapRouteDeps["createTenantMembership"],
    deleteTenantOrganization:
      mockDeleteTenantOrganization as BootstrapRouteDeps["deleteTenantOrganization"],
    getBootstrapCreatorRoleSlug:
      mockGetBootstrapCreatorRoleSlug as BootstrapRouteDeps["getBootstrapCreatorRoleSlug"],
  }

  return new Elysia().use(createTenantsBootstrapRoutes(deps))
}

describe("tenants-bootstrap routes", () => {
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
    mockListTenantBootstrapMembershipsForUser.mockImplementation(
      async (): Promise<TenantBootstrapMembership[]> => []
    )
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

  it("creates organization and verifies creator role before returning success", async () => {
    let membershipsReadCount = 0
    mockListTenantBootstrapMembershipsForUser.mockImplementation(async () => {
      membershipsReadCount += 1

      if (membershipsReadCount === 1) {
        return []
      }

      return [
        makeBootstrapMembership({
          organizationId: "org_new",
          organizationName: "Acme",
          roleSlug: "user_owner",
        }),
      ]
    })

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
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

  it("returns memberships for GET /tenants/bootstrap", async () => {
    mockListTenantBootstrapMembershipsForUser.mockImplementation(async () => [
      makeBootstrapMembership({
        organizationId: "org_active",
        organizationName: "Acme Active",
      }),
    ])

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap")
    )
    const body = (await response.json()) as {
      ok: boolean
      currentOrganizationId: string | null
      memberships: TenantBootstrapMembership[]
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.currentOrganizationId).toBeNull()
    expect(body.memberships).toHaveLength(1)
    expect(body.memberships[0]?.organizationId).toBe("org_active")
  })

  it("returns 409 when actor already has organization context", async () => {
    mockRequireTenantActor.mockImplementation(async () => ({
      ...defaultActor,
      organizationId: "org_1",
    }))

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(409)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_CONTEXT_EXISTS")
    expect(mockCreateTenantOrganization).not.toHaveBeenCalled()
  })

  it("returns 422 when bootstrap creator role is missing and rolls back", async () => {
    mockHasBootstrapCreatorRole.mockImplementation(async () => false)

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
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
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
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
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
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
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
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
        requestID: "req_404",
        path: "/tenants/bootstrap",
      })
    })

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
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
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_BOOTSTRAP_FAILED")
  })

  it("rolls back organization when creator role is not valid after membership creation", async () => {
    let membershipsReadCount = 0
    mockListTenantBootstrapMembershipsForUser.mockImplementation(async () => {
      membershipsReadCount += 1

      if (membershipsReadCount === 1) {
        return []
      }

      return [
        makeBootstrapMembership({
          organizationId: "org_new",
          organizationName: "Acme",
          roleSlug: null,
        }),
      ]
    })

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ORGANIZATION_BOOTSTRAP_FAILED")
    expect(mockDeleteTenantOrganization).toHaveBeenCalledWith("org_new")
  })

  it("returns 409 when active membership already exists", async () => {
    mockListTenantBootstrapMembershipsForUser.mockImplementation(async () => [
      makeBootstrapMembership(),
    ])

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(409)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("ACTIVE_MEMBERSHIP_EXISTS")
    expect(mockCreateTenantOrganization).not.toHaveBeenCalled()
  })

  it("returns unauthorized actor failures without creating organization", async () => {
    mockRequireTenantActor.mockImplementation(async () => toUnauthorizedError())

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Acme" }),
      })
    )
    const body = (await response.json()) as TenantApiError

    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
    expect(mockCreateTenantOrganization).not.toHaveBeenCalled()
  })

  it("returns unauthorized actor failures for GET /tenants/bootstrap", async () => {
    mockRequireTenantActor.mockImplementation(async () => toUnauthorizedError())

    const app = await getApp()

    const response = await app.handle(
      new Request("http://localhost/tenants/bootstrap")
    )
    const body = (await response.json()) as TenantApiError

    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 401 status when requireTenantActor fails on GET", async () => {
    mockRequireTenantActor.mockImplementation(
      async (set: { status?: number }) => {
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
      new Request("http://localhost/tenants/bootstrap")
    )
    const body = (await response.json()) as TenantApiError

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })
})
