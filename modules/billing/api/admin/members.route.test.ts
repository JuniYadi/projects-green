import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

import { createAdminMembersRoutes } from "./members.route"
import type { PlatformAccessRole } from "@/lib/platform-role"
import { type MockAuthContext, defaultAuth, mockPlatformRole, mockIsAdmin, testIsAdmin } from "@/test/helpers/test-auth"

const mockFindMany = mock()
const mockFindFirst = mock()
const mockFindManySubscription = mock()
const mockFindManyUsage = mock()

const mockPrismaClient = {
  billingAccount: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
  },
  serviceSubscription: {
    findMany: mockFindManySubscription,
  },
  billingUsageLedger: {
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

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
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
      const mockBillingAccounts = [
        {
          id: "acc-1",
          organizationId: "org_1",
          balance: new Decimal("150000.00"),
          currency: "USD",
          timezone: "UTC",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "acc-2",
          organizationId: "org_2",
          balance: new Decimal("75000.50"),
          currency: "USD",
          timezone: "UTC",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const mockSubscriptions = [
        {
          id: "sub-1",
          organizationId: "org_1",
          status: "ACTIVE",
          package: { code: "WA_BASIC" },
          plan: { code: "basic" },
        },
        {
          id: "sub-2",
          organizationId: "org_1",
          status: "ACTIVE",
          package: { code: "WA_PRO" },
          plan: { code: "pro" },
        },
        {
          id: "sub-3",
          organizationId: "org_2",
          status: "ACTIVE",
          package: { code: "WA_BASIC" },
          plan: { code: "basic" },
        },
      ]

      const currentMonth = new Date().toISOString().slice(0, 7)
      const mockUsage = [
        {
          id: "usage-1",
          organizationId: "org_1",
          period: currentMonth,
          amountIdr: new Decimal("25000.00"),
        },
        {
          id: "usage-2",
          organizationId: "org_2",
          period: currentMonth,
          amountIdr: new Decimal("15000.00"),
        },
      ]

      mockFindMany.mockResolvedValueOnce(mockBillingAccounts)
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

      const org1Member = body.members.find((m: { organizationId: string }) => m.organizationId === "org_1")
      expect(org1Member.subscriptionCount).toBe(2)
      expect(org1Member.monthlySpendIdr).toBe("25000.00")
      expect(org1Member.balanceIdr).toBe("150000.00")

      const org2Member = body.members.find((m: { organizationId: string }) => m.organizationId === "org_2")
      expect(org2Member.subscriptionCount).toBe(1)
      expect(org2Member.monthlySpendIdr).toBe("15000.00")
      expect(org2Member.balanceIdr).toBe("75000.50")
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
      const mockBillingAccount = {
        id: "acc-1",
        organizationId: "org_1",
        balance: new Decimal("200000.00"),
        currency: "USD",
        timezone: "UTC",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockSubscriptions = [
        {
          id: "sub-1",
          organizationId: "org_1",
          status: "ACTIVE",
          package: { code: "WA_BASIC" },
          plan: { code: "basic" },
          currentPeriodEnd: new Date("2026-06-30"),
        },
        {
          id: "sub-2",
          organizationId: "org_1",
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
          organizationId: "org_1",
          period: currentMonth,
          category: "MESSAGE",
          amountIdr: new Decimal("35000.00"),
          createdAt: new Date(),
        },
        {
          id: "usage-2",
          organizationId: "org_1",
          period: currentMonth,
          category: "DEVICE",
          amountIdr: new Decimal("15000.00"),
          createdAt: new Date(),
        },
      ]

      mockFindFirst.mockResolvedValueOnce(mockBillingAccount)
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
        new Request("http://localhost/admin/members/org_1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.member.organizationId).toBe("org_1")
      expect(body.member.name).toBe("org_1")
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
        new Request("http://localhost/admin/members/org_1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  // ── P0.2 Org-scoping regression tests ─────────────────────────────────────
  // The fix adds DB-level org scoping to the detail endpoint so that non-
  // super_admin callers can only see members belonging to their own org.
  // Missing records return 404 (not 403) because the fix uses DB-scoping.
  describe("P0.2 org-scoping on GET /admin/members/:userId", () => {
    const mockBillingAccount = {
      id: "acc-own-org",
      organizationId: "org_own",
      balance: new Decimal("100000.00"),
      currency: "USD",
      timezone: "UTC",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const mockSubscriptions = [
      {
        id: "sub-1",
        organizationId: "org_own",
        status: "ACTIVE",
        package: { code: "WA_BASIC" },
        plan: { code: "basic" },
        currentPeriodEnd: new Date("2026-06-30"),
      },
    ]
    const currentMonth = new Date().toISOString().slice(0, 7)
    const mockUsage = [
      {
        id: "usage-1",
        organizationId: "org_own",
        period: currentMonth,
        category: "MESSAGE",
        amountIdr: new Decimal("10000.00"),
        createdAt: new Date(),
      },
    ]

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
        new Request("http://localhost/admin/members/org_own", {
          method: "GET",
        })
      )

      expect(response.status).toBe(401)
    })

    it("returns 403 when non-admin user (not super_admin, not org admin)", async () => {
      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => ({
              user: { id: "user-1", email: "user@test.com" },
              organizationId: "org_own",
              role: "member",
            } as MockAuthContext),
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/org_own", {
          method: "GET",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 200 when org admin queries their own org", async () => {
      mockFindFirst.mockResolvedValueOnce(mockBillingAccount)
      mockFindManySubscription.mockResolvedValueOnce(mockSubscriptions)
      mockFindManyUsage.mockResolvedValueOnce(mockUsage)

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => ({
              user: { id: "admin-1", email: "admin@org_own.com" },
              organizationId: "org_own",
              role: "admin",
            } as MockAuthContext),
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: (actor) => actor.orgRole === "admin",
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/org_own", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.member.organizationId).toBe("org_own")
    })

    it("returns 404 (not 403) when org admin queries a different org", async () => {
      // The caller is admin of org_own but asks about org_other.
      // The DB-scoping fix must restrict findFirst to caller's org (not target),
      // otherwise the WHERE clause would match and return a record instead of null.
      mockFindFirst.mockImplementationOnce((where: Record<string, unknown>) => {
        // If scoping is correct, findFirst is called with { where: { organizationId: "org_own" } }
        // which won't match any record for "org_other" → null → 404
        expect(where?.where?.organizationId).toBe("org_own")
        return null
      })

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => ({
              user: { id: "admin-1", email: "admin@org_own.com" },
              organizationId: "org_own",
              role: "admin",
            } as MockAuthContext),
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: (actor) => actor.orgRole === "admin",
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/org_other", {
          method: "GET",
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
      expect(body.error).not.toBe("FORBIDDEN")
    })

    it("returns 200 when super_admin queries any org", async () => {
      // Super_admin bypasses org-scoping and can see any org's member
      const otherOrgAccount = { ...mockBillingAccount, organizationId: "org_other" }
      mockFindFirst.mockResolvedValueOnce(otherOrgAccount)
      mockFindManySubscription.mockResolvedValueOnce([])
      mockFindManyUsage.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminMembersRoutes({
            authenticate: async () => ({
              user: { id: "super-1", email: "super@test.com" },
              organizationId: "org_own",
              role: null,
            } as MockAuthContext),
            getPlatformRole: async () => "super_admin" as PlatformAccessRole,
            isAdmin: (actor) => actor.platformRole === "super_admin",
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/members/org_other", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.member.organizationId).toBe("org_other")
    })
  })
})