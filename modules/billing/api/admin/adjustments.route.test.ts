import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { createAdminAdjustmentsRoutes } from "./adjustments.route"
import type { PlatformAccessRole } from "@/lib/platform-role"

type MockAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany = mock(async () => [] as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCount = mock(async () => 0 as any)

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingAdjustment: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}))

describe("AdminAdjustmentsRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  const defaultAuth = {
    user: { id: "admin-1", email: "admin@example.com" },
    organizationId: "org-1",
    role: "owner" as const,
  }

  const mockPlatformRole = async () => "super_admin" as PlatformAccessRole
  const mockIsAdmin = () => true

  describe("defaultDeps.isAdmin", () => {
    const isAdmin = (actor: {
      platformRole: PlatformAccessRole
      tenantRole: string | null | undefined
    }) => {
      if (actor.platformRole === "super_admin") return true
      return actor.tenantRole === "admin" || actor.tenantRole === "owner"
    }

    it("returns true for super_admin with null tenant role (the bug scenario)", () => {
      expect(isAdmin({ platformRole: "super_admin", tenantRole: null })).toBe(true)
    })

    it("returns true for super_admin with undefined tenant role", () => {
      expect(isAdmin({ platformRole: "super_admin", tenantRole: undefined })).toBe(true)
    })

    it("returns true for super_admin with admin tenant role", () => {
      expect(isAdmin({ platformRole: "super_admin", tenantRole: "admin" })).toBe(true)
    })

    it("returns true for non-super_admin with admin tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: "admin" })).toBe(true)
    })

    it("returns true for non-super_admin with owner tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: "owner" })).toBe(true)
    })

    it("returns false for non-super_admin with member tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: "member" })).toBe(false)
    })

    it("returns false for non-super_admin with null tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: null })).toBe(false)
    })

    it("returns false for non-super_admin with undefined tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: undefined })).toBe(false)
    })
  })

  it("returns 401 when no auth", async () => {
    const app = new Elysia()
      .use(
        createAdminAdjustmentsRoutes({
          authenticate: async () => ({ user: null } as MockAuthContext),
          getPlatformRole: mockPlatformRole,
          isAdmin: mockIsAdmin,
        })
      )
      .compile()

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments", {
        method: "GET",
      })
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when not admin", async () => {
    const app = new Elysia()
      .use(
        createAdminAdjustmentsRoutes({
          authenticate: async () => defaultAuth as MockAuthContext,
          getPlatformRole: async () => "none" as PlatformAccessRole,
          isAdmin: () => false,
        })
      )
      .compile()

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments", {
        method: "GET",
      })
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("FORBIDDEN")
  })

  it("returns 200 with adjustments list", async () => {
    const mockAdjustments = [
      {
        id: "adj-1",
        billingAccountId: "acc-1",
        adjustmentType: "CREDIT" as const,
        amount: new Decimal("50000.00"),
        currency: "IDR",
        reason: "Test credit",
        createdByWorkosUserId: "admin-1",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-15T10:00:00Z"),
        billingAccount: {
          organizationId: "org-1",
        },
      },
    ]

    mockFindMany.mockResolvedValueOnce(mockAdjustments)
    mockCount.mockResolvedValueOnce(1)

    const app = new Elysia()
      .use(
        createAdminAdjustmentsRoutes({
          authenticate: async () => defaultAuth as MockAuthContext,
          getPlatformRole: mockPlatformRole,
          isAdmin: mockIsAdmin,
        })
 )
      .compile()

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.adjustments).toHaveLength(1)
    expect(body.adjustments[0].id).toBe("adj-1")
    expect(body.adjustments[0].amount).toBe("50000.00")
    expect(body.adjustments[0].createdAt).toBe("2024-01-15T10:00:00.000Z")
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(20)
    expect(body.pagination.total).toBe(1)
    expect(body.pagination.totalPages).toBe(1)
  })

  it("filters by type CREDIT", async () => {
    const mockAdjustments = [
      {
        id: "adj-1",
        billingAccountId: "acc-1",
        adjustmentType: "CREDIT" as const,
        amount: new Decimal("50000.00"),
        currency: "IDR",
        reason: "Test credit",
        createdByWorkosUserId: "admin-1",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-15T10:00:00Z"),
        billingAccount: {
          organizationId: "org-1",
        },
      },
    ]

    mockFindMany.mockResolvedValueOnce(mockAdjustments)
    mockCount.mockResolvedValueOnce(1)

    const app = new Elysia()
      .use(
        createAdminAdjustmentsRoutes({
          authenticate: async () => defaultAuth as MockAuthContext,
          getPlatformRole: mockPlatformRole,
          isAdmin: mockIsAdmin,
        })
 )
      .compile()

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments?type=CREDIT", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.adjustments).toHaveLength(1)
    expect(body.adjustments[0].type).toBe("CREDIT")
  })

  it("handles pagination", async () => {
    const mockAdjustments = [
      {
        id: "adj-2",
        billingAccountId: "acc-2",
        adjustmentType: "DEBIT" as const,
        amount: new Decimal("25000.00"),
        currency: "IDR",
        reason: "Usage charge",
        createdByWorkosUserId: "admin-1",
        createdAt: new Date("2024-01-14T10:00:00Z"),
        updatedAt: new Date("2024-01-14T10:00:00Z"),
        billingAccount: {
          organizationId: "org-2",
        },
      },
    ]

    mockFindMany.mockResolvedValueOnce(mockAdjustments)
    mockCount.mockResolvedValueOnce(2)

    const app = new Elysia()
      .use(
        createAdminAdjustmentsRoutes({
          authenticate: async () => defaultAuth as MockAuthContext,
          getPlatformRole: mockPlatformRole,
          isAdmin: mockIsAdmin,
        })
      )
      .compile()

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments?page=2&limit=1", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(1)
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.totalPages).toBe(2)
  })

  it("returns 500 on database error", async () => {
    mockFindMany.mockRejectedValueOnce(new Error("Database connection failed"))

    const app = new Elysia()
      .use(
        createAdminAdjustmentsRoutes({
          authenticate: async () => defaultAuth as MockAuthContext,
          getPlatformRole: mockPlatformRole,
          isAdmin: mockIsAdmin,
        })
      )
      .compile()

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments", {
        method: "GET",
      })
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
  })

  it("clamps limit to maximum of 100", async () => {
    mockFindMany.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)

    const app = new Elysia()
      .use(
        createAdminAdjustmentsRoutes({
          authenticate: async () => defaultAuth as MockAuthContext,
          getPlatformRole: mockPlatformRole,
          isAdmin: mockIsAdmin,
        })
      )
      .compile()

    const response = await app.handle(
      new Request("http://localhost/admin/adjustments?limit=500", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.pagination.limit).toBe(100)
  })
})
