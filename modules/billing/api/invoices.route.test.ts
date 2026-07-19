import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"
import { MockAuthContext } from "@/test/helpers/test-auth"

const mockFindMany = mock()
const mockFindUnique = mock()
const mockFindFirst = mock()
const mockBillingInvoiceFindUnique = mock()

const mockPrismaClient = {
  billingAccount: {
    findUnique: mockFindUnique,
  },
  billingInvoice: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    findUnique: mockBillingInvoiceFindUnique,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

// Dynamic import after mock registration so the mock is in place before the route module loads
const { createBillingInvoicesRoutes } = await import("./invoices.route")

describe("InvoicesRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("GET /invoices", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices", {
          method: "GET",
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when no organization", async () => {
      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: null,
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices", {
          method: "GET",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 200 with empty invoices when no billing account", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: "org-1",
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoices).toEqual([])
    })

    it("returns 200 with formatted invoices", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "acc-1",
        organizationId: "org-1",
      })
      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-1",
          invoiceNumber: "INV-2026-001",
          status: "PAID",
          type: "SUBSCRIPTION",
          paymentMethod: "BANK_TRANSFER",
          metadata: null,
          issuedAt: new Date("2026-05-01"),
          dueAt: new Date("2026-05-15"),
          dueDate: null,
          createdAt: new Date("2026-05-01"),
          periodStart: new Date("2026-05-01"),
          periodEnd: new Date("2026-05-31"),
          totalAmount: new Decimal("299000"),
          currency: "IDR",
          lines: [
            {
              description: "WhatsApp Standard Plan",
              quantity: new Decimal("1"),
              unitPrice: new Decimal("299000"),
              amount: new Decimal("299000"),
            },
          ],
        },
      ])

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: "org-1",
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoices).toHaveLength(1)
      expect(body.invoices[0]).toMatchObject({
        id: "inv-1",
        invoiceNumber: "INV-2026-001",
        status: "PAID",
        totalAmountIdr: "299000.00",
        currency: "IDR",
      })
    })

    it("returns 500 on database error for list", async () => {
      mockFindUnique.mockRejectedValueOnce(new Error("Database error"))

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: "org-1",
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices", {
          method: "GET",
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  describe("GET /invoices/:id", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices/inv-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(401)
    })

    it("returns 403 when no organization", async () => {
      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: null,
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices/inv-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(403)
    })

    it("returns 404 when invoice not found", async () => {
      mockBillingInvoiceFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: "org-1",
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices/inv-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 200 with invoice detail", async () => {
      mockBillingInvoiceFindUnique.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-2026-001",
        status: "PENDING",
        type: "SUBSCRIPTION",
        paymentMethod: "BANK_TRANSFER",
        metadata: null,
        issuedAt: new Date("2026-05-01"),
        dueAt: new Date("2026-05-15"),
        dueDate: null,
        createdAt: new Date("2026-05-01"),
        periodStart: new Date("2026-05-01"),
        periodEnd: new Date("2026-05-31"),
        totalAmount: new Decimal("299000"),
        currency: "IDR",
        lines: [
          {
            description: "WhatsApp Standard Plan",
            quantity: new Decimal("1"),
            unitPrice: new Decimal("299000"),
            amount: new Decimal("299000"),
          },
        ],
      })

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: "org-1",
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices/inv-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.invoice).toMatchObject({
        id: "inv-1",
        invoiceNumber: "INV-2026-001",
        status: "PENDING",
        totalAmountIdr: "299000.00",
      })
    })

    it("returns 500 on database error for detail", async () => {
      mockBillingInvoiceFindUnique.mockRejectedValueOnce(
        new Error("Database error")
      )

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () =>
              ({
                user: { id: "user-1" },
                organizationId: "org-1",
              }) as MockAuthContext,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/invoices/inv-1", {
          method: "GET",
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
