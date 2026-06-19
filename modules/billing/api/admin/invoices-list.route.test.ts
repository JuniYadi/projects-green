import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

import { createAdminInvoicesListRoutes } from "./invoices-list.route"
import {
  type MockAuthContext,
  defaultAuth,
  mockPlatformRoleNone,
  mockPlatformRole,
  mockIsAdmin,
  testIsAdmin,
} from "@/test/helpers/test-auth"

const mockFindMany = mock()
const mockCount = mock()

const mockPrismaClient = {
  billingInvoice: {
    findMany: mockFindMany,
    count: mockCount,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminInvoicesListRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.tenantRole === "admin" || actor.tenantRole === "owner"
  }, "tenantRole")

  describe("GET /admin/invoices", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices")
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns paginated invoices", async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-1",
          invoiceNumber: "INV-2026-05-001",
          status: "ISSUED",
          subtotalAmount: new Decimal("100000.00"),
          taxAmount: new Decimal("0.00"),
          discountAmount: new Decimal("0.00"),
          totalAmount: new Decimal("100000.00"),
          currency: "IDR",
          issuedAt: new Date("2026-06-01"),
          dueAt: new Date("2026-06-15"),
          paidAt: null,
          createdAt: new Date("2026-06-01"),
          billingAccount: { organizationId: "org-1" },
        },
      ])
      mockCount.mockResolvedValueOnce(1)

      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices?page=1&limit=20")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoices).toHaveLength(1)
      expect(body.pagination.total).toBe(1)
    })

    it("filters by status", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices?status=OVERDUE")
      )

      expect(response.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "OVERDUE" }),
        })
      )
    })

    it("filters by organizationId", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices?organizationId=org-123")
      )

      expect(response.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            billingAccount: { organizationId: "org-123" },
          }),
        })
      )
    })

    it("returns 500 on database error", async () => {
      mockFindMany.mockRejectedValueOnce(
        new Error("Database connection failed")
      )

      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices")
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })

    it("returns 422 for invalid status query parameter", async () => {
      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices?status=INVALID")
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 422 for invalid page query parameter", async () => {
      const app = new Elysia()
        .use(
          createAdminInvoicesListRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices?page=0")
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })
  })
})
