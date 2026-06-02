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

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    organizations: {
      listOrganizations: mockListOrganizations,
    },
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
      listInvitations: mockListInvitations,
    },
  }),
}))

const { listAdminOrganizations, listAdminOrganizationMembers } =
  await import("./admin.service")

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
})
