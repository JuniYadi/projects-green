import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"
import { MockAuthContext } from "@/test/helpers/test-auth"
import { createBillingTopupRoutes } from "./topup.route"

const mockFindUnique = mock()
const mockUpdate = mock()
const mockCreate = mock()
const mockTransaction = mock()

const mockPrismaClient = {
  billingAccount: {
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
  billingAdjustment: {
    create: mockCreate,
  },
  $transaction: mockTransaction,
}

// Mock prisma module before importing route
mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("TopupRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("POST /topup", () => {
    it("returns 410 in production and directs to /api/payments/topup", async () => {
      const origEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"

      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "manual_bank_transfer" }),
        })
      )

      expect(response.status).toBe(410)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("REAL_TOPUP_REQUIRED")

      process.env.NODE_ENV = origEnv
    })

    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "manual_bank_transfer" }),
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
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: null,
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "manual_bank_transfer" }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 for amount 0", async () => {
      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 0, paymentMethod: "manual_bank_transfer" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.fieldErrors).toBeDefined()
    })

    it("returns 422 for negative amount", async () => {
      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: -1000, paymentMethod: "manual_bank_transfer" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 422 for amount exceeding 1M", async () => {
      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 1_500_000, paymentMethod: "manual_bank_transfer" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 422 for invalid payment method", async () => {
      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "credit_card" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 404 when billing account not found", async () => {
      mockTransaction.mockResolvedValueOnce(Promise.reject(new Error("NOT_FOUND")))

      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "manual_bank_transfer" }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 400 when balance would exceed MAX_BALANCE", async () => {
      mockTransaction.mockResolvedValueOnce(Promise.reject(new Error("BALANCE_LIMIT_EXCEEDED")))

      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 50000, paymentMethod: "manual_bank_transfer" }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("BALANCE_LIMIT_EXCEEDED")
    })

    it("returns 200 with adjustment response on valid topup", async () => {
      const mockUpdatedAccount = {
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("100000.00"),
        currency: "IDR",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const mockAdjustment = {
        id: "adj-1",
        billingAccountId: "acc-1",
        adjustmentType: "CREDIT",
        amount: new Decimal("50000"),
        currency: "IDR",
        reason: "Topup via manual_bank_transfer (ref: TRF-12345)",
        metadataJson: { paymentMethod: "manual_bank_transfer", referenceId: "TRF-12345", phase: "simulated" },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockTransaction.mockResolvedValueOnce({
        updatedAccount: mockUpdatedAccount,
        adjustment: mockAdjustment,
      })

      const app = new Elysia()
        .use(
          createBillingTopupRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 50000,
            paymentMethod: "manual_bank_transfer",
            referenceId: "TRF-12345",
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.adjustmentId).toBe("adj-1")
      expect(body.newBalanceIdr).toBe("100000.00")
      expect(body.amountIdr).toBe("50000")
      expect(body.type).toBe("CREDIT")
    })
  })
})