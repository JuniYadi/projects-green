import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockListOrganizations = mock(() =>
  Promise.resolve({
    data: [],
    listMetadata: {},
  })
)

const mockListOrganizationMemberships = mock(() =>
  Promise.resolve({
    data: [],
  })
)

const mockListInvitations = mock(() =>
  Promise.resolve({
    data: [],
  })
)

const mockCreateOrganization = mock(() =>
  Promise.resolve({
    id: "org_new",
    name: "New Org",
    externalId: null,
    domains: [],
    allowProfilesOutsideOrganization: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
)

const mockSendInvitation = mock(() =>
  Promise.resolve({
    id: "inv_new",
    email: "invited@example.com",
    state: "pending",
    organizationId: "org_1",
    roleSlug: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-02-01T00:00:00.000Z",
    acceptedAt: null,
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    organizations: {
      listOrganizations: mockListOrganizations,
      createOrganization: mockCreateOrganization,
    },
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
      listInvitations: mockListInvitations,
      sendInvitation: mockSendInvitation,
    },
  }),
}))

const {
  listAdminOrganizations,
  listAdminOrganizationMembers,
  createAdminOrganization,
  sendAdminInvitation,
} = await import("./admin.service")

describe("listAdminOrganizations", () => {
  beforeEach(() => {
    mockListOrganizations.mockClear()
  })

  it("calls workos.organizations.listOrganizations with params", async () => {
    await listAdminOrganizations({ limit: 10 })
    expect(mockListOrganizations).toHaveBeenCalledWith({ limit: 10 })
  })

  it("returns organizations mapped to summary format", async () => {
    mockListOrganizations.mockResolvedValue({
      data: [
        {
          id: "org_123",
          name: "Test Org",
          externalId: "ext_123",
          domains: [{ domain: "test.com", state: "verified" }],
          allowProfilesOutsideOrganization: true,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-02",
        },
      ],
      listMetadata: { before: "cursor_before", after: "cursor_after" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await listAdminOrganizations({ limit: 10 })
    expect(result.organizations).toHaveLength(1)
    expect(result.organizations[0].name).toBe("Test Org")
    expect(result.organizations[0].domains).toEqual(["test.com"])
    expect(result.listMetadata?.before).toBe("cursor_before")
  })
})

describe("listAdminOrganizationMembers", () => {
  beforeEach(() => {
    mockListOrganizationMemberships.mockClear()
    mockListInvitations.mockClear()
  })

  it("calls both listOrganizationMemberships and listInvitations", async () => {
    await listAdminOrganizationMembers("org_123")
    expect(mockListOrganizationMemberships).toHaveBeenCalledWith({
      organizationId: "org_123",
    })
    expect(mockListInvitations).toHaveBeenCalledWith({
      organizationId: "org_123",
    })
  })

  it("returns memberships and pendingInvitations", async () => {
    mockListOrganizationMemberships.mockResolvedValue({
      data: [
        {
          id: "mem_123",
          userId: "user_123",
          status: "active",
          role: { slug: "member" },
          user: {
            email: "test@example.com",
            firstName: "John",
            lastName: "Doe",
          },
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockListInvitations.mockResolvedValue({
      data: [
        {
          id: "inv_123",
          email: "pending@example.com",
          state: "pending",
          roleSlug: "admin",
          createdAt: "2024-01-02",
          expiresAt: "2024-02-02",
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await listAdminOrganizationMembers("org_123")
    expect(result.memberships).toHaveLength(1)
    expect(result.memberships[0].email).toBe("test@example.com")
    expect(result.pendingInvitations).toHaveLength(1)
    expect(result.pendingInvitations[0].email).toBe("pending@example.com")
  })

  it("handles memberships without user data", async () => {
    mockListOrganizationMemberships.mockResolvedValue({
      data: [
        {
          id: "mem_no_user",
          userId: "user_456",
          status: "active",
          role: null,
          user: null,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockListInvitations.mockResolvedValue({
      data: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await listAdminOrganizationMembers("org_456")
    expect(result.memberships).toHaveLength(1)
    expect(result.memberships[0].email).toBe("")
    expect(result.memberships[0].firstName).toBeNull()
    expect(result.memberships[0].roleSlug).toBe("member")
  })
})

describe("createAdminOrganization", () => {
  beforeEach(() => {
    mockCreateOrganization.mockClear()
  })

  it("creates organization with name only", async () => {
    const result = await createAdminOrganization({ name: "New Org" })

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      name: "New Org",
      domainData: undefined,
      externalId: undefined,
    })
    expect(result.name).toBe("New Org")
  })

  it("creates organization with domains and externalId", async () => {
    mockCreateOrganization.mockResolvedValue({
      id: "org_custom",
      name: "Custom Org",
      externalId: "ext_001",
      domains: [{ domain: "custom.com", state: "pending" }],
      allowProfilesOutsideOrganization: false,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await createAdminOrganization({
      name: "Custom Org",
      domains: ["custom.com"],
      externalId: "ext_001",
    })

    expect(result.externalId).toBe("ext_001")
    expect(result.domains).toEqual(["custom.com"])
  })
})

describe("sendAdminInvitation", () => {
  beforeEach(() => {
    mockSendInvitation.mockClear()
  })

  it("sends invitation with required params", async () => {
    const result = await sendAdminInvitation({
      email: "invited@example.com",
      organizationId: "org_1",
      inviterUserId: "user_admin",
      roleSlug: "admin",
    })

    expect(mockSendInvitation).toHaveBeenCalledWith({
      email: "invited@example.com",
      organizationId: "org_1",
      inviterUserId: "user_admin",
      roleSlug: "admin",
      expiresInDays: undefined,
    })
    expect(result.email).toBe("invited@example.com")
  })

  it("sends invitation with expiresInDays", async () => {
    await sendAdminInvitation({
      email: "invited@example.com",
      organizationId: "org_1",
      inviterUserId: "user_admin",
      roleSlug: "member",
      expiresInDays: 7,
    })

    expect(mockSendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInDays: 7 })
    )
  })

  it("handles invitation with no acceptedAt", async () => {
    mockSendInvitation.mockResolvedValue({
      id: "inv_pending",
      email: "pending@example.com",
      state: "pending",
      organizationId: "org_1",
      roleSlug: "member",
      createdAt: "2026-01-01",
      expiresAt: "2026-02-01",
      acceptedAt: null,
    })

    const result = await sendAdminInvitation({
      email: "pending@example.com",
      organizationId: "org_1",
      inviterUserId: "user_admin",
      roleSlug: "member",
    })

    expect(result.acceptedAt).toBeNull()
  })
})
