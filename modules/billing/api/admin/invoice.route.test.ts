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
  testIsAdmin 
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

  describe("POST /admin/invoice-finalize", () => {
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
        new Request("http://localhost/admin/invoice-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
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
        new Request("http://localhost/admin/invoice-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 for missing invoiceId", async () => {
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
        new Request("http://localhost/admin/invoice-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
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
        new Request("http://localhost/admin/invoice-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "nonexistent" }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 422 when invoice is not DRAFT", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "inv-1",
        status: "OPEN",
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
        new Request("http://localhost/admin/invoice-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("INVALID_STATUS")
    })

    it("returns 200 when invoice finalized successfully", async () => {
      const mockInvoice = {
        id: "inv-1",
        invoiceNumber: "INV-2024-001",
        status: "DRAFT",
        subtotalAmount: new Decimal("100000.00"),
        taxAmount: new Decimal("11000.00"),
        discountAmount: new Decimal("0.00"),
        totalAmount: new Decimal("111000.00"),
        currency: "IDR",
        issuedAt: null,
        dueAt: null,
        paidAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      }

      const mockUpdatedInvoice = {
        ...mockInvoice,
        status: "OPEN",
        issuedAt: new Date("2024-01-15"),
        dueAt: new Date("2024-02-14"),
      }

      mockFindUnique.mockResolvedValueOnce(mockInvoice)
      mockUpdate.mockResolvedValueOnce(mockUpdatedInvoice)

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
        new Request("http://localhost/admin/invoice-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.status).toBe("OPEN")
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
        new Request("http://localhost/admin/invoice-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  describe("POST /admin/invoice-void", () => {
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
        new Request("http://localhost/admin/invoice-void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
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
        new Request("http://localhost/admin/invoice-void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 for missing invoiceId", async () => {
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
        new Request("http://localhost/admin/invoice-void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
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
        new Request("http://localhost/admin/invoice-void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "nonexistent" }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 422 when invoice is DRAFT (not OPEN or PAID)", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "inv-1",
        status: "DRAFT",
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
        new Request("http://localhost/admin/invoice-void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("INVALID_STATUS")
    })

    it("returns 200 when invoice voided successfully", async () => {
      const now = new Date()
      const mockInvoice = {
        id: "inv-1",
        invoiceNumber: "INV-2024-001",
        status: "OPEN",
        subtotalAmount: new Decimal("100000.00"),
        taxAmount: new Decimal("11000.00"),
        discountAmount: new Decimal("0.00"),
        totalAmount: new Decimal("111000.00"),
        currency: "IDR",
        issuedAt: now,
        dueAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        paidAt: null,
        createdAt: now,
        updatedAt: now,
      }

      const mockVoidedInvoice = {
        ...mockInvoice,
        status: "VOID",
      }

      mockFindUnique.mockResolvedValueOnce(mockInvoice)
      mockUpdate.mockResolvedValueOnce(mockVoidedInvoice)

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
        new Request("http://localhost/admin/invoice-void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.status).toBe("VOID")
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
        new Request("http://localhost/admin/invoice-void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: "inv-1" }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
