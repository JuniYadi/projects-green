import { beforeEach, describe, expect, it, mock } from "bun:test"

const findFirstMock = mock<
  (args: {
    where: {
      OR: Array<{ workosUserId?: string; email?: string }>
    }
  }) => Promise<{ role?: string | null } | null>
>(async () => null)

mock.module("@/lib/prisma", () => ({
  prisma: {
    authPlatformUserRole: {
      findFirst: findFirstMock,
    },
  },
}))

import { getPlatformRoleForUser } from "@/lib/platform-role"

describe("platform-role", () => {
  beforeEach(() => {
    findFirstMock.mockClear()
    findFirstMock.mockResolvedValue(null)
  })

  it("returns none when user is null/undefined", async () => {
    await expect(getPlatformRoleForUser(null)).resolves.toBe("none")
    await expect(getPlatformRoleForUser(undefined)).resolves.toBe("none")
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it("returns none when user has no id and no email", async () => {
    await expect(getPlatformRoleForUser({})).resolves.toBe("none")
    await expect(
      getPlatformRoleForUser({ id: "   ", email: "   " })
    ).resolves.toBe("none")
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it("normalizes id/email lookup input and maps super admin role", async () => {
    findFirstMock.mockResolvedValueOnce({ role: "SUPER_ADMIN" })

    const result = await getPlatformRoleForUser({
      id: " user_1 ",
      email: "  Admin@Example.com ",
    })

    expect(result).toBe("super_admin")
    expect(findFirstMock).toHaveBeenCalledTimes(1)
    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        OR: [{ workosUserId: "user_1" }, { email: "admin@example.com" }],
      },
    })
  })

  it("returns none for unknown stored roles", async () => {
    findFirstMock.mockResolvedValueOnce({ role: "ADMIN" })
    await expect(getPlatformRoleForUser({ id: "user_1" })).resolves.toBe("none")
  })

  it("returns none on DB failure instead of throwing", async () => {
    findFirstMock.mockRejectedValueOnce(new Error("DB connection failed"))

    const result = await getPlatformRoleForUser({ id: "user_1" })

    expect(result).toBe("none")
    expect(findFirstMock).toHaveBeenCalledTimes(1)
  })
})
