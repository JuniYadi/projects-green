import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import { createTenantOrganizationWithCreator } from "./tenants-create-organization.shared"
import type { TenantCreateOrganizationDeps } from "./tenants-create-organization.shared"
import type { TenantBootstrapMembership } from "@/modules/tenants/contracts/tenant-api.contract"

const makeMembership = (
  overrides: Partial<TenantBootstrapMembership> = {}
): TenantBootstrapMembership => ({
  organizationId: "org_created_1",
  organizationName: "Acme",
  status: "active",
  roleSlug: "user_owner",
  ...overrides,
})

const mockCreateTenantOrganization = mock(async () => ({
  id: "org_created_1",
  object: "organization",
  name: "Acme",
  allowProfilesOutsideOrganization: false,
  domains: [],
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  externalId: null,
}))
const mockHasBootstrapCreatorRole = mock(async () => true)
const mockCreateTenantMembership = mock(
  async (params: { organizationId: string; userId: string; roleSlug: string }) => ({
    id: "mem_new",
    object: "organization_membership",
    organizationId: params.organizationId,
    organizationName: "Acme",
    userId: params.userId,
    status: "active",
    role: { slug: params.roleSlug },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
)
const mockDeleteTenantOrganization = mock(async () => undefined)
const mockGetBootstrapCreatorRoleSlug = mock(() => "user_owner")
const mockListTenantBootstrapMembershipsForUser = mock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (userId: string): Promise<TenantBootstrapMembership[]> => [makeMembership()]
)

const makeDeps = (overrides: Partial<TenantCreateOrganizationDeps> = {}): TenantCreateOrganizationDeps => ({
  createTenantOrganization: mockCreateTenantOrganization as unknown as TenantCreateOrganizationDeps["createTenantOrganization"],
  hasBootstrapCreatorRole: mockHasBootstrapCreatorRole as TenantCreateOrganizationDeps["hasBootstrapCreatorRole"],
  createTenantMembership: mockCreateTenantMembership as unknown as TenantCreateOrganizationDeps["createTenantMembership"],
  deleteTenantOrganization: mockDeleteTenantOrganization as TenantCreateOrganizationDeps["deleteTenantOrganization"],
  getBootstrapCreatorRoleSlug: mockGetBootstrapCreatorRoleSlug as TenantCreateOrganizationDeps["getBootstrapCreatorRoleSlug"],
  listTenantBootstrapMembershipsForUser: mockListTenantBootstrapMembershipsForUser as TenantCreateOrganizationDeps["listTenantBootstrapMembershipsForUser"],
  ...overrides,
})

const makeSet = () => ({ status: 200 })

beforeEach(() => {
  mockCreateTenantOrganization.mockReset()
  mockHasBootstrapCreatorRole.mockReset()
  mockCreateTenantMembership.mockReset()
  mockDeleteTenantOrganization.mockReset()
  mockGetBootstrapCreatorRoleSlug.mockReset()
  mockListTenantBootstrapMembershipsForUser.mockReset()

  mockCreateTenantOrganization.mockImplementation(async () => ({
    id: "org_created_1",
    object: "organization",
    name: "Acme",
    allowProfilesOutsideOrganization: false,
    domains: [],
    metadata: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    externalId: null,
  }))
  mockHasBootstrapCreatorRole.mockImplementation(async () => true)
  mockCreateTenantMembership.mockImplementation(
    async (params: { organizationId: string; userId: string; roleSlug: string }) => ({
      id: "mem_new",
      object: "organization_membership",
      organizationId: params.organizationId,
      organizationName: "Acme",
      userId: params.userId,
      status: "active",
      role: { slug: params.roleSlug },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
  )
  mockDeleteTenantOrganization.mockImplementation(async () => undefined)
  mockGetBootstrapCreatorRoleSlug.mockImplementation(() => "user_owner")
  mockListTenantBootstrapMembershipsForUser.mockImplementation(
    async (userId: string): Promise<TenantBootstrapMembership[]> => [makeMembership()]
  )
})

describe("createTenantOrganizationWithCreator", () => {
  it("creates organization and membership successfully (owner verified)", async () => {
    const set = makeSet()

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "  Acme Corp  ",
      deps: makeDeps(),
    })

    expect(result).toEqual({ ok: true, organizationId: "org_created_1" })
    expect(set.status).toBe(201)

    expect(mockCreateTenantOrganization).toHaveBeenCalledWith("Acme Corp")
    expect(mockCreateTenantMembership).toHaveBeenCalledWith({
      organizationId: "org_created_1",
      userId: "user_1",
      roleSlug: "user_owner",
    })
  })

  it("rolls back when creator role is not available (CREATOR_ROLE_MISSING)", async () => {
    const set = makeSet()
    mockHasBootstrapCreatorRole.mockResolvedValueOnce(false)

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "No Creator",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "CREATOR_ROLE_MISSING",
      message: expect.stringContaining("user_owner"),
    })
    expect(set.status).toBe(422)
    expect(mockDeleteTenantOrganization).toHaveBeenCalledWith("org_created_1")
  })

  it("returns ROLLBACK_FAILED when delete fails after CREATOR_ROLE_MISSING", async () => {
    const set = makeSet()
    mockHasBootstrapCreatorRole.mockResolvedValueOnce(false)
    mockDeleteTenantOrganization.mockRejectedValueOnce(new Error("Delete failed"))

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Rollback Fail",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ROLLBACK_FAILED",
      message: expect.stringContaining("org_created_1"),
    })
    expect(set.status).toBe(500)
  })

  it("returns error when creator membership cannot be verified after retries", async () => {
    const set = makeSet()
    // Return a membership that IS active but has a non-owner role
    mockListTenantBootstrapMembershipsForUser.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (userId: string): Promise<TenantBootstrapMembership[]> => [
        makeMembership({ roleSlug: "user_admin" }),
      ]
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Verify Fail",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_BOOTSTRAP_FAILED",
      message: "Unable to create organization right now.",
    })
    expect(set.status).toBe(500)
    // Should have tried the verification loop (4 attempts)
    expect(mockListTenantBootstrapMembershipsForUser).toHaveBeenCalled()
  })

  it("returns ROLLBACK_FAILED when delete fails after membership verification fails", async () => {
    const set = makeSet()
    mockListTenantBootstrapMembershipsForUser.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (userId: string): Promise<TenantBootstrapMembership[]> => [
        makeMembership({ roleSlug: "user_admin" }),
      ]
    )
    mockDeleteTenantOrganization.mockRejectedValueOnce(new Error("Delete failed"))

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Verify Rollback",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ROLLBACK_FAILED",
      message: expect.stringContaining("org_created_1"),
    })
    expect(set.status).toBe(500)
  })

  it("handles ConflictException during membership creation", async () => {
    const set = makeSet()
    mockCreateTenantMembership.mockRejectedValueOnce(
      new ConflictException({ message: "Organization already exists", requestID: "req_1" })
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Conflict",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_CONFLICT",
      message: expect.stringContaining("conflict"),
    })
    expect(set.status).toBe(409)
  })

  it("handles UnprocessableEntityException during membership creation", async () => {
    const set = makeSet()
    mockCreateTenantMembership.mockRejectedValueOnce(
      new UnprocessableEntityException({ message: "Invalid role assignment", requestID: "req_1" })
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Invalid",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_BOOTSTRAP_INVALID",
      message: expect.any(String),
    })
    expect(set.status).toBe(422)
  })

  it("handles NotFoundException during membership creation", async () => {
    const set = makeSet()
    mockCreateTenantMembership.mockRejectedValueOnce(
      new NotFoundException({ message: "User or organization not found", path: "/members", requestID: "req_1" })
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Not Found",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_BOOTSTRAP_NOT_FOUND",
      message: expect.stringContaining("WorkOS resource"),
    })
    expect(set.status).toBe(404)
  })

  it("handles generic error during membership creation", async () => {
    const set = makeSet()
    mockCreateTenantMembership.mockRejectedValueOnce(
      new Error("Network timeout")
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Generic",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_BOOTSTRAP_FAILED",
      message: "Unable to create organization right now.",
    })
    expect(set.status).toBe(500)
  })

  it("handles ConflictException from createTenantOrganization (top-level)", async () => {
    const set = makeSet()
    mockCreateTenantOrganization.mockRejectedValueOnce(
      new ConflictException({ message: "Organization name taken", requestID: "req_1" })
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Taken",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_CONFLICT",
      message: expect.stringContaining("conflict"),
    })
    expect(set.status).toBe(409)
  })

  it("handles UnprocessableEntityException from createTenantOrganization (top-level)", async () => {
    const set = makeSet()
    mockCreateTenantOrganization.mockRejectedValueOnce(
      new UnprocessableEntityException({ message: "Invalid org name", requestID: "req_1" })
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Bad Name",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_BOOTSTRAP_INVALID",
      message: expect.any(String),
    })
    expect(set.status).toBe(422)
  })

  it("handles NotFoundException from createTenantOrganization (top-level)", async () => {
    const set = makeSet()
    mockCreateTenantOrganization.mockRejectedValueOnce(
      new NotFoundException({ message: "WorkOS resource missing", path: "/organizations", requestID: "req_1" })
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Missing",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_BOOTSTRAP_NOT_FOUND",
      message: expect.stringContaining("WorkOS resource"),
    })
    expect(set.status).toBe(404)
  })

  it("handles generic error from createTenantOrganization (top-level)", async () => {
    const set = makeSet()
    mockCreateTenantOrganization.mockRejectedValueOnce(
      new Error("Unexpected server error")
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Unexpected",
      deps: makeDeps(),
    })

    expect(result).toEqual({
      ok: false,
      error: "ORGANIZATION_BOOTSTRAP_FAILED",
      message: "Unable to create organization right now.",
    })
    expect(set.status).toBe(500)
  })

  it("verifies bootstrap role for raw slug 'bootstrap'", async () => {
    const set = makeSet()
    mockListTenantBootstrapMembershipsForUser.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (userId: string): Promise<TenantBootstrapMembership[]> => [
        makeMembership({ roleSlug: "bootstrap" }),
      ]
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "Bootstrap",
      deps: makeDeps(),
    })

    expect(result).toEqual({ ok: true, organizationId: "org_created_1" })
    expect(set.status).toBe(201)
  })

  it("verifies bootstrap role for raw slug 'user_bootstrap'", async () => {
    const set = makeSet()
    mockListTenantBootstrapMembershipsForUser.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (userId: string): Promise<TenantBootstrapMembership[]> => [
        makeMembership({ roleSlug: "user_bootstrap" }),
      ]
    )

    const result = await createTenantOrganizationWithCreator({
      set,
      userId: "user_1",
      organizationName: "User Bootstrap",
      deps: makeDeps(),
    })

    expect(result).toEqual({ ok: true, organizationId: "org_created_1" })
    expect(set.status).toBe(201)
  })
})
