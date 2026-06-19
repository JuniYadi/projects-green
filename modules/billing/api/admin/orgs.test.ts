import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal } from "@/test/helpers/prisma-mock"

import { createAdminOrgsRoutes } from "./orgs.route"
import {
  type MockAuthContext,
  defaultAuth,
  mockPlatformRole,
  mockPlatformRoleNone,
  testIsAdmin,
} from "@/test/helpers/test-auth"

const mockBillingAccountFindMany = mock()
const mockBillingAccountCount = mock()
const mockServiceSubscriptionFindMany = mock()
const mockUsageLedgerFindMany = mock()

const mockPrismaClient = {
  billingAccount: {
    findMany: mockBillingAccountFindMany,
    count: mockBillingAccountCount,
  },
  serviceSubscription: {
    findMany: mockServiceSubscriptionFindMany,
  },
  billingUsageLedger: {
    findMany: mockUsageLedgerFindMany,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminOrgsRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  })

  describe("GET /admin/orgs", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs")
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super_admin", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns paginated org list", async () => {
      const mockAccounts = [
        {
          organizationId: "org-1",
          balance: new TestDecimal(50000),
          currency: "IDR",
        },
        {
          organizationId: "org-2",
          balance: new TestDecimal(25000),
          currency: "IDR",
        },
      ]

      mockBillingAccountFindMany.mockResolvedValueOnce(mockAccounts)
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([
        { organizationId: "org-1" },
        { organizationId: "org-1" },
        { organizationId: "org-2" },
      ])
      mockUsageLedgerFindMany.mockResolvedValueOnce([
        { organizationId: "org-1", amountIdr: new TestDecimal(10000) },
        { organizationId: "org-1", amountIdr: new TestDecimal(5000) },
        { organizationId: "org-2", amountIdr: new TestDecimal(8000) },
      ])
      mockBillingAccountCount.mockResolvedValueOnce(2)

      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.orgs).toHaveLength(2)
      expect(body.orgs[0].orgId).toBe("org-1")
      expect(body.orgs[0].orgName).toBe("org-1")
      expect(body.orgs[0].balance).toBe("50000.00")
      expect(body.orgs[0].activeSubscriptions).toBe(2)
      expect(body.orgs[0].monthlySpend).toBe("15000.00")
      expect(body.orgs[1].orgId).toBe("org-2")
      expect(body.orgs[1].activeSubscriptions).toBe(1)
      expect(body.orgs[1].monthlySpend).toBe("8000.00")
      expect(body.pagination.total).toBe(2)
      expect(body.pagination.totalPages).toBe(1)
    })

    it("returns empty array when no orgs", async () => {
      mockBillingAccountFindMany.mockResolvedValueOnce([])
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockUsageLedgerFindMany.mockResolvedValueOnce([])
      mockBillingAccountCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.orgs).toHaveLength(0)
      expect(body.pagination.total).toBe(0)
    })

    it("supports search parameter", async () => {
      mockBillingAccountFindMany.mockResolvedValueOnce([])
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockUsageLedgerFindMany.mockResolvedValueOnce([])
      mockBillingAccountCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs?search=acme")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })

    it("returns 422 for invalid limit", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs?limit=0")
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("allows access when default isAdmin with super_admin", async () => {
      mockBillingAccountFindMany.mockResolvedValueOnce([])
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockUsageLedgerFindMany.mockResolvedValueOnce([])
      mockBillingAccountCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "super_admin",
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs")
      )

      expect(response.status).toBe(200)
    })

    it("returns 403 when default isAdmin with member role", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () =>
              ({
                user: { id: "member-1" },
                organizationId: "org-1",
                role: "member",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "none",
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs")
      )

      expect(response.status).toBe(403)
    })

    it("returns 500 on database error", async () => {
      mockBillingAccountFindMany.mockRejectedValueOnce(
        new Error("Database error")
      )

      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs")
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
