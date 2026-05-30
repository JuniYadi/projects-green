import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { createBillingInvoicesRoutes } from "./invoices.route"

type MockAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

const mockFindUnique = mock()
const mockFindMany = mock()
const mockFindFirst = mock()

const mockPrismaClient = {
  billingAccount: {
    findUnique: mockFindUnique,
  },
  invoice: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("InvoicesRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("GET /invoices", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
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
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: null,
            } as MockAuthContext),
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
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
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
      mockFindUnique.mockResolvedValueOnce({ id: "acc-1", organizationId: "org-1" })
      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-1",
          invoiceNumber: "INV-2026-001",
          status: "PAID",
          issuedAt: new Date("2026-05-01"),
          dueAt: new Date("2026-05-15"),
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
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
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
  })

  describe("GET /invoices/:id", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
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
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: null,
            } as MockAuthContext),
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

    it("returns 404 when billing account not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
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

    it("returns 404 when invoice not found", async () => {
      mockFindUnique.mockResolvedValueOnce({ id: "acc-1", organizationId: "org-1" })
      mockFindFirst.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createBillingInvoicesRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
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
      mockFindUnique.mockResolvedValueOnce({ id: "acc-1", organizationId: "org-1" })
      mockFindFirst.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-2026-001",
        status: "PENDING",
        issuedAt: new Date("2026-05-01"),
        dueAt: new Date("2026-05-15"),
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
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
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
  })
})