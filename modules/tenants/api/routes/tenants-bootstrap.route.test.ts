import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createTenantsBootstrapRoutes } from "@/modules/tenants/api/routes/tenants-bootstrap.route"
import type {
  TenantApiError,
  TenantBootstrapMembership,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { RouteSet } from "@/modules/tenants/api/tenants.errors"

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
  async (_set: RouteSet): Promise<MockActor | TenantApiError> => {
    return { ...defaultActor }
  }
)
const mockListTenantBootstrapMembershipsForUser = mock(
  async (_userId: string): Promise<TenantBootstrapMembership[]> => []
)
const mockCreateTenantOrganization = mock(async (_name: string) => ({
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
      async (_set: RouteSet): Promise<MockActor | TenantApiError> => {
        return { ...defaultActor }
      }
    )
    mockListTenantBootstrapMembershipsForUser.mockImplementation(
      async (_userId: string): Promise<TenantBootstrapMembership[]> => []
    )
    mockCreateTenantOrganization.mockImplementation(async (_name: string) => ({
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
})
