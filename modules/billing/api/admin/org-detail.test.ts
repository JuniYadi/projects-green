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

const mockBillingAccountFindUnique = mock()
const mockServiceSubscriptionFindMany = mock()
const mockContactFindMany = mock()
const mockUsageLedgerAggregate = mock()
const mockInvoiceFindMany = mock()
const mockGetCachedOrganization = mock()

const mockPrismaClient = {
  billingAccount: {
    findUnique: mockBillingAccountFindUnique,
  },
  serviceSubscription: {
    findMany: mockServiceSubscriptionFindMany,
  },
  billingContact: {
    findMany: mockContactFindMany,
  },
  billingUsageLedger: {
    aggregate: mockUsageLedgerAggregate,
  },
  billingInvoice: {
    findMany: mockInvoiceFindMany,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))
mock.module("@/lib/workos-directory", () => ({
  getCachedOrganization: mockGetCachedOrganization,
  getCachedOrganizations: mock(),
}))

const { createAdminOrgDetailRoutes } = await import("./org-detail.route")

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

describe("AdminOrgDetailRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockGetCachedOrganization.mockResolvedValue(null)
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  })

  describe("GET /admin/orgs/:orgId", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super_admin", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 for empty org ID", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/orgs/")
      )

      expect(response.status).toBe(404)
    })

    it("returns 404 when org not found", async () => {
      mockBillingAccountFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns org detail with subscriptions and contacts", async () => {
      mockBillingAccountFindUnique.mockResolvedValueOnce({
        id: "ba-1",
        organizationId: VALID_UUID,
        balance: new TestDecimal(50000),
        currency: "IDR",
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })

      mockServiceSubscriptionFindMany.mockResolvedValueOnce([
        {
          id: "sub-1",
          status: "ACTIVE",
          billingMode: "PREPAID",
          package: { code: "VPN-STD" },
          plan: { code: "MONTHLY" },
        },
      ])
      mockContactFindMany.mockResolvedValueOnce([
        { id: "contact-1" },
        { id: "contact-2" },
      ])
      mockUsageLedgerAggregate.mockResolvedValueOnce({
        _sum: { amountIdr: new TestDecimal(10000) },
      })
      mockInvoiceFindMany.mockResolvedValueOnce([
        {
          id: "inv-1",
          invoiceNumber: "INV-001",
          status: "PAID",
          totalAmount: new TestDecimal(15000),
          createdAt: new Date("2026-06-01T00:00:00Z"),
        },
      ])

      mockGetCachedOrganization.mockResolvedValue({
        id: VALID_UUID,
        name: "Test Organization",
      })

      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.org.orgId).toBe(VALID_UUID)
      expect(body.org.orgName).toBe("Test Organization")
      expect(body.org.balance).toBe("50000.00")
      expect(body.org.currency).toBe("IDR")
      expect(body.org.status).toBe("ACTIVE")
      expect(body.org.subscriptions).toHaveLength(1)
      expect(body.org.subscriptions[0].packageCode).toBe("VPN-STD")
      expect(body.org.subscriptions[0].planCode).toBe("MONTHLY")
      expect(body.org.contacts).toBe(2)
      expect(body.org.monthlySpend).toBe("10000.00")
      expect(body.org.recentInvoices).toHaveLength(1)
      expect(body.org.recentInvoices[0].invoiceNumber).toBe("INV-001")
    })

    it("returns zero monthly spend when no usage", async () => {
      mockBillingAccountFindUnique.mockResolvedValueOnce({
        id: "ba-1",
        organizationId: VALID_UUID,
        balance: new TestDecimal(50000),
        currency: "IDR",
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })

      mockServiceSubscriptionFindMany.mockResolvedValueOnce([])
      mockContactFindMany.mockResolvedValueOnce([])
      mockUsageLedgerAggregate.mockResolvedValueOnce({
        _sum: { amountIdr: null },
      })
      mockInvoiceFindMany.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.org.monthlySpend).toBe("0.00")
      expect(body.org.contacts).toBe(0)
      expect(body.org.recentInvoices).toHaveLength(0)
    })

    it("allows access when default isAdmin with super_admin", async () => {
      mockBillingAccountFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
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
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      // 404 because no account found, but not 403
      expect(response.status).toBe(404)
    })

    it("returns 403 when default isAdmin with member role", async () => {
      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
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
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      expect(response.status).toBe(403)
    })

    it("returns 500 on database error", async () => {
      mockBillingAccountFindUnique.mockRejectedValueOnce(
        new Error("Database error")
      )

      const app = new Elysia()
        .use(
          createAdminOrgDetailRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(`http://localhost/admin/orgs/${VALID_UUID}`)
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
