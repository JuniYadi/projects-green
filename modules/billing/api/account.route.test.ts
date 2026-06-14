import { describe, it, expect, beforeEach, vi } from "bun:test"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"
import type { Organization } from "@workos-inc/node"

import { createBillingAccountRoutes } from "./account.route"
import { topupSchema, adminAdjustSchema, adminSubscriptionUpdateSchema } from "./billing.schemas"

describe("GET /account - JIT upsert", () => {
  const mockEnsureBillingAccountForOrg = vi.fn()
  const mockGetOrganizationAction = vi.fn()

  const mockAuth = {
    user: { id: "user-1", email: "test@example.com" },
    organizationId: "org_123",
  }

  const createRoute = () =>
    createBillingAccountRoutes({
      authenticate: async () => mockAuth,
      ensureBillingAccountForOrg: mockEnsureBillingAccountForOrg,
      getOrganizationAction: mockGetOrganizationAction as (orgId: string) => Promise<Organization>,
    })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls ensureBillingAccountForOrg when accessing account", async () => {
    const mockAccount = {
      id: "acc-1",
      organizationId: "org_123",
      balance: new Decimal(100_000),
      preferredCurrency: "USD",
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
      organizationId: "org_123",
      balance: new Decimal(500000),
      preferredCurrency: "USD",
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
    expect(data.organizationId).toBe("org_123")
    expect(data.balanceIdr).toBe("500000.00")
    expect(data.isPositive).toBe(true)
  })

  it("returns 401 when user is not authenticated", async () => {
    const createRouteUnauthorized = () =>
      createBillingAccountRoutes({
        authenticate: async () => ({ user: null, organizationId: null }),
        ensureBillingAccountForOrg: mockEnsureBillingAccountForOrg,
        getOrganizationAction: mockGetOrganizationAction,
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
        }),
        ensureBillingAccountForOrg: mockEnsureBillingAccountForOrg,
        getOrganizationAction: mockGetOrganizationAction,
      })

    const app = createRouteForbidden()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(403)
  })

  it("returns 500 on ensureBillingAccountForOrg error", async () => {
    mockEnsureBillingAccountForOrg.mockRejectedValueOnce(
      new Error("DB_CONNECTION_ERROR")
    )

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
  })

  it("includes formattedBalance, isAboveWarn, isPositive, and accountAge fields", async () => {
    const mockAccount = {
      id: "acc-1",
      organizationId: "org_123",
      balance: new Decimal(500000),
      preferredCurrency: "USD",
      currency: "USD",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.formattedBalance).toBeDefined()
    expect(typeof body.formattedBalance).toBe("string")
    expect(body.formattedBalance).toContain("USD")
    expect(body.currency).toBe("USD")
    expect(body.isAboveWarn).toBe(true)
    expect(body.isPositive).toBe(true)
    expect(body.accountAge).toBeDefined()
    expect(typeof body.accountAge).toBe("string")
  })

  it("reports accountAge as today for freshly created account", async () => {
    const mockAccount = {
      id: "acc-3",
      organizationId: "org_789",
      balance: new Decimal(100_000),
      preferredCurrency: "IDR",
      currency: "IDR",
      createdAt: new Date(), // today = diffDays === 0
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.accountAge).toBe("today")
  })

  it("reports accountAge as 1 day for yesterday-created account", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const mockAccount = {
      id: "acc-4",
      organizationId: "org_789",
      balance: new Decimal(100_000),
      preferredCurrency: "IDR",
      currency: "IDR",
      createdAt: yesterday,
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.accountAge).toBe("1 day")
  })

  it("reports isPositive=false and isAboveWarn=false for zero balance", async () => {
    const mockAccount = {
      id: "acc-2",
      organizationId: "org_456",
      balance: new Decimal(0),
      preferredCurrency: "IDR",
      currency: "IDR",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isPositive).toBe(false)
    expect(body.isAboveWarn).toBe(false)
    expect(body.balanceIdr).toBe("0.00")
  })

  it("reports isAboveWarn=false for low positive balance below threshold", async () => {
    const mockAccount = {
      id: "acc-5",
      organizationId: "org_111",
      balance: new Decimal(5000), // below MINIMUM_BALANCE_WARN_IDR (10_000)
      preferredCurrency: "IDR",
      currency: "IDR",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isPositive).toBe(true)
    expect(body.isAboveWarn).toBe(false)
    expect(body.balanceIdr).toBe("5000.00")
  })

  it("reports formattedBalance with IDR locale format for large numbers", async () => {
    const mockAccount = {
      id: "acc-6",
      organizationId: "org_222",
      balance: new Decimal(9999999),
      preferredCurrency: "IDR",
      currency: "IDR",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.formattedBalance).toContain("IDR")
    expect(body.balanceIdr).toBe("9999999.00")
  })

  it("reports accountAge with N days format for accounts older than 1 day", async () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const mockAccount = {
      id: "acc-7",
      organizationId: "org_333",
      balance: new Decimal(100_000),
      preferredCurrency: "IDR",
      currency: "IDR",
      createdAt: threeDaysAgo,
      updatedAt: new Date(),
    }

    mockEnsureBillingAccountForOrg.mockResolvedValue(mockAccount)

    const app = createRoute()
    const response = await app.handle(new Request("http://localhost/account"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.accountAge).toBe("3 days")
  })
})


// Test schema validation
describe("billingSchemas", () => {
  describe("topupSchema", () => {
    it("validates correct input", async () => {
      const validInput = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "TRF-12345",
      }

      const result = topupSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("accepts referenceId with alphanumeric and dash/underscore", async () => {
      const validInput = {
        amount: 100000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "ABC-123_xyz",
      }

      const result = topupSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("rejects referenceId with special characters", async () => {
      const invalidInput = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "TRF@#$%",
      }

      const result = topupSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("enforces max amount of 1,000,000", async () => {
      const overLimitInput = {
        amount: 2_000_000,
        paymentMethod: "manual_bank_transfer",
      }

      const result = topupSchema.safeParse(overLimitInput)
      expect(result.success).toBe(false)
    })

    it("enforces min amount of 1", async () => {
      const underLimitInput = {
        amount: 0,
        paymentMethod: "manual_bank_transfer",
      }

      const result = topupSchema.safeParse(underLimitInput)
      expect(result.success).toBe(false)
    })

    it("enforces referenceId max length of 100", async () => {
      const longRefInput = {
        amount: 50000,
        paymentMethod: "manual_bank_transfer",
        referenceId: "a".repeat(101),
      }

      const result = topupSchema.safeParse(longRefInput)
      expect(result.success).toBe(false)
    })

    it("allows missing referenceId", async () => {
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
      const validInput = {
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        type: "CREDIT",
        amount: 5000,
        reason: "Refund for downtime",
      }

      const result = adminAdjustSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates correct DEBIT input", async () => {
      const validInput = {
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        type: "DEBIT",
        amount: 5000,
        reason: "Correction",
      }

      const result = adminAdjustSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("rejects invalid organizationId UUID", async () => {
      const invalidInput = {
        organizationId: "not-a-uuid",
        type: "CREDIT",
        amount: 5000,
        reason: "Test",
      }

      const result = adminAdjustSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("rejects invalid type", async () => {
      const invalidInput = {
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        type: "REFUND",
        amount: 5000,
        reason: "Test",
      }

      const result = adminAdjustSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("enforces min amount of 1", async () => {
      const invalidInput = {
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        type: "CREDIT",
        amount: 0,
        reason: "Test",
      }

      const result = adminAdjustSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("enforces reason max length of 500", async () => {
      const invalidInput = {
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
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
      const validInput = {
        planId: "550e8400-e29b-41d4-a716-446655440000",
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates status update", async () => {
      const validInput = {
        status: "SUSPENDED",
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates allocatedConfig with cpu", async () => {
      const validInput = {
        allocatedConfig: {
          cpu: 2000,
        },
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("validates allocatedConfig with devices", async () => {
      const validInput = {
        allocatedConfig: {
          devices: 5,
        },
      }

      const result = adminSubscriptionUpdateSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("rejects invalid status", async () => {
      const invalidInput = {
        status: "PENDING",
      }

      const result = adminSubscriptionUpdateSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("rejects cpu below minimum of 100", async () => {
      const invalidInput = {
        allocatedConfig: {
          cpu: 50,
        },
      }

      const result = adminSubscriptionUpdateSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it("rejects mem below minimum of 128", async () => {
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
