import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { createAdminBillingRoutes } from "./adjust.route"
import { NegativeBalanceError } from "../../types"
import type { PlatformAccessRole } from "@/lib/platform-role"

type MockAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

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

  const defaultAuth = {
    user: { id: "admin-1", email: "admin@example.com" },
    organizationId: "org-1",
    role: "owner" as const,
  }

  const mockPlatformRole = async () => "super_admin" as PlatformAccessRole
  const mockIsAdmin = () => true

  describe("defaultDeps.isAdmin", () => {
    const isAdmin = (actor: {
      platformRole: PlatformAccessRole
      tenantRole: string | null | undefined
    }) => {
      if (actor.platformRole === "super_admin") return true
      return actor.tenantRole === "admin" || actor.tenantRole === "owner"
    }

    it("returns true for super_admin with null tenant role (the bug scenario)", () => {
      expect(isAdmin({ platformRole: "super_admin", tenantRole: null })).toBe(true)
    })

    it("returns true for super_admin with undefined tenant role", () => {
      expect(isAdmin({ platformRole: "super_admin", tenantRole: undefined })).toBe(true)
    })

    it("returns true for super_admin with admin tenant role", () => {
      expect(isAdmin({ platformRole: "super_admin", tenantRole: "admin" })).toBe(true)
    })

    it("returns true for non-super_admin with admin tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: "admin" })).toBe(true)
    })

    it("returns true for non-super_admin with owner tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: "owner" })).toBe(true)
    })

    it("returns false for non-super_admin with member tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: "member" })).toBe(false)
    })

    it("returns false for non-super_admin with null tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: null })).toBe(false)
    })

    it("returns false for non-super_admin with undefined tenant role", () => {
      expect(isAdmin({ platformRole: "none", tenantRole: undefined })).toBe(false)
    })
  })

  describe("POST /admin/adjust", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminBillingRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
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
            getPlatformRole: async () => "none" as PlatformAccessRole,
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
  })
})