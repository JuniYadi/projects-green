import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { createAdminMembersRoutes } from "./members.route"
import type { PlatformAccessRole } from "@/lib/platform-role"

type MockAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

const mockFindMany = mock()
const mockFindFirst = mock()
const mockFindManySubscription = mock()
const mockFindManyUsage = mock()

const mockPrismaClient = {
  tenant: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
  },
  subscription: {
    findMany: mockFindManySubscription,
  },
  usageLedger: {
    findMany: mockFindManyUsage,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminMembersRoute", () => {
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

  describe("GET /admin/members", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members", {
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
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members", {
          method: "GET",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 200 with empty members list", async () => {
      mockFindMany.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.members).toEqual([])
    })

    it("returns 200 with members including billing data", async () => {
      const mockTenants = [
        {
          id: "tenant-1",
          code: "tenant-1",
          name: "Tenant One",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          billingAccounts: [
            {
              id: "acc-1",
              balance: new Decimal("150000.00"),
            },
          ],
        },
        {
          id: "tenant-2",
          code: "tenant-2",
          name: "Tenant Two",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          billingAccounts: [
            {
              id: "acc-2",
              balance: new Decimal("75000.50"),
            },
          ],
        },
      ]

      const mockSubscriptions = [
        {
          id: "sub-1",
          organizationId: "tenant-1",
          status: "ACTIVE",
          package: { code: "WA_BASIC" },
          plan: { code: "basic" },
        },
        {
          id: "sub-2",
          organizationId: "tenant-1",
          status: "ACTIVE",
          package: { code: "WA_PRO" },
          plan: { code: "pro" },
        },
        {
          id: "sub-3",
          organizationId: "tenant-2",
          status: "ACTIVE",
          package: { code: "WA_BASIC" },
          plan: { code: "basic" },
        },
      ]

      const currentMonth = new Date().toISOString().slice(0, 7)
      const mockUsage = [
        {
          id: "usage-1",
          organizationId: "tenant-1",
          period: currentMonth,
          amountIdr: new Decimal("25000.00"),
        },
        {
          id: "usage-2",
          organizationId: "tenant-2",
          period: currentMonth,
          amountIdr: new Decimal("15000.00"),
        },
      ]

      mockFindMany.mockResolvedValueOnce(mockTenants)
      mockFindManySubscription.mockResolvedValueOnce(mockSubscriptions)
      mockFindManyUsage.mockResolvedValueOnce(mockUsage)

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.members).toHaveLength(2)

      const tenant1Member = body.members.find((m: { organizationId: string }) => m.organizationId === "tenant-1")
      expect(tenant1Member.subscriptionCount).toBe(2)
      expect(tenant1Member.monthlySpendIdr).toBe("25000.00")
      expect(tenant1Member.balanceIdr).toBe("150000.00")

      const tenant2Member = body.members.find((m: { organizationId: string }) => m.organizationId === "tenant-2")
      expect(tenant2Member.subscriptionCount).toBe(1)
      expect(tenant2Member.monthlySpendIdr).toBe("15000.00")
      expect(tenant2Member.balanceIdr).toBe("75000.50")
    })

    it("returns 500 on database error", async () => {
      mockFindMany.mockRejectedValueOnce(new Error("Database connection failed"))

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members", {
          method: "GET",
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  describe("GET /admin/members/:userId", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/tenant-1", {
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
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/tenant-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when member not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/nonexistent-user", {
          method: "GET",
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 200 with member detail", async () => {
      const mockTenant = {
        id: "tenant-1",
        code: "tenant-1",
        name: "Test Tenant",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        billingAccounts: [
          {
            id: "acc-1",
            balance: new Decimal("200000.00"),
          },
        ],
      }

      const mockSubscriptions = [
        {
          id: "sub-1",
          organizationId: "tenant-1",
          status: "ACTIVE",
          package: { code: "WA_BASIC" },
          plan: { code: "basic" },
          currentPeriodEnd: new Date("2026-06-30"),
        },
        {
          id: "sub-2",
          organizationId: "tenant-1",
          status: "ACTIVE",
          package: { code: "WA_PRO" },
          plan: { code: "pro" },
          currentPeriodEnd: new Date("2026-06-30"),
        },
      ]

      const currentMonth = new Date().toISOString().slice(0, 7)
      const mockUsage = [
        {
          id: "usage-1",
          organizationId: "tenant-1",
          period: currentMonth,
          category: "MESSAGE",
          amountIdr: new Decimal("35000.00"),
          createdAt: new Date(),
        },
        {
          id: "usage-2",
          organizationId: "tenant-1",
          period: currentMonth,
          category: "DEVICE",
          amountIdr: new Decimal("15000.00"),
          createdAt: new Date(),
        },
      ]

      mockFindFirst.mockResolvedValueOnce(mockTenant)
      mockFindManySubscription.mockResolvedValueOnce(mockSubscriptions)
      mockFindManyUsage.mockResolvedValueOnce(mockUsage)

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/tenant-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.member.organizationId).toBe("tenant-1")
      expect(body.member.name).toBe("Test Tenant")
      expect(body.member.subscriptionCount).toBe(2)
      expect(body.member.monthlySpendIdr).toBe("50000.00")
      expect(body.member.balanceIdr).toBe("200000.00")
      expect(body.member.subscriptions).toHaveLength(2)
      expect(body.member.recentUsage).toHaveLength(2)
    })

    it("returns 500 on database error", async () => {
      mockFindFirst.mockRejectedValueOnce(new Error("Database error"))

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/tenant-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})