import { describe, it, expect, beforeEach, vi } from "bun:test"
import { Prisma } from "@prisma/client"

import { createBillingAccountRoutes } from "./account.route"

describe("GET /account - JIT upsert", () => {
  const mockEnsureBillingAccountForOrg = vi.fn()
  const mockGetOrganizationAction = vi.fn()

  const mockAuth = {
    user: { id: "user-1", email: "test@example.com" },
    organizationId: "org_123",
  }

  const createRoute = () =>
    createBillingAccountRoutes({
      authenticate: async () => mockAuth as any,
      ensureBillingAccountForOrg: mockEnsureBillingAccountForOrg as any,
      getOrganizationAction: mockGetOrganizationAction as any,
    })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls ensureBillingAccountForOrg when accessing account", async () => {
    const mockAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(100_000),
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.ok).toBe(true)
    expect(mockEnsureBillingAccountForOrg).toHaveBeenCalledWith({
      organizationId: "org_123",
      getOrganizationAction: mockGetOrganizationAction,
    })
  })

  it("returns account balance info from upserted account", async () => {
    const mockAccount = {
      id: "acc-1",
      tenantId: "tenant-1",
      organizationId: "org_123",
      balance: new Prisma.Decimal(500000),
      currency: "USD",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.tenantId).toBe("tenant-1")
    expect(data.balanceIdr).toBe("500000.00")
    expect(data.isPositive).toBe(true)
  })

  it("returns 401 when user is not authenticated", async () => {
    const createRouteUnauthorized = () =>
      createBillingAccountRoutes({
        authenticate: async () => ({ user: null, organizationId: null }) as any,
        ensureBillingAccountForOrg: mockEnsureBillingAccountForOrg as any,
        getOrganizationAction: mockGetOrganizationAction as any,
      })

    const app = createRouteUnauthorized()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(401)
  })

  it("returns 403 when no active organization", async () => {
    const createRouteForbidden = () =>
      createBillingAccountRoutes({
        authenticate: async () => ({
          user: { id: "user-1", email: "test@example.com" },
          organizationId: null,
        }) as any,
        ensureBillingAccountForOrg: mockEnsureBillingAccountForOrg as any,
        getOrganizationAction: mockGetOrganizationAction as any,
      })

    const app = createRouteForbidden()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(403)
  })
})

// Test schema validation
describe("billingSchemas", () => {
  describe("topupSchema", () => {
    it("validates correct input", async () => {
      const { topupSchema } = require("./billing.schemas")

      const validInput = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "TRF-12345",
      }

      const result = topupSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("accepts referenceId with alphanumeric and dash/underscore", async () => {
      const { topupSchema } = require("./billing.schemas")

      const validInput = {
        amount: 100000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "ABC-123_xyz",
      }

      const result = topupSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("rejects referenceId with special characters", async () => {
      const { topupSchema } = require("./billing.schemas")

      const invalidInput = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "TRF@#$%",
      }

      const result = topupSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("enforces max amount of 1,000,000", async () => {
      const { topupSchema } = require("./billing.schemas")

      const overLimitInput = {
        amount: 2_000_000,
        paymentMethod: "manual_bank_transfer",
      }

      const result = topupSchema.safeParse(overLimitInput)
      expect(result.success).toBe(false)
    })

    it("enforces min amount of 1", async () => {
      const { topupSchema } = require("./billing.schemas")

      const underLimitInput = {
        amount: 0,
        paymentMethod: "manual_bank_transfer",
      }

      const result = topupSchema.safeParse(underLimitInput)
      expect(result.success).toBe(false)
    })

    it("enforces referenceId max length of 100", async () => {
      const { topupSchema } = require("./billing.schemas")

      const longRefInput = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "a".repeat(101),
      }

      const result = topupSchema.safeParse(longRefInput)
      expect(result.success).toBe(false)
    })

    it("allows missing referenceId", async () => {
      const { topupSchema } = require("./billing.schemas")

      const noRefInput = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer",
      }

      const result = topupSchema.safeParse(noRefInput)
      expect(result.success).toBe(true)
    })
  })

  describe("adminAdjustSchema", () => {
    it("validates correct CREDIT input", async () => {
      const { adminAdjustSchema } = require("./billing.schemas")

      const validInput = {
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        type: "CREDIT",
        amount: 5000,
        reason: "Refund for downtime",
      }

      const result = adminAdjustSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates correct DEBIT input", async () => {
      const { adminAdjustSchema } = require("./billing.schemas")

      const validInput = {
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        type: "DEBIT",
        amount: 5000,
        reason: "Correction",
      }

      const result = adminAdjustSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("rejects invalid tenantId UUID", async () => {
      const { adminAdjustSchema } = require("./billing.schemas")

      const invalidInput = {
        tenantId: "not-a-uuid",
        type: "CREDIT",
        amount: 5000,
        reason: "Test",
      }

      const result = adminAdjustSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("rejects invalid type", async () => {
      const { adminAdjustSchema } = require("./billing.schemas")

      const invalidInput = {
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        type: "REFUND",
        amount: 5000,
        reason: "Test",
      }

      const result = adminAdjustSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("enforces min amount of 1", async () => {
      const { adminAdjustSchema } = require("./billing.schemas")

      const invalidInput = {
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        type: "CREDIT",
        amount: 0,
        reason: "Test",
      }

      const result = adminAdjustSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("enforces reason max length of 500", async () => {
      const { adminAdjustSchema } = require("./billing.schemas")

      const invalidInput = {
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        type: "CREDIT",
        amount: 5000,
        reason: "x".repeat(501),
      }

      const result = adminAdjustSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })
  })

  describe("adminSubscriptionUpdateSchema", () => {
    it("validates planId only update", async () => {
      const { adminSubscriptionUpdateSchema } = require("./billing.schemas")

      const validInput = {
        planId: "550e8400-e29b-41d4-a716-446655440000",
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates status update", async () => {
      const { adminSubscriptionUpdateSchema } = require("./billing.schemas")

      const validInput = {
        status: "SUSPENDED",
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates allocatedConfig with cpu", async () => {
      const { adminSubscriptionUpdateSchema } = require("./billing.schemas")

      const validInput = {
        allocatedConfig: {
          cpu: 2000,
        },
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates allocatedConfig with devices", async () => {
      const { adminSubscriptionUpdateSchema } = require("./billing.schemas")

      const validInput = {
        allocatedConfig: {
          devices: 5,
        },
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("rejects invalid status", async () => {
      const { adminSubscriptionUpdateSchema } = require("./billing.schemas")

      const invalidInput = {
        status: "PENDING",
      }

      const result = adminSubscriptionUpdateSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("rejects cpu below minimum of 100", async () => {
      const { adminSubscriptionUpdateSchema } = require("./billing.schemas")

      const invalidInput = {
        allocatedConfig: {
          cpu: 50,
        },
      }

      const result = adminSubscriptionUpdateSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("rejects mem below minimum of 128", async () => {
      const { adminSubscriptionUpdateSchema } = require("./billing.schemas")

      const invalidInput = {
        allocatedConfig: {
          mem: 64,
        },
      }

      const result = adminSubscriptionUpdateSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })
  })
})