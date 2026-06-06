import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

import { createAdminInvoiceRoutes } from "./invoice.route"
import {
  type MockAuthContext,
  defaultAuth,
  mockPlatformRoleNone,
  mockPlatformRole,
  mockIsAdmin,
  testIsAdmin,
} from "@/test/helpers/test-auth"

const mockFindUnique = mock()
const mockUpdate = mock()

const mockPrismaClient = {
  invoice: {
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminInvoiceRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.tenantRole === "admin" || actor.tenantRole === "owner"
  }, "tenantRole")

  describe("PATCH /admin/invoices/:id", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 for invalid status transition", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "inv-1",
        status: "PAID",
      })

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("INVALID_STATUS")
    })

    it("returns 200 when DRAFT→ISSUED transition succeeds", async () => {
      const mockInvoice = {
        id: "inv-1",
        invoiceNumber: "INV-2026-05-001",
        status: "DRAFT",
        subtotalAmount: new Decimal("100000.00"),
        taxAmount: new Decimal("0.00"),
        discountAmount: new Decimal("0.00"),
        totalAmount: new Decimal("100000.00"),
        currency: "IDR",
        issuedAt: null,
        dueAt: new Date("2026-06-15"),
        paidAt: null,
        createdAt: new Date("2026-06-01"),
      }

      const mockUpdated = {
        ...mockInvoice,
        status: "ISSUED",
        issuedAt: new Date(),
      }

      mockFindUnique.mockResolvedValueOnce(mockInvoice)
      mockUpdate.mockResolvedValueOnce(mockUpdated)

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.status).toBe("ISSUED")
    })

    it("returns 200 when DRAFT→CANCELLED transition succeeds", async () => {
      const mockInvoice = {
        id: "inv-1",
        invoiceNumber: "INV-2026-05-001",
        status: "DRAFT",
        subtotalAmount: new Decimal("100000.00"),
        taxAmount: new Decimal("0.00"),
        discountAmount: new Decimal("0.00"),
        totalAmount: new Decimal("100000.00"),
        currency: "IDR",
        issuedAt: null,
        dueAt: new Date("2026-06-15"),
        paidAt: null,
        createdAt: new Date("2026-06-01"),
      }

      const mockUpdated = {
        ...mockInvoice,
        status: "CANCELLED",
      }

      mockFindUnique.mockResolvedValueOnce(mockInvoice)
      mockUpdate.mockResolvedValueOnce(mockUpdated)

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.status).toBe("CANCELLED")
    })

    it("returns 200 when ISSUED→CANCELLED transition succeeds", async () => {
      const mockInvoice = {
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
      }

      const mockUpdated = {
        ...mockInvoice,
        status: "CANCELLED",
      }

      mockFindUnique.mockResolvedValueOnce(mockInvoice)
      mockUpdate.mockResolvedValueOnce(mockUpdated)

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.status).toBe("CANCELLED")
    })

    it("returns 404 when invoice not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/nonexistent", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 500 on database error", async () => {
      mockFindUnique.mockRejectedValueOnce(new Error("Database error"))

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })

    it("returns 422 for invalid status value in body", async () => {
      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DRAFT" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 500 when update fails after successful find", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "inv-1",
        status: "DRAFT",
      })
      mockUpdate.mockRejectedValueOnce(new Error("Update failed"))

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/invoices/inv-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
