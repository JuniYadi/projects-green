import { beforeEach, describe, expect, it, mock } from "bun:test"

type AdminRoleEmailRecord = { email: string | null }

const mockFindMany = mock(async () => [] as AdminRoleEmailRecord[])

mock.module("@/lib/prisma", () => ({
  prisma: {
    authPlatformUserRole: { findMany: mockFindMany },
  },
}))

const { getPlatformAdminEmails, getPlatformSuperAdminEmails } =
  await import("./platform-admin-emails")

describe("platform admin email resolution", () => {
  beforeEach(() => {
    mockFindMany.mockClear()
    mockFindMany.mockResolvedValue([])
  })

  it("includes every registered platform user for billing notices", async () => {
    mockFindMany.mockResolvedValueOnce([
      { email: "Admin1@Example.com" },
      { email: "admin1@example.com" },
      { email: "operator@example.com" },
      { email: null },
    ])
    expect(await getPlatformAdminEmails()).toEqual([
      "admin1@example.com",
      "operator@example.com",
    ])
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { email: { not: null } },
      select: { email: true },
    })
  })

  it("returns no platform addresses if the directory lookup fails", async () => {
    mockFindMany.mockRejectedValueOnce(new Error("DB error"))
    expect(await getPlatformAdminEmails()).toEqual([])
  })

  it("returns unique lowercased super admin emails", async () => {
    mockFindMany.mockResolvedValueOnce([
      { email: "Admin1@Example.com" },
      { email: "admin2@example.com" },
      { email: "admin1@example.com" },
      { email: null },
    ])

    const emails = await getPlatformSuperAdminEmails()
    expect(emails).toEqual(["admin1@example.com", "admin2@example.com"])
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        role: "SUPER_ADMIN",
        email: { not: null },
      },
      select: {
        email: true,
      },
    })
  })

  it("handles db errors gracefully by returning empty array", async () => {
    mockFindMany.mockRejectedValueOnce(new Error("DB error"))
    const emails = await getPlatformSuperAdminEmails()
    expect(emails).toEqual([])
  })
})
