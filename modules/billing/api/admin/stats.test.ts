import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal } from "@/test/helpers/prisma-mock"

import {
  type MockAuthContext,
  defaultAuth,
  mockPlatformRole,
  mockPlatformRoleNone,
  testIsAdmin,
} from "@/test/helpers/test-auth"

const mockBillingAccountAggregate = mock()
const mockBillingAccountCount = mock()
const mockUsageLedgerAggregate = mock()
const mockBillingInvoiceCount = mock()
const mockSupportTicketCount = mock()

const mockPrismaClient = {
  billingAccount: {
    aggregate: mockBillingAccountAggregate,
    count: mockBillingAccountCount,
  },
  billingUsageLedger: {
    aggregate: mockUsageLedgerAggregate,
  },
  billingInvoice: {
    count: mockBillingInvoiceCount,
  },
  supportTicket: {
    count: mockSupportTicketCount,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

// Dynamic import after mock registration
const { createAdminStatsRoutes } = await import("./stats.route")

describe("AdminStatsRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  })

  describe("GET /admin/stats", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminStatsRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/stats")
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super_admin", async () => {
      const app = new Elysia()
        .use(
          createAdminStatsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/stats")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns correct stats for super_admin", async () => {
      mockBillingAccountAggregate.mockResolvedValueOnce({
        _sum: { balance: new TestDecimal(50000) },
      })
      mockUsageLedgerAggregate.mockResolvedValueOnce({
        _sum: { amountIdr: new TestDecimal(25000) },
      })
      mockBillingAccountCount.mockResolvedValueOnce(10).mockResolvedValueOnce(2)
      mockBillingInvoiceCount.mockResolvedValueOnce(5)
      mockSupportTicketCount.mockResolvedValueOnce(3)

      const app = new Elysia()
        .use(
          createAdminStatsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/stats")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.totalBalance).toBe("50000.00")
      expect(body.activeOrgs).toBe(10)
      expect(body.totalSpend).toBe("25000.00")
      expect(body.lowBalanceOrgs).toBe(2)
      expect(body.openInvoices).toBe(5)
      expect(body.openTickets).toBe(3)
    })

    it("returns zero values when no data", async () => {
      mockBillingAccountAggregate.mockResolvedValueOnce({
        _sum: { balance: null },
      })
      mockUsageLedgerAggregate.mockResolvedValueOnce({
        _sum: { amountIdr: null },
      })
      mockBillingAccountCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      mockBillingInvoiceCount.mockResolvedValueOnce(0)
      mockSupportTicketCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminStatsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/stats")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.totalBalance).toBe("0.00")
      expect(body.activeOrgs).toBe(0)
      expect(body.totalSpend).toBe("0.00")
      expect(body.lowBalanceOrgs).toBe(0)
      expect(body.openInvoices).toBe(0)
      expect(body.openTickets).toBe(0)
    })

    it("allows access when default isAdmin with super_admin", async () => {
      mockBillingAccountAggregate.mockResolvedValueOnce({
        _sum: { balance: new TestDecimal(0) },
      })
      mockUsageLedgerAggregate.mockResolvedValueOnce({
        _sum: { amountIdr: new TestDecimal(0) },
      })
      mockBillingAccountCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      mockBillingInvoiceCount.mockResolvedValueOnce(0)
      mockSupportTicketCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminStatsRoutes({
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
        new Request("http://localhost/admin/stats")
      )

      expect(response.status).toBe(200)
    })

    it("returns 403 when default isAdmin with member role", async () => {
      const app = new Elysia()
        .use(
          createAdminStatsRoutes({
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
        new Request("http://localhost/admin/stats")
      )

      expect(response.status).toBe(403)
    })

    it("returns 500 on database error", async () => {
      mockBillingAccountAggregate.mockRejectedValueOnce(
        new Error("Database error")
      )

      const app = new Elysia()
        .use(
          createAdminStatsRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/stats")
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
