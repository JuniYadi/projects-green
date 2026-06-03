import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockAutoPagination = mock<
  () => Promise<Array<{ role?: { slug: string } | null } | null>>
>()
const mockListOrganizationMemberships = mock(
  async () => ({
    autoPagination: mockAutoPagination,
  })
)

mock.module("@workos-inc/node", () => ({
  createWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
    },
  }),
}))

const { resolveOrgRole } = await import("./org-role")

describe("resolveOrgRole", () => {
  beforeEach(() => {
    mockListOrganizationMemberships.mockClear()
    mockAutoPagination.mockClear()
  })

  it("returns 'owner' when role slug is user_owner", async () => {
    mockAutoPagination.mockResolvedValue([
      { role: { slug: "user_owner" } },
    ])

    const result = await resolveOrgRole("user_1", "org_1")
    expect(result).toBe("owner")
  })

  it("returns 'admin' when role slug is user_admin", async () => {
    mockAutoPagination.mockResolvedValue([
      { role: { slug: "user_admin" } },
    ])

    const result = await resolveOrgRole("user_1", "org_1")
    expect(result).toBe("admin")
  })

  it("returns 'member' when role slug is user_member", async () => {
    mockAutoPagination.mockResolvedValue([
      { role: { slug: "user_member" } },
    ])

    const result = await resolveOrgRole("user_1", "org_1")
    expect(result).toBe("member")
  })

  it("returns null when no active memberships found", async () => {
    mockAutoPagination.mockResolvedValue([])

    const result = await resolveOrgRole("user_1", "org_1")
    expect(result).toBeNull()
  })

  it("returns null when membership has no role slug", async () => {
    mockAutoPagination.mockResolvedValue([
      { role: null },
    ])

    const result = await resolveOrgRole("user_1", "org_1")
    expect(result).toBeNull()
  })

  it("returns null for unknown role slug", async () => {
    mockAutoPagination.mockResolvedValue([
      { role: { slug: "user_custom" } },
    ])

    const result = await resolveOrgRole("user_1", "org_1")
    expect(result).toBeNull()
  })

  it("returns null when WorkOS call throws", async () => {
    mockAutoPagination.mockRejectedValue(new Error("Network error"))

    const result = await resolveOrgRole("user_1", "org_1")
    expect(result).toBeNull()
  })

  it("calls listOrganizationMemberships with correct params", async () => {
    mockAutoPagination.mockResolvedValue([
      { role: { slug: "user_member" } },
    ])

    await resolveOrgRole("user_1", "org_1")
    expect(mockListOrganizationMemberships).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "org_1",
      statuses: ["active"],
    })
  })
})
