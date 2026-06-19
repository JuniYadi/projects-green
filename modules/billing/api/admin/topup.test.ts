import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

import { createAdminTopupRoutes } from "./topup.route"
import type { PlatformAccessRole } from "@/lib/platform-role"
import {
  MockAuthContext,
  defaultAuth,
  mockPlatformRole,
  mockPlatformRoleNone,
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

describe("AdminTopupRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("POST /admin/topup", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Test topup",
          }),
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super_admin", async () => {
      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Test topup",
          }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 for missing orgId", async () => {
      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 50000,
            reason: "Test topup",
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
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: -1000,
            reason: "Test",
          }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 404 for non-existent org", async () => {
      mockTransaction.mockRejectedValueOnce(new Error("NOT_FOUND"))

      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Test topup",
          }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 400 when balance would exceed limit", async () => {
      mockTransaction.mockRejectedValueOnce(
        new Error("BALANCE_LIMIT_EXCEEDED")
      )

      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Would exceed",
          }),
        })
      )

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("BALANCE_LIMIT_EXCEEDED")
    })

    it("successfully credits balance and creates adjustment", async () => {
      mockTransaction.mockResolvedValueOnce({
        updatedAccount: {
          id: "acc-1",
          organizationId: "org-1",
          balance: new Decimal("100000.00"),
          currency: "IDR",
        },
        adjustment: {
          id: "adj-1",
          billingAccountId: "acc-1",
          adjustmentType: "CREDIT",
          amount: new Decimal("50000"),
          currency: "IDR",
          reason: "Admin topup",
        },
      })

      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Admin topup",
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.adjustmentId).toBe("adj-1")
      expect(body.type).toBe("CREDIT")
      expect(body.newBalanceIdr).toBe("100000.00")
      expect(body.amountIdr).toBe("50000")
    })

    it("returns 500 for generic database error", async () => {
      mockTransaction.mockRejectedValueOnce(
        new Error("CONNECTION_TIMEOUT")
      )

      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Test",
          }),
        })
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  describe("POST /admin/topup — transaction callback coverage", () => {
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

    it("executes transaction callback on valid topup", async () => {
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
        reason: "Admin topup",
      })

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Admin topup",
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

    it("throws NOT_FOUND from transaction callback", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      makeMockTransactionWithCallback()

      const app = new Elysia()
        .use(
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
            amount: 50000,
            reason: "Test",
          }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
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
          createAdminTopupRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "550e8400-e29b-41d4-a716-446655440000",
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
})
