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
const mockBalanceUpdate = mock()

const mockPrismaClient = {
  billingInvoice: {
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
  billingAccount: {
    update: mockBalanceUpdate,
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
            authenticate: async () => ({ user: null }) as MockAuthContext,
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
    it("sends invoice created email to resolved recipients on DRAFT→ISSUED", async () => {
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
        billingAccountId: "ba-1",
      }

      const mockUpdated = {
        ...mockInvoice,
        status: "ISSUED",
        issuedAt: new Date(),
      }

      mockFindUnique.mockResolvedValueOnce(mockInvoice)
      mockUpdate.mockResolvedValueOnce(mockUpdated)

      const mockSendInvoiceCreated = mock(async () => {})

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
            emailService: {
              sendInvoiceCreated: mockSendInvoiceCreated,
              sendPaymentReminder: mock(async () => {}),
              sendInvoicePaid: mock(async () => {}),
              sendInvoiceOverdue: mock(async () => {}),
              sendInvoiceCancelled: mock(async () => {}),
            },
            getOrganizationIdByBillingAccount: async () => "org-1",
            resolveInvoiceRecipients: async () => [
              { email: "recip1@example.com" },
              { email: "recip2@example.com" },
            ],
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
      expect(mockSendInvoiceCreated).toHaveBeenCalledTimes(2)
      expect(mockSendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "inv-1" }),
        "recip1@example.com"
      )
      expect(mockSendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "inv-1" }),
        "recip2@example.com"
      )
    })

    it("sends invoice cancelled email to resolved recipients on DRAFT→CANCELLED", async () => {
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
        billingAccountId: "ba-1",
      }

      const mockUpdated = {
        ...mockInvoice,
        status: "CANCELLED",
      }

      mockFindUnique.mockResolvedValueOnce(mockInvoice)
      mockUpdate.mockResolvedValueOnce(mockUpdated)

      const mockSendInvoiceCancelled = mock(async () => {})

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
            emailService: {
              sendInvoiceCreated: mock(async () => {}),
              sendPaymentReminder: mock(async () => {}),
              sendInvoicePaid: mock(async () => {}),
              sendInvoiceOverdue: mock(async () => {}),
              sendInvoiceCancelled: mockSendInvoiceCancelled,
            },
            getOrganizationIdByBillingAccount: async () => "org-1",
            resolveInvoiceRecipients: async () => [
              { email: "recip1@example.com" },
            ],
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
      expect(mockSendInvoiceCancelled).toHaveBeenCalledTimes(1)
      expect(mockSendInvoiceCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ id: "inv-1" }),
        "recip1@example.com"
      )
    })
    it("returns 422 when trying ISSUED→ISSUED (same status)", async () => {
      const mockInvoice = {
        id: "inv-same",
        status: "ISSUED",
        billingAccountId: null,
        organizationId: "org-1",
      }
      mockFindUnique.mockResolvedValue(mockInvoice)

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
      const res = await app.handle(
        new Request("http://localhost/admin/invoices/inv-same", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "ISSUED" }),
        })
      )
      expect(res.status).toBe(422)
  })
    it("returns 200 when OPEN→PAID transition succeeds", async () => {
      const mockInvoice = {
        id: "inv-paid",
        status: "OPEN",
        billingAccountId: "ba-1",
        organizationId: "org-1",
        subtotalAmount: new Decimal(900),
        taxAmount: new Decimal(50),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(1000),
        currency: "USD",
        invoiceNumber: "INV-001",
        createdAt: new Date("2026-01-01"),
        issuedAt: null,
        dueAt: null,
      }
      mockFindUnique.mockResolvedValue(mockInvoice)
      mockUpdate.mockResolvedValue({ ...mockInvoice, status: "PAID", paidAt: new Date(), issuedAt: null, dueAt: null })
      mockBalanceUpdate.mockResolvedValue({})

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
      const res = await app.handle(
        new Request("http://localhost/admin/invoices/inv-paid", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "PAID" }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.status).toBe("PAID")
      expect(mockBalanceUpdate).toHaveBeenCalledWith({
        where: { id: "ba-1" },
        data: { balance: { increment: mockInvoice.totalAmount } },
      })
    })

    it("returns 200 when OVERDUE→PAID transition succeeds", async () => {
      const mockInvoice = {
        id: "inv-overdue-paid",
        status: "OVERDUE",
        billingAccountId: "ba-2",
        organizationId: "org-2",
        subtotalAmount: new Decimal(1800),
        taxAmount: new Decimal(100),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(2000),
        currency: "IDR",
        invoiceNumber: "INV-002",
        createdAt: new Date("2026-01-01"),
        issuedAt: null,
        dueAt: null,
      }
      mockFindUnique.mockResolvedValue(mockInvoice)
      mockUpdate.mockResolvedValue({ ...mockInvoice, status: "PAID", paidAt: new Date() })
      mockBalanceUpdate.mockResolvedValue({})

      const app = new Elysia()
        .use(
          createAdminInvoiceRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
      const res = await app.handle(
        new Request("http://localhost/admin/invoices/inv-overdue-paid", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "PAID" }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.invoice.status).toBe("PAID")
    })
})
})
