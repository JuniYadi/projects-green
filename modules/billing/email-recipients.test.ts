import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockConsoleError = mock(() => {})
console.error = mockConsoleError

type TestMembership = {
  userId: string
  role?: { slug?: string | null } | null
}

const mockFindUnique = mock(
  async (): Promise<{ contacts: Array<{ email: string }> } | null> => ({
    contacts: [],
  })
)
const mockFindMany = mock(async () => [] as Array<{ email: string | null }>)
const mockAutoPagination = mock(async (): Promise<TestMembership[]> => [])
const mockListOrganizationMemberships = mock(async () => ({
  autoPagination: mockAutoPagination,
}))
const mockGetUser = mock(
  async (): Promise<{ email: string | null }> => ({
    email: null,
  })
)
const mockCreateWorkOS = mock(() => ({
  userManagement: {
    listOrganizationMemberships: mockListOrganizationMemberships,
    getUser: mockGetUser,
  },
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingAccount: { findUnique: mockFindUnique },
    authPlatformUserRole: { findMany: mockFindMany },
  },
}))

mock.module("@workos-inc/node", () => ({
  createWorkOS: mockCreateWorkOS,
}))

import { resolveInvoiceEmailRecipients } from "./email-recipients"

describe("resolveInvoiceEmailRecipients", () => {
  beforeEach(() => {
    mockConsoleError.mockClear()
    mockFindUnique.mockReset()
    mockFindMany.mockReset()
    mockAutoPagination.mockReset()
    mockListOrganizationMemberships.mockReset()
    mockGetUser.mockReset()
    mockCreateWorkOS.mockReset()

    mockFindUnique.mockResolvedValue({ contacts: [] })
    mockFindMany.mockResolvedValue([])
    mockAutoPagination.mockResolvedValue([])
    mockListOrganizationMemberships.mockResolvedValue({
      autoPagination: mockAutoPagination,
    })
    mockGetUser.mockResolvedValue({ email: null })
    mockCreateWorkOS.mockReturnValue({
      userManagement: {
        listOrganizationMemberships: mockListOrganizationMemberships,
        getUser: mockGetUser,
      },
    })
  })

  it("combines active contacts, platform users, and an organization admin", async () => {
    mockFindUnique.mockResolvedValue({
      contacts: [{ email: "contact@example.com" }],
    })
    mockFindMany.mockResolvedValue([
      { email: "contact@example.com" },
      { email: "platform@example.com" },
      { email: null },
    ])
    mockAutoPagination.mockResolvedValue([
      { userId: "user-owner", role: { slug: "USER_OWNER" } },
    ])
    mockGetUser.mockResolvedValue({ email: "owner@example.com" })

    await expect(resolveInvoiceEmailRecipients("org-123")).resolves.toEqual([
      { email: "contact@example.com" },
      { email: "platform@example.com" },
      { email: "owner@example.com" },
    ])

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { organizationId: "org-123" },
      include: {
        contacts: { where: { isActive: true, notifyOnInvoice: true } },
      },
    })
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { email: { not: null } },
      select: { email: true },
    })
    expect(mockListOrganizationMemberships).toHaveBeenCalledWith({
      organizationId: "org-123",
      statuses: ["active"],
    })
  })

  it("supports user admin memberships and skips an admin without an email", async () => {
    mockAutoPagination.mockResolvedValue([
      { userId: "user-admin", role: { slug: "user_admin" } },
    ])
    mockGetUser.mockResolvedValue({ email: null })

    await expect(resolveInvoiceEmailRecipients("org-456")).resolves.toEqual([])
    expect(mockGetUser).toHaveBeenCalledWith("user-admin")
  })

  it("returns platform users when no billing account or admin exists", async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindMany.mockResolvedValue([{ email: "platform@example.com" }])
    mockAutoPagination.mockResolvedValue([
      { userId: "user-member", role: { slug: "user_member" } },
    ])

    await expect(resolveInvoiceEmailRecipients("org-789")).resolves.toEqual([
      { email: "platform@example.com" },
    ])
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("continues when platform user lookup fails", async () => {
    mockFindMany.mockRejectedValue(new Error("database unavailable"))
    mockAutoPagination.mockResolvedValue([
      { userId: "user-owner", role: { slug: "user_owner" } },
    ])
    mockGetUser.mockResolvedValue({ email: "owner@example.com" })

    await expect(resolveInvoiceEmailRecipients("org-123")).resolves.toEqual([
      { email: "owner@example.com" },
    ])
  })

  it("continues when WorkOS lookup fails", async () => {
    mockListOrganizationMemberships.mockRejectedValue(
      new Error("WorkOS unavailable")
    )

    await expect(resolveInvoiceEmailRecipients("org-123")).resolves.toEqual([])
  })
})
