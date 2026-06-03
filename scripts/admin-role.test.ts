import { beforeEach, describe, expect, it, mock } from "bun:test"
import { PlatformRole } from "@prisma/client"

const mockFindMany = mock(async () => [])
const mockFindFirst = mock(async () => null)
const mockCreate = mock(async () => ({
  id: "pur_1",
  email: "admin@example.com",
  workosUserId: "user_123",
  role: PlatformRole.SUPER_ADMIN,
  createdAt: new Date("2026-06-04T00:00:00.000Z"),
  updatedAt: new Date("2026-06-04T00:00:00.000Z"),
}))
const mockUpdate = mock(async () => ({
  id: "pur_1",
  email: "admin@example.com",
  workosUserId: "user_123",
  role: PlatformRole.SUPER_ADMIN,
  createdAt: new Date("2026-06-04T00:00:00.000Z"),
  updatedAt: new Date("2026-06-04T00:00:00.000Z"),
}))
const mockDelete = mock(async () => ({ id: "pur_1" }))

mock.module("@/lib/prisma", () => ({
  prisma: {
    platformUserRole: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      $disconnect: mock(async () => undefined),
    },
  },
}))

const {
  parseAdminRoleArgs,
  listSuperAdmins,
  addSuperAdmin,
  deleteSuperAdmin,
  normalizeEmail,
  normalizeWorkosUserId,
} = await import("./admin-role")

describe("parseAdminRoleArgs", () => {
  it("parses --list", () => {
    expect(parseAdminRoleArgs(["--list"])).toEqual({ action: "list" })
  })

  it("parses --add with email", () => {
    expect(parseAdminRoleArgs(["--add", "--email", "Admin@Example.com "])).toEqual({
      action: "add",
      email: "admin@example.com",
    })
  })

  it("parses --delete with workos user id", () => {
    expect(parseAdminRoleArgs(["--delete", "--workos-user-id", " user_123 "])).toEqual({
      action: "delete",
      workosUserId: "user_123",
    })
  })

  it("rejects multiple actions", () => {
    expect(() => parseAdminRoleArgs(["--list", "--add"])).toThrow(
      "Exactly one action flag is required"
    )
  })

  it("rejects both identifiers", () => {
    expect(() =>
      parseAdminRoleArgs(["--add", "--email", "a@example.com", "--workos-user-id", "user_123"])
    ).toThrow("Provide exactly one identifier")
  })
})

describe("admin-role operations", () => {
  beforeEach(() => {
    mockFindMany.mockClear()
    mockFindFirst.mockClear()
    mockCreate.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()

    mockFindMany.mockResolvedValue([])
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: "pur_1",
      email: "admin@example.com",
      workosUserId: "user_123",
      role: PlatformRole.SUPER_ADMIN,
      createdAt: new Date("2026-06-04T00:00:00.000Z"),
      updatedAt: new Date("2026-06-04T00:00:00.000Z"),
    })
    mockUpdate.mockResolvedValue({
      id: "pur_1",
      email: "admin@example.com",
      workosUserId: "user_123",
      role: PlatformRole.SUPER_ADMIN,
      createdAt: new Date("2026-06-04T00:00:00.000Z"),
      updatedAt: new Date("2026-06-04T00:00:00.000Z"),
    })
    mockDelete.mockResolvedValue({ id: "pur_1" })
  })

  it("lists super admins ordered by createdAt ascending", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "pur_1",
        email: "admin@example.com",
        workosUserId: "user_123",
        role: PlatformRole.SUPER_ADMIN,
        createdAt: new Date("2026-06-04T00:00:00.000Z"),
        updatedAt: new Date("2026-06-04T00:00:00.000Z"),
      },
    ])

    const rows = await listSuperAdmins()

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { role: PlatformRole.SUPER_ADMIN },
      orderBy: { createdAt: "asc" },
    })
    expect(rows).toHaveLength(1)
  })

  it("creates a super admin row when add finds no match by email", async () => {
    await addSuperAdmin({ email: "Admin@Example.com " })

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: "admin@example.com" }] },
    })
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        email: "admin@example.com",
        workosUserId: null,
        role: PlatformRole.SUPER_ADMIN,
      },
    })
  })

  it("promotes an existing non-admin row by workos user id", async () => {
    mockFindFirst.mockResolvedValue({
      id: "pur_1",
      email: null,
      workosUserId: "user_123",
      role: PlatformRole.NONE,
      createdAt: new Date("2026-06-04T00:00:00.000Z"),
      updatedAt: new Date("2026-06-04T00:00:00.000Z"),
    })

    await addSuperAdmin({ workosUserId: " user_123 " })

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "pur_1" },
      data: { role: PlatformRole.SUPER_ADMIN },
    })
  })

  it("deletes the row when delete finds a matching super admin", async () => {
    mockFindFirst.mockResolvedValue({
      id: "pur_1",
      email: "admin@example.com",
      workosUserId: "user_123",
      role: PlatformRole.SUPER_ADMIN,
      createdAt: new Date("2026-06-04T00:00:00.000Z"),
      updatedAt: new Date("2026-06-04T00:00:00.000Z"),
    })

    await deleteSuperAdmin({ email: "admin@example.com" })

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "pur_1" } })
  })
})

describe("normalization", () => {
  it("normalizes email to lowercase and trims", () => {
    expect(normalizeEmail(" Admin@Example.com ")).toBe("admin@example.com")
  })

  it("returns null for empty email", () => {
    expect(normalizeEmail("   ")).toBeNull()
  })

  it("trims workos user id", () => {
    expect(normalizeWorkosUserId(" user_123 ")).toBe("user_123")
  })

  it("returns null for empty workos user id", () => {
    expect(normalizeWorkosUserId("   ")).toBeNull()
  })
})
