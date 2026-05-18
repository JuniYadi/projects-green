import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockAutoPagination = mock(async () => [])
const mockListOrganizationMemberships = mock(async () => ({
  autoPagination: mockAutoPagination,
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
    },
  }),
}))

const { listTenantMemberships } = await import(
  "@/modules/tenants/services/tenant-workos.service"
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

beforeEach(() => {
  mockListOrganizationMemberships.mockReset()
  mockAutoPagination.mockReset()

  mockListOrganizationMemberships.mockImplementation(async () => ({
    autoPagination: mockAutoPagination,
  }))
  mockAutoPagination.mockImplementation(async () => [])
})

describe("listTenantMemberships", () => {
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
})
