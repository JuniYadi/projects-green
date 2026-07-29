import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal } from "@/test/helpers/prisma-mock"
import type { MockAuthContext } from "@/test/helpers/test-auth"
import {
  defaultAuth,
  mockPlatformRole,
  mockPlatformRoleNone,
  testIsAdmin,
} from "@/test/helpers/test-auth"

const mockBillingAccountFindMany = mock()
const mockBillingAccountCount = mock()
const mockServiceSubscriptionFindMany = mock()
const mockUsageLedgerFindMany = mock()
const mockGetCachedOrganizations = mock()
const mockGetCachedOrganizationsMetadata = mock()
const mockRefreshCachedOrganizationsMetadata = mock()
const mockSupportTicketGroupBy = mock()

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
  supportTicket: {
    groupBy: mockSupportTicketGroupBy,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))
mock.module("@/lib/workos-directory", () => ({
  getCachedOrganization: mock(),
  getCachedOrganizations: mockGetCachedOrganizations,
  getCachedOrganizationsMetadata: mockGetCachedOrganizationsMetadata,
  refreshCachedOrganizationsMetadata: mockRefreshCachedOrganizationsMetadata,
}))

const { createAdminOrgsRoutes } = await import("./orgs.route")

describe("AdminOrgsRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockGetCachedOrganizations.mockResolvedValue(new Map())
    mockGetCachedOrganizationsMetadata.mockResolvedValue(new Map())
    mockRefreshCachedOrganizationsMetadata.mockResolvedValue(new Map())
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

    it("returns paginated org list with owner and member metadata", async () => {
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
      mockSupportTicketGroupBy.mockResolvedValueOnce([])

      mockGetCachedOrganizations.mockResolvedValue(
        new Map([
          ["org-1", { id: "org-1", name: "Org One" }],
          ["org-2", { id: "org-2", name: "Org Two" }],
        ])
      )
      mockGetCachedOrganizationsMetadata.mockResolvedValue(
        new Map([
          [
            "org-1",
            {
              organizationId: "org-1",
              ownerUserId: "user-1",
              ownerName: "Jane Owner",
              ownerEmail: "jane@example.com",
              memberCount: 3,
              refreshedAt: "2025-07-29T00:00:00.000Z",
            },
          ],
          [
            "org-2",
            {
              organizationId: "org-2",
              ownerUserId: null,
              ownerName: null,
              ownerEmail: null,
              memberCount: 1,
              refreshedAt: "2025-07-29T00:00:00.000Z",
            },
          ],
        ])
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

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.orgs).toHaveLength(2)
      expect(body.orgs[0].orgId).toBe("org-1")
      expect(body.orgs[0].orgName).toBe("Org One")
      expect(body.orgs[0].balance).toBe("50000.00")
      expect(body.orgs[0].activeSubscriptions).toBe(2)
      expect(body.orgs[0].monthlySpend).toBe("15000.00")
      expect(body.orgs[0].openTicketCount).toBe(0)
      // metadata fields
      expect(body.orgs[0].ownerUserId).toBe("user-1")
      expect(body.orgs[0].ownerName).toBe("Jane Owner")
      expect(body.orgs[0].ownerEmail).toBe("jane@example.com")
      expect(body.orgs[0].memberCount).toBe(3)
      expect(body.orgs[0].metadataRefreshedAt).toBe("2025-07-29T00:00:00.000Z")
      expect(body.orgs[1].ownerUserId).toBe(null)
      expect(body.orgs[1].ownerName).toBe(null)
      expect(body.orgs[1].memberCount).toBe(1)
      expect(body.pagination.total).toBe(2)
      expect(body.pagination.totalPages).toBe(1)
    })

    it("returns empty array when no orgs", async () => {
      mockBillingAccountFindMany.mockResolvedValueOnce([])
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockUsageLedgerFindMany.mockResolvedValueOnce([])
      mockBillingAccountCount.mockResolvedValueOnce(0)
      mockSupportTicketGroupBy.mockResolvedValueOnce([])

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

    it("supports search by organization name", async () => {
      const acmeAccount = {
        id: "acct-1",
        organizationId: "org-1",
        balance: new TestDecimal("100000"),
        currency: "IDR",
        status: "ACTIVE" as const,
        createdAt: new Date("2025-01-01"),
      }
      const betaAccount = {
        id: "acct-2",
        organizationId: "org-2",
        balance: new TestDecimal("50000"),
        currency: "IDR",
        status: "ACTIVE" as const,
        createdAt: new Date("2025-02-01"),
      }

      mockBillingAccountFindMany.mockResolvedValueOnce([
        acmeAccount,
        betaAccount,
      ])
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockUsageLedgerFindMany.mockResolvedValueOnce([])
      mockBillingAccountCount.mockResolvedValueOnce(2)
      mockSupportTicketGroupBy.mockResolvedValueOnce([])
      mockGetCachedOrganizations.mockResolvedValue(
        new Map([
          ["org-1", { id: "org-1", name: "Acme Corporation" }],
          ["org-2", { id: "org-2", name: "Beta Industries" }],
        ])
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
        new Request("http://localhost/admin/orgs?search=acme")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.orgs.length).toBe(1)
      expect(body.orgs[0].orgName).toBe("Acme Corporation")
      expect(body.pagination.total).toBe(1)
    })

    it("supports search by UUID substring", async () => {
      mockBillingAccountFindMany.mockResolvedValueOnce([])
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockUsageLedgerFindMany.mockResolvedValueOnce([])
      mockBillingAccountCount.mockResolvedValueOnce(0)
      mockSupportTicketGroupBy.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs?search=550e8400-e29b-41d4")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })

    it("filters by currency", async () => {
      const idrAccount = {
        organizationId: "org-1",
        balance: new TestDecimal(50000),
        currency: "IDR",
      }

      mockBillingAccountFindMany.mockResolvedValueOnce([idrAccount])
      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockUsageLedgerFindMany.mockResolvedValueOnce([])
      mockBillingAccountCount.mockResolvedValueOnce(1)
      mockSupportTicketGroupBy.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs?currency=IDR")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.orgs).toHaveLength(1)
      expect(mockBillingAccountFindMany).toHaveBeenCalled()
      const findManyCall = mockBillingAccountFindMany.mock.calls[0]?.[0]
      expect(findManyCall?.where).toMatchObject({
        status: "ACTIVE",
        currency: "IDR",
      })
      expect(mockBillingAccountCount.mock.calls[0]?.[0]?.where).toMatchObject({
        status: "ACTIVE",
        currency: "IDR",
      })
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
      mockSupportTicketGroupBy.mockResolvedValueOnce([])

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

  describe("POST /admin/orgs/metadata/refresh", () => {
    it("refreshes selected organization metadata", async () => {
      mockRefreshCachedOrganizationsMetadata.mockResolvedValueOnce(
        new Map([
          [
            "org-1",
            {
              organizationId: "org-1",
              ownerUserId: "user-1",
              ownerName: "Jane Owner",
              ownerEmail: "jane@example.com",
              memberCount: 3,
              refreshedAt: "2025-07-29T00:00:00.000Z",
            },
          ],
          [
            "org-2",
            {
              organizationId: "org-2",
              ownerUserId: "user-2",
              ownerName: "Bob Admin",
              ownerEmail: "bob@example.com",
              memberCount: 1,
              refreshedAt: "2025-07-29T00:00:00.000Z",
            },
          ],
        ])
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
        new Request("http://localhost/admin/orgs/metadata/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgIds: ["org-1", "org-2"] }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({ ok: true, refreshed: 2 })
      expect(mockRefreshCachedOrganizationsMetadata).toHaveBeenCalledWith([
        "org-1",
        "org-2",
      ])
    })

    it("returns 422 for empty orgIds array", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs/metadata/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgIds: [] }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toEqual({
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Invalid organization metadata refresh request.",
      })
    })

    it("returns 401 when not authenticated", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgsRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs/metadata/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgIds: ["org-1"] }),
        })
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
        new Request("http://localhost/admin/orgs/metadata/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgIds: ["org-1"] }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })
  })
})
