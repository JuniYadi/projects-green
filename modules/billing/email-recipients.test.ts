import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockConsoleError = mock(() => {})
console.error = mockConsoleError

type TestMembership = {
  userId: string
  role?: { slug?: string | null } | null
}

type TestBillingContact = {
  email: string
  role?: string
  createdAt?: Date
}

const mockFindUnique = mock(
  async (): Promise<{ contacts: TestBillingContact[] } | null> => ({
    contacts: [],
  })
)
const mockGetCachedOrganization = mock(
  async (): Promise<{ id: string; name: string } | null> => null
)
const mockFindMany = mock(async () => [] as Array<{ email: string | null }>)
const mockAutoPagination = mock(async (): Promise<TestMembership[]> => [])
const mockListOrganizationMemberships = mock(async () => ({
  autoPagination: mockAutoPagination,
}))
const mockGetUser = mock(async (): Promise<{ email: string | null }> => ({
  email: null,
}))
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
mock.module("@/lib/workos-directory", () => ({
  getCachedOrganization: mockGetCachedOrganization,
}))

import {
  resolveInvoiceBilledTo,
  resolveInvoiceEmailRecipients,
} from "./email-recipients"

describe("resolveInvoiceEmailRecipients", () => {
  beforeEach(() => {
    mockConsoleError.mockClear()
    mockFindUnique.mockReset()
    mockFindMany.mockReset()
    mockAutoPagination.mockReset()
    mockListOrganizationMemberships.mockReset()
    mockGetUser.mockReset()
    mockCreateWorkOS.mockReset()
    mockGetCachedOrganization.mockReset()

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
    mockGetCachedOrganization.mockResolvedValue(null)
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

describe("resolveInvoiceBilledTo", () => {
  beforeEach(() => {
    mockConsoleError.mockClear()
    mockFindUnique.mockReset()
    mockGetCachedOrganization.mockReset()

    mockFindUnique.mockResolvedValue({ contacts: [] })
    mockGetCachedOrganization.mockResolvedValue(null)
  })

  it("picks the active contact with the highest-priority role", async () => {
    mockFindUnique.mockResolvedValue({
      contacts: [
        {
          email: "general@example.com",
          role: "GENERAL",
          createdAt: new Date("2024-01-01"),
        },
        {
          email: "accounting@example.com",
          role: "ACCOUNTING",
          createdAt: new Date("2024-01-01"),
        },
        {
          email: "finance@example.com",
          role: "FINANCE",
          createdAt: new Date("2024-01-01"),
        },
        {
          email: "owner@example.com",
          role: "OWNER",
          createdAt: new Date("2024-01-02"),
        },
      ],
    })
    mockGetCachedOrganization.mockResolvedValue({
      id: "org-123",
      name: "Acme Inc",
    })

    await expect(resolveInvoiceBilledTo("org-123")).resolves.toEqual({
      organizationName: "Acme Inc",
      billedToEmail: "owner@example.com",
    })
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { organizationId: "org-123" },
      include: {
        contacts: { where: { isActive: true, notifyOnInvoice: true } },
      },
    })
  })

  it("breaks a role tie by earliest createdAt, then by email", async () => {
    mockFindUnique.mockResolvedValue({
      contacts: [
        {
          email: "later@example.com",
          role: "OWNER",
          createdAt: new Date("2024-02-01"),
        },
        {
          email: "zeta@example.com",
          role: "OWNER",
          createdAt: new Date("2024-01-01"),
        },
        {
          email: "alpha@example.com",
          role: "OWNER",
          createdAt: new Date("2024-01-01"),
        },
      ],
    })

    await expect(resolveInvoiceBilledTo("org-tie")).resolves.toEqual({
      organizationName: undefined,
      billedToEmail: "alpha@example.com",
    })
  })

  it("falls back to the given email when there is no active billing contact", async () => {
    mockFindUnique.mockResolvedValue({ contacts: [] })
    mockGetCachedOrganization.mockResolvedValue({
      id: "org-456",
      name: "Org456",
    })

    await expect(
      resolveInvoiceBilledTo("org-456", "actor@example.com")
    ).resolves.toEqual({
      organizationName: "Org456",
      billedToEmail: "actor@example.com",
    })
  })

  it("resolves to no billed-to email when there is no contact and no fallback", async () => {
    mockFindUnique.mockResolvedValue(null)
    mockGetCachedOrganization.mockResolvedValue(null)

    await expect(resolveInvoiceBilledTo("org-789")).resolves.toEqual({
      organizationName: undefined,
      billedToEmail: undefined,
    })
  })

  it("logs and falls back to the given email when the billing account lookup fails", async () => {
    mockFindUnique.mockRejectedValue(new Error("database unavailable"))
    mockGetCachedOrganization.mockResolvedValue({
      id: "org-err",
      name: "ErrOrg",
    })

    await expect(
      resolveInvoiceBilledTo("org-err", "actor@example.com")
    ).resolves.toEqual({
      organizationName: "ErrOrg",
      billedToEmail: "actor@example.com",
    })
    expect(mockConsoleError).toHaveBeenCalled()
  })

  it("logs and omits organizationName when the organization lookup fails", async () => {
    mockGetCachedOrganization.mockRejectedValue(new Error("WorkOS unavailable"))
    mockFindUnique.mockResolvedValue({ contacts: [] })

    await expect(
      resolveInvoiceBilledTo("org-err2", "actor2@example.com")
    ).resolves.toEqual({
      organizationName: undefined,
      billedToEmail: "actor2@example.com",
    })
    expect(mockConsoleError).toHaveBeenCalled()
  })
})
