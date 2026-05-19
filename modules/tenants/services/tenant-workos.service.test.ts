/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NotFoundException } from "@workos-inc/node"

const mockAutoPagination = mock(async () => [])
const mockListOrganizationMemberships = mock(async () => ({
  autoPagination: mockAutoPagination,
}))
const mockGetOrganizationMembership = mock(async () => null)
const mockListInvitations = mock(async () => ({ autoPagination: mockAutoPagination }))
const mockSendInvitation = mock(async () => null)
const mockGetInvitation = mock(async () => null)
let mockRevokeInvitation: ReturnType<typeof mock> | undefined = mock(
  async () => null
)
let mockResendInvitation: ReturnType<typeof mock> | undefined = mock(
  async () => null
)
const mockUpdateOrganizationMembership = mock(async () => null)
const mockDeleteOrganizationMembership = mock(async () => undefined)
const mockCreateOrganizationMembership = mock(async () => null)

const mockListOrganizationRoles = mock(async () => ({
  autoPagination: mockAutoPagination,
}))

const mockCreateOrganization = mock(async () => null)
const mockDeleteOrganization = mock(async () => undefined)
const mockGetOrganization = mock(async () => null)
const mockUpdateOrganization = mock(async () => null)

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
      getOrganizationMembership: mockGetOrganizationMembership,
      listInvitations: mockListInvitations,
      sendInvitation: mockSendInvitation,
      getInvitation: mockGetInvitation,
      ...(mockRevokeInvitation
        ? { revokeInvitation: mockRevokeInvitation }
        : {}),
      ...(mockResendInvitation
        ? { resendInvitation: mockResendInvitation }
        : {}),
      updateOrganizationMembership: mockUpdateOrganizationMembership,
      deleteOrganizationMembership: mockDeleteOrganizationMembership,
      createOrganizationMembership: mockCreateOrganizationMembership,
    },
    authorization: {
      listOrganizationRoles: mockListOrganizationRoles,
    },
    organizations: {
      createOrganization: mockCreateOrganization,
      deleteOrganization: mockDeleteOrganization,
      getOrganization: mockGetOrganization,
      updateOrganization: mockUpdateOrganization,
    },
  }),
  withAuth: async () => ({
    user: null,
    organizationId: null,
  }),
}))

const {
  toScopedTenantRoleSlug,
  getBootstrapCreatorRoleSlug,
  listTenantMemberships,
  getTenantMembershipById,
  listTenantBootstrapMembershipsForUser,
  hasBootstrapCreatorRole,
  createTenantOrganization,
  deleteTenantOrganization,
  createTenantMembership,
  listTenantInvitations,
  sendTenantInvitation,
  getTenantInvitationById,
  revokeTenantInvitation,
  cancelTenantInvitation,
  resendTenantInvitation,
  updateTenantMembershipRole,
  deleteTenantMembership,
  demoteTenantMembershipSafely,
  deleteTenantMembershipSafely,
  getTenantOrganizationById,
  updateTenantOrganization,
  isActiveOwnerMembership,
} = await import("@/modules/tenants/services/tenant-workos.service")

const { TenantWorkOSOperationUnsupportedError } = await import(
  "@/modules/tenants/services/tenant-workos.errors"
)

type MembershipFixture = {
  id: string
  organizationId: string
  organizationName: string
  userId: string
  status: string
  createdAt: string
  updatedAt: string
  role?: { slug?: string | null } | null
  user?: {
    email?: string | null
    firstName?: string | null
    lastName?: string | null
    profilePictureUrl?: string | null
  } | null
}

const makeMembership = (
  overrides: Partial<MembershipFixture> = {}
): MembershipFixture => ({
  id: "mem_1",
  organizationId: "org_1",
  organizationName: "Acme",
  userId: "user_1",
  status: "active",
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
  role: {
    slug: "user_member",
  },
  user: null,
  ...overrides,
})

const makeInvitation = (overrides: Record<string, unknown> = {}) => ({
  id: "inv_1",
  email: "member@example.com",
  state: "pending",
  organizationId: "org_1",
  inviterUserId: "user_1",
  acceptedUserId: null,
  roleSlug: "user_member",
  createdAt: "2026-05-17T00:00:00.000Z",
  expiresAt: "2026-05-18T00:00:00.000Z",
  ...overrides,
})

const makeOrganization = (overrides: Record<string, unknown> = {}) => ({
  id: "org_1",
  name: "Acme",
  metadata: { region: "apac", seats: 20 },
  allowProfilesOutsideOrganization: true,
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-18T00:00:00.000Z",
  ...overrides,
})

beforeEach(() => {
  mockAutoPagination.mockReset()
  mockListOrganizationMemberships.mockReset()
  mockGetOrganizationMembership.mockReset()
  mockListInvitations.mockReset()
  mockSendInvitation.mockReset()
  mockGetInvitation.mockReset()
  mockUpdateOrganizationMembership.mockReset()
  mockDeleteOrganizationMembership.mockReset()
  mockCreateOrganizationMembership.mockReset()
  mockListOrganizationRoles.mockReset()
  mockCreateOrganization.mockReset()
  mockDeleteOrganization.mockReset()
  mockGetOrganization.mockReset()
  mockUpdateOrganization.mockReset()

  mockRevokeInvitation = mock(async () => makeInvitation())
  mockResendInvitation = mock(async () => makeInvitation({ state: "sent" }))

  mockAutoPagination.mockImplementation(async () => [])
  mockListOrganizationMemberships.mockImplementation(async () => ({
    autoPagination: mockAutoPagination,
  }))
  mockListInvitations.mockImplementation(async () => ({
    autoPagination: mockAutoPagination,
  }))
  mockListOrganizationRoles.mockImplementation(async () => ({
    autoPagination: mockAutoPagination,
  }))
})

describe("tenant-workos service", () => {
  it("maps scoped role slugs and bootstrap role slug", () => {
    expect(toScopedTenantRoleSlug("owner")).toBe("user_owner")
    expect(toScopedTenantRoleSlug("admin")).toBe("user_admin")
    expect(toScopedTenantRoleSlug("member")).toBe("user_member")
    expect(getBootstrapCreatorRoleSlug()).toBe("user_owner")
  })

  it("returns stable member identity fields from profile data", async () => {
    mockAutoPagination.mockImplementation(async () => [
      makeMembership({
        id: "mem_profile",
        userId: "user_profile",
        user: {
          firstName: " Jane ",
          lastName: " Doe ",
          email: " jane@example.com ",
          profilePictureUrl: " https://example.com/jane.png ",
        },
      }),
    ])

    const memberships = await listTenantMemberships("org_1")

    expect(mockListOrganizationMemberships).toHaveBeenCalledWith({
      organizationId: "org_1",
      statuses: ["active", "inactive", "pending"],
    })
    expect(memberships[0]?.displayName).toBe("Jane Doe")
    expect(memberships[0]?.email).toBe("jane@example.com")
    expect(memberships[0]?.avatarUrl).toBe("https://example.com/jane.png")
  })

  it("falls back to userId when profile data is missing", async () => {
    mockAutoPagination.mockImplementation(async () => [
      makeMembership({
        id: "mem_email_fallback",
        userId: "member@example.com",
        user: null,
      }),
      makeMembership({
        id: "mem_name_fallback",
        userId: "user_external_123",
        user: null,
      }),
    ])

    const memberships = await listTenantMemberships("org_1")

    expect(memberships[0]?.displayName).toBe("member@example.com")
    expect(memberships[0]?.email).toBe("member@example.com")
    expect(memberships[0]?.avatarUrl).toBeNull()

    expect(memberships[1]?.displayName).toBe("user_external_123")
    expect(memberships[1]?.email).toBeNull()
    expect(memberships[1]?.avatarUrl).toBeNull()
  })

  it("returns null on not found membership lookup and rethrows unknown errors", async () => {
    mockGetOrganizationMembership.mockImplementationOnce(async () => {
      throw new NotFoundException("missing")
    })

    await expect(getTenantMembershipById("mem_missing")).resolves.toBeNull()

    mockGetOrganizationMembership.mockImplementationOnce(async () => {
      throw new Error("boom")
    })

    await expect(getTenantMembershipById("mem_error")).rejects.toThrow("boom")
  })

  it("lists bootstrap memberships for user", async () => {
    mockAutoPagination.mockImplementation(async () => [
      makeMembership({ role: { slug: "user_admin" } }),
      makeMembership({
        id: "mem_2",
        organizationId: "org_2",
        organizationName: "Orbit",
        status: "pending",
        role: null,
      }),
    ])

    const result = await listTenantBootstrapMembershipsForUser("user_1")

    expect(mockListOrganizationMemberships).toHaveBeenCalledWith({
      userId: "user_1",
      statuses: ["active", "pending"],
    })
    expect(result).toEqual([
      {
        organizationId: "org_1",
        organizationName: "Acme",
        status: "active",
        roleSlug: "user_admin",
      },
      {
        organizationId: "org_2",
        organizationName: "Orbit",
        status: "pending",
        roleSlug: null,
      },
    ])
  })

  it("supports role listing via autoPagination and legacy data", async () => {
    mockListOrganizationRoles.mockImplementationOnce(async () => ({
      autoPagination: async () => [{ slug: " USER_OWNER " }, { slug: null }],
    }))

    await expect(hasBootstrapCreatorRole("org_1")).resolves.toBe(true)

    mockListOrganizationRoles.mockImplementationOnce(async () => ({
      data: [{ slug: "user_member" }],
    }))

    await expect(hasBootstrapCreatorRole("org_1")).resolves.toBe(false)
  })

  it("creates and deletes organizations and memberships", async () => {
    mockCreateOrganization.mockImplementationOnce(async () =>
      makeOrganization({ id: "org_new" })
    )
    mockCreateOrganizationMembership.mockImplementationOnce(async () =>
      makeMembership({ id: "mem_new" })
    )

    const org = await createTenantOrganization("Acme New")
    expect(org).toMatchObject({ id: "org_new" })
    expect(mockCreateOrganization).toHaveBeenCalledWith({ name: "Acme New" })

    await deleteTenantOrganization("org_new")
    expect(mockDeleteOrganization).toHaveBeenCalledWith("org_new")

    await createTenantMembership({
      organizationId: "org_new",
      userId: "user_1",
      roleSlug: "user_member",
    })
    expect(mockCreateOrganizationMembership).toHaveBeenCalledWith({
      organizationId: "org_new",
      userId: "user_1",
      roleSlug: "user_member",
    })
  })

  it("covers invitation list/send/get/cancel/revoke/resend and unsupported ops", async () => {
    mockAutoPagination.mockImplementation(async () => [
      makeInvitation(),
      makeInvitation({ id: "inv_2", email: "other@example.com" }),
    ])

    const list = await listTenantInvitations("org_1")
    expect(list).toHaveLength(2)

    mockSendInvitation.mockImplementationOnce(async () =>
      makeInvitation({
        id: "inv_created",
        roleSlug: "user_admin",
      })
    )
    const created = await sendTenantInvitation({
      email: "new@example.com",
      organizationId: "org_1",
      inviterUserId: "user_1",
      targetRole: "admin",
    })
    expect(created.roleSlug).toBe("user_admin")

    mockGetInvitation.mockImplementationOnce(async () => {
      throw new NotFoundException("missing")
    })
    await expect(getTenantInvitationById("inv_missing")).resolves.toBeNull()

    mockGetInvitation.mockImplementationOnce(async () => {
      throw new Error("unexpected")
    })
    await expect(getTenantInvitationById("inv_error")).rejects.toThrow(
      "unexpected"
    )

    const canceled = await cancelTenantInvitation("inv_1")
    expect(canceled.id).toBe("inv_1")

    const revoked = await revokeTenantInvitation("inv_1")
    expect(revoked.id).toBe("inv_1")

    const resent = await resendTenantInvitation("inv_1")
    expect(resent.state).toBe("sent")

    mockRevokeInvitation = undefined
    await expect(cancelTenantInvitation("inv_2")).rejects.toThrow(
      TenantWorkOSOperationUnsupportedError
    )

    mockResendInvitation = undefined
    await expect(resendTenantInvitation("inv_2")).rejects.toThrow(
      TenantWorkOSOperationUnsupportedError
    )
  })

  it("updates and deletes memberships", async () => {
    mockUpdateOrganizationMembership.mockImplementationOnce(async () =>
      makeMembership({
        id: "mem_target",
        role: { slug: "user_admin" },
      })
    )

    const updated = await updateTenantMembershipRole("mem_target", "admin")
    expect(updated.role).toBe("admin")
    expect(mockUpdateOrganizationMembership).toHaveBeenCalledWith("mem_target", {
      roleSlug: "user_admin",
    })

    await deleteTenantMembership("mem_target")
    expect(mockDeleteOrganizationMembership).toHaveBeenCalledWith("mem_target")
  })

  it("demotes memberships safely across owner and non-owner branches", async () => {
    mockUpdateOrganizationMembership.mockImplementation(async () =>
      makeMembership({ role: { slug: "user_member" } })
    )

    const nonOwner = await demoteTenantMembershipSafely({
      membershipId: "mem_1",
      organizationId: "org_1",
      targetMembership: {
        ...(await listTenantMemberships("org_1")).at(0),
        id: "mem_1",
        organizationId: "org_1",
        userId: "user_2",
        displayName: "User",
        email: null,
        avatarUrl: null,
        status: "active",
        role: "member",
        roleSlug: "user_member",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      actorUserId: "actor_1",
    })
    expect(nonOwner.success).toBe(true)

    mockGetOrganizationMembership.mockImplementation(async () =>
      makeMembership({
        id: "mem_owner",
        userId: "actor_1",
        role: { slug: "user_owner" },
      })
    )
    mockAutoPagination.mockImplementation(async () => [
      makeMembership({
        id: "mem_owner",
        userId: "actor_1",
        role: { slug: "user_owner" },
      }),
    ])

    const selfBlocked = await demoteTenantMembershipSafely({
      membershipId: "mem_owner",
      organizationId: "org_1",
      targetMembership: {
        id: "mem_owner",
        organizationId: "org_1",
        userId: "actor_1",
        displayName: "Owner",
        email: null,
        avatarUrl: null,
        status: "active",
        role: "owner",
        roleSlug: "user_owner",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      actorUserId: "actor_1",
    })
    expect(selfBlocked).toEqual({
      success: false,
      reason: "SELF_DEMOTION_BLOCKED",
    })

    mockAutoPagination.mockImplementation(async () => [
      makeMembership({ id: "mem_owner", role: { slug: "user_owner" } }),
      makeMembership({
        id: "mem_owner_2",
        userId: "user_2",
        role: { slug: "user_owner" },
      }),
    ])

    const ownerDemoted = await demoteTenantMembershipSafely({
      membershipId: "mem_owner",
      organizationId: "org_1",
      targetMembership: {
        id: "mem_owner",
        organizationId: "org_1",
        userId: "user_1",
        displayName: "Owner",
        email: null,
        avatarUrl: null,
        status: "active",
        role: "owner",
        roleSlug: "user_owner",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      actorUserId: "actor_2",
    })

    expect(ownerDemoted.success).toBe(true)
  })

  it("deletes memberships safely across owner and non-owner branches", async () => {
    const nonOwnerDeleted = await deleteTenantMembershipSafely({
      membershipId: "mem_member",
      organizationId: "org_1",
      targetMembership: {
        id: "mem_member",
        organizationId: "org_1",
        userId: "user_2",
        displayName: "Member",
        email: null,
        avatarUrl: null,
        status: "active",
        role: "member",
        roleSlug: "user_member",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
    })
    expect(nonOwnerDeleted).toEqual({ success: true })

    mockGetOrganizationMembership.mockImplementation(async () =>
      makeMembership({
        id: "mem_owner",
        userId: "actor_1",
        role: { slug: "user_owner" },
      })
    )
    mockAutoPagination.mockImplementation(async () => [
      makeMembership({
        id: "mem_owner",
        userId: "actor_1",
        role: { slug: "user_owner" },
      }),
    ])

    const selfLeaveBlocked = await deleteTenantMembershipSafely({
      membershipId: "mem_owner",
      organizationId: "org_1",
      targetMembership: {
        id: "mem_owner",
        organizationId: "org_1",
        userId: "actor_1",
        displayName: "Owner",
        email: null,
        avatarUrl: null,
        status: "active",
        role: "owner",
        roleSlug: "user_owner",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      actorUserId: "actor_1",
    })

    expect(selfLeaveBlocked).toEqual({
      success: false,
      reason: "SELF_LEAVE_BLOCKED",
    })

    mockAutoPagination.mockImplementation(async () => [
      makeMembership({ id: "mem_owner", role: { slug: "user_owner" } }),
      makeMembership({
        id: "mem_owner_2",
        userId: "user_2",
        role: { slug: "user_owner" },
      }),
    ])

    const ownerDeleted = await deleteTenantMembershipSafely({
      membershipId: "mem_owner",
      organizationId: "org_1",
      targetMembership: {
        id: "mem_owner",
        organizationId: "org_1",
        userId: "owner_1",
        displayName: "Owner",
        email: null,
        avatarUrl: null,
        status: "active",
        role: "owner",
        roleSlug: "user_owner",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      actorUserId: "admin_1",
    })

    expect(ownerDeleted).toEqual({ success: true })
  })

  it("maps and updates organization summaries", async () => {
    mockGetOrganization.mockImplementationOnce(async () =>
      makeOrganization({ metadata: { region: "apac", seats: 20 } })
    )

    const org = await getTenantOrganizationById("org_1")
    expect(org).toEqual({
      id: "org_1",
      name: "Acme",
      metadata: { region: "apac" },
      allowProfilesOutsideOrganization: true,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-18T00:00:00.000Z",
    })

    mockGetOrganization.mockImplementationOnce(async () => {
      throw new NotFoundException("missing")
    })
    await expect(getTenantOrganizationById("org_missing")).resolves.toBeNull()

    mockGetOrganization.mockImplementationOnce(async () => {
      throw new Error("broken")
    })
    await expect(getTenantOrganizationById("org_error")).rejects.toThrow("broken")

    mockUpdateOrganization.mockImplementationOnce(async () =>
      makeOrganization({
        name: "Acme Updated",
        allowProfilesOutsideOrganization: undefined,
      })
    )

    const updated = await updateTenantOrganization({
      organizationId: "org_1",
      name: "Acme Updated",
      metadata: { env: "prod" },
    })

    expect(updated.name).toBe("Acme Updated")
    expect(updated.allowProfilesOutsideOrganization).toBe(false)
    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      organization: "org_1",
      name: "Acme Updated",
      metadata: { env: "prod" },
    })
  })

  it("evaluates active owner membership predicate", () => {
    expect(
      isActiveOwnerMembership({
        id: "mem_1",
        organizationId: "org_1",
        userId: "user_1",
        displayName: "Owner",
        email: null,
        avatarUrl: null,
        status: "active",
        role: "owner",
        roleSlug: "user_owner",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      })
    ).toBe(true)

    expect(
      isActiveOwnerMembership({
        id: "mem_2",
        organizationId: "org_1",
        userId: "user_2",
        displayName: "Admin",
        email: null,
        avatarUrl: null,
        status: "inactive",
        role: "owner",
        roleSlug: "user_owner",
        profile: null,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      })
    ).toBe(false)
  })
})
