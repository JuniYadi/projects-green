import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

import { createAdminBillingRoutes } from "./adjust.route"
import { NegativeBalanceError } from "../../types"
import type { PlatformAccessRole } from "@/lib/platform-role"
import {
  MockAuthContext,
  defaultAuth,
  mockPlatformRole,
  mockPlatformRoleNone,
  mockIsAdmin,
  testIsAdmin,
} from "@/test/helpers/test-auth"

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

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminAdjustRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  })

  describe("POST /admin/adjust", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Test credit",
          }),
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 422 for invalid amount (0)", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 0,
            reason: "Test",
          }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 422 for negative amount", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: -1000,
            reason: "Test",
          }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 422 for invalid organizationId (not UUID)", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "not-a-uuid",
            type: "CREDIT",
            amount: 50000,
            reason: "Test",
          }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 403 when not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Test credit",
          }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when billing account not found", async () => {
      mockTransaction.mockRejectedValueOnce(new Error("NOT_FOUND"))

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Test credit",
          }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 400 when DEBIT would result in negative balance", async () => {
      mockTransaction.mockRejectedValueOnce(new NegativeBalanceError())

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "DEBIT",
            amount: 100000,
            reason: "Correction",
          }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("INVALID_ADJUSTMENT")
    })

    it("returns 400 when CREDIT would exceed MAX_BALANCE", async () => {
      mockTransaction.mockRejectedValueOnce(new Error("BALANCE_LIMIT_EXCEEDED"))

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 1000000,
            reason: "Large credit",
          }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("BALANCE_LIMIT_EXCEEDED")
    })

    it("returns 200 with adjustment on valid CREDIT", async () => {
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
        reason: "Test credit",
        metadataJson: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockTransaction.mockResolvedValueOnce({
        updatedAccount: mockUpdatedAccount,
        adjustment: mockAdjustment,
      })

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Test credit",
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.adjustmentId).toBe("adj-1")
      expect(body.type).toBe("CREDIT")
      expect(body.amountIdr).toBe("50000")
    })

    it("returns 200 with adjustment on valid DEBIT", async () => {
      const mockUpdatedAccount = {
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("0.00"),
        currency: "IDR",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const mockAdjustment = {
        id: "adj-2",
        billingAccountId: "acc-1",
        adjustmentType: "DEBIT",
        amount: new Decimal("10000"),
        currency: "IDR",
        reason: "Correction debit",
        metadataJson: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockTransaction.mockResolvedValueOnce({
        updatedAccount: mockUpdatedAccount,
        adjustment: mockAdjustment,
      })

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "DEBIT",
            amount: 10000,
            reason: "Correction debit",
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.adjustmentId).toBe("adj-2")
      expect(body.type).toBe("DEBIT")
      expect(body.amountIdr).toBe("10000")
    })

    it("returns 500 for generic database error", async () => {
      mockTransaction.mockRejectedValueOnce(new Error("CONNECTION_TIMEOUT"))

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Test credit",
          }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  describe("POST /admin/adjust — transaction callback coverage", () => {
    function makeMockTransactionWithCallback() {
      mockTransaction.mockImplementation(
        async (cb: (tx: unknown) => unknown) => {
          const tx = {
            billingAccount: {
              findUnique: mockFindUnique,
              update: mockUpdate,
            },
            billingAdjustment: {
              create: mockCreate,
            },
          }
          return cb(tx)
        }
      )
    }

    it("executes transaction callback on valid CREDIT", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("50000.00"),
        currency: "IDR",
      })
      mockUpdate.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal("100000.00"),
        currency: "IDR",
      })
      mockCreate.mockResolvedValueOnce({
        id: "adj-1",
        billingAccountId: "acc-1",
        adjustmentType: "CREDIT",
        amount: new Decimal("50000"),
        currency: "IDR",
        reason: "Test credit",
      })

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Test credit",
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.adjustmentId).toBe("adj-1")
      expect(mockFindUnique).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalled()
    })

    it("executes transaction callback on valid DEBIT", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("100000.00"),
        currency: "IDR",
      })
      mockUpdate.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal("50000.00"),
        currency: "IDR",
      })
      mockCreate.mockResolvedValueOnce({
        id: "adj-2",
        billingAccountId: "acc-1",
        adjustmentType: "DEBIT",
        amount: new Decimal("50000"),
        currency: "IDR",
        reason: "Debit test",
      })

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "DEBIT",
            amount: 50000,
            reason: "Debit test",
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.type).toBe("DEBIT")
      expect(mockFindUnique).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalled()
    })

    it("throws NOT_FOUND from transaction callback", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Test",
          }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("throws NegativeBalanceError from transaction callback", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("0.00"),
        currency: "IDR",
      })

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "DEBIT",
            amount: 50000,
            reason: "Would go negative",
          }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("INVALID_ADJUSTMENT")
    })

    it("throws BALANCE_LIMIT_EXCEEDED from transaction callback", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("999999999.00"),
        currency: "IDR",
      })

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Would exceed max",
          }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("BALANCE_LIMIT_EXCEEDED")
    })
  })

  describe("POST /admin/adjust — default admin checks", () => {
    function makeMockTransactionWithCallback() {
      mockTransaction.mockImplementation(
        async (cb: (tx: unknown) => unknown) => {
          const tx = {
            billingAccount: {
              findUnique: mockFindUnique,
              update: mockUpdate,
            },
            billingAdjustment: {
              create: mockCreate,
            },
          }
          return cb(tx)
        }
      )
    }

    it("allows CREDIT when default isAdmin with super_admin", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("50000.00"),
      })
      mockUpdate.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal("100000.00"),
      })
      mockCreate.mockResolvedValueOnce({
        id: "adj-1",
        billingAccountId: "acc-1",
        adjustmentType: "CREDIT",
        amount: new Decimal("50000"),
        currency: "IDR",
        reason: "Credit",
      })

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "super_admin" as PlatformAccessRole,
            // No isAdmin override
          })
        )
        .compile()

      const res = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Credit",
          }),
        })
      )

      expect(res.status).toBe(200)
    })

    it("allows DEBIT when default isAdmin with org role owner", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "acc-1",
        organizationId: "org-1",
        balance: new Decimal("100000.00"),
      })
      mockUpdate.mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal("50000.00"),
      })
      mockCreate.mockResolvedValueOnce({
        id: "adj-2",
        billingAccountId: "acc-1",
        adjustmentType: "DEBIT",
        amount: new Decimal("50000"),
        currency: "IDR",
        reason: "Debit",
      })

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () =>
              ({
                user: { id: "owner-1" },
                organizationId: "org-1",
                role: "owner",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
            // No isAdmin override
          })
        )
        .compile()

      const res = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "DEBIT",
            amount: 50000,
            reason: "Debit",
          }),
        })
      )

      expect(res.status).toBe(200)
    })

    it("returns 403 when default isAdmin and user is member", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () =>
              ({
                user: { id: "member-1" },
                organizationId: "org-1",
                role: "member",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
            // No isAdmin override
          })
        )
        .compile()

      const res = await app.handle(
        new Request("http://localhost/admin/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
            type: "CREDIT",
            amount: 50000,
            reason: "Unauthorized",
          }),
        })
      )

      expect(res.status).toBe(403)
    })
  })
})
