import { describe, expect, it, vi, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockBillingTransactionService = {
  creditBalance: vi.fn(),
  debitBalance: vi.fn(),
  debitServiceBalance: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    billingAccount: {
      findUnique: vi.fn(),
    },
    applicationStack: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/modules/billing/billing-transaction.service", () => ({
  BillingTransactionService: vi.fn().mockImplementation(() => mockBillingTransactionService),
}))

import { AppHostingBillingService } from "./app-hosting-billing.service"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as unknown as {
  billingAccount: { findUnique: ReturnType<typeof vi.fn> }
  applicationStack: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

function billingAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ba_1",
    organizationId: "org_1",
    balance: decimal("500.00"),
    currency: "IDR",
    timezone: "UTC",
    status: "ACTIVE",
    metadataJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function applicationStack(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "stack_1",
    organizationId: "org_1",
    name: "my-app",
    status: "RUNNING",
    resourcePlanId: "payg",
    billingMode: "PAYG",
    hourlyCost: decimal("5.00"),
    metadataJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("AppHostingBillingService", () => {
  let service: AppHostingBillingService

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.billingAccount.findUnique.mockReset()
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.update.mockReset()
    mockBillingTransactionService.debitServiceBalance.mockReset()
    mockBillingTransactionService.debitBalance.mockReset()
    mockBillingTransactionService.creditBalance.mockReset()
    service = new AppHostingBillingService(
      mockPrisma as unknown as PrismaClient,
      mockBillingTransactionService as never,
    )
  })

  describe("normalizeBufferHours", () => {
    it("defaults to 24 when null or undefined", () => {
      expect(service.normalizeBufferHours(null)).toBe(24)
      expect(service.normalizeBufferHours(undefined)).toBe(24)
    })

    it("clamps values below 24 to 24", () => {
      expect(service.normalizeBufferHours(0)).toBe(24)
      expect(service.normalizeBufferHours(12)).toBe(24)
      expect(service.normalizeBufferHours(-5)).toBe(24)
    })

    it("allows values >= 24", () => {
      expect(service.normalizeBufferHours(24)).toBe(24)
      expect(service.normalizeBufferHours(48)).toBe(48)
      expect(service.normalizeBufferHours(100)).toBe(100)
    })

    it("floors decimal values", () => {
      expect(service.normalizeBufferHours(25.7)).toBe(25)
      expect(service.normalizeBufferHours(24.1)).toBe(24)
    })
  })

  describe("quotePayg", () => {
    it("returns required balance = hourlyCost * bufferHours", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(billingAccount())

      const quote = await service.quotePayg({
        organizationId: "org_1",
        hourlyCost: decimal("5.00"),
        bufferHours: 48,
      })

      expect(quote.requiredBalance.toString()).toBe("240")
      expect(quote.bufferHours).toBe(48)
      expect(quote.hourlyCost.toString()).toBe("5")
      expect(quote.currency).toBe("IDR")
    })

    it("uses default 24 buffer when not specified", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(billingAccount())

      const quote = await service.quotePayg({
        organizationId: "org_1",
        hourlyCost: decimal("10.00"),
      })

      expect(quote.requiredBalance.toString()).toBe("240")
      expect(quote.bufferHours).toBe(24)
    })

    it("clamps buffer below 24 to 24", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(billingAccount())

      const quote = await service.quotePayg({
        organizationId: "org_1",
        hourlyCost: decimal("5.00"),
        bufferHours: 12,
      })

      expect(quote.requiredBalance.toString()).toBe("120")
      expect(quote.bufferHours).toBe(24)
    })

    it("throws BILLING_ACCOUNT_NOT_FOUND when account missing", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.quotePayg({
          organizationId: "org_1",
          hourlyCost: decimal("5.00"),
        }),
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")
    })
  })

  describe("assertCanStartPayg", () => {
    it("returns quote when balance covers required buffer", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("500.00") }),
      )

      const quote = await service.assertCanStartPayg({
        organizationId: "org_1",
        hourlyCost: decimal("5.00"),
        bufferHours: 48,
      })

      expect(quote.requiredBalance.toString()).toBe("240")
    })

    it("rejects when balance is insufficient for buffer", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("100.00") }),
      )

      await expect(
        service.assertCanStartPayg({
          organizationId: "org_1",
          hourlyCost: decimal("5.00"),
          bufferHours: 48,
        }),
      ).rejects.toThrow("INSUFFICIENT_PAYG_BUFFER")
    })

    it("rejects when balance exactly equals required", async () => {
      // balance 120, hourly 5, buffer 24 => required 120 => balance >= required, should pass
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("120.00") }),
      )

      const quote = await service.assertCanStartPayg({
        organizationId: "org_1",
        hourlyCost: decimal("5.00"),
        bufferHours: 24,
      })

      expect(quote.requiredBalance.toString()).toBe("120")
    })

    it("rejects when balance is just below required", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("119.99") }),
      )

      await expect(
        service.assertCanStartPayg({
          organizationId: "org_1",
          hourlyCost: decimal("5.00"),
          bufferHours: 24,
        }),
      ).rejects.toThrow("INSUFFICIENT_PAYG_BUFFER")
    })
  })

  describe("chargePaygRuntimeHour", () => {
    it("charges hourly runtime through billing transactions", async () => {
      const stack = applicationStack()
      const account = billingAccount()
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_1",
        balanceBefore: decimal("500.00"),
        balanceAfter: decimal("495.00"),
        amount: decimal("5.00"),
        currency: "IDR",
        alreadyProcessed: false,
      })

      const result = await service.chargePaygRuntimeHour({
        organizationId: "org_1",
        stackId: "stack_1",
        hourlyCost: decimal("5.00"),
        occurredAt: new Date("2026-06-04T10:00:00Z"),
      })

      expect(result.alreadyProcessed).toBe(false)
      expect(mockBillingTransactionService.debitServiceBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          amount: decimal("5.00"),
          source: "APP_HOSTING",
          line: expect.objectContaining({
            description: "App Hosting PAYG runtime hour",
            lineType: "USAGE",
          }),
        }),
      )
    })

    it("returns alreadyProcessed when idempotency key exists", async () => {
      const stack = applicationStack()
      const account = billingAccount()
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_existing",
        balanceBefore: decimal("495.00"),
        balanceAfter: decimal("495.00"),
        amount: decimal("5.00"),
        currency: "IDR",
        alreadyProcessed: true,
      })

      const result = await service.chargePaygRuntimeHour({
        organizationId: "org_1",
        stackId: "stack_1",
        hourlyCost: decimal("5.00"),
        occurredAt: new Date("2026-06-04T10:00:00Z"),
      })

      expect(result.alreadyProcessed).toBe(true)
    })

    it("marks app PAYMENT_GRACE when hourly charge fails", async () => {
      const stack = applicationStack()
      const account = billingAccount({ balance: decimal("0.00") })
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE"),
      )
      mockPrisma.applicationStack.update.mockResolvedValue({ ...stack })

      const result = await service.chargePaygRuntimeHour({
        organizationId: "org_1",
        stackId: "stack_1",
        hourlyCost: decimal("5.00"),
        occurredAt: new Date("2026-06-04T10:00:00Z"),
      })

      expect(result.graceEntered).toBe(true)
      expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "stack_1" },
          data: expect.objectContaining({
            metadataJson: expect.objectContaining({
              billingState: "PAYMENT_GRACE",
            }),
          }),
        }),
      )
    })

    it("throws BILLING_ACCOUNT_NOT_FOUND when account missing", async () => {
      const stack = applicationStack()
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.chargePaygRuntimeHour({
          organizationId: "org_1",
          stackId: "stack_1",
          hourlyCost: decimal("5.00"),
          occurredAt: new Date("2026-06-04T10:00:00Z"),
        }),
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")
    })
  })

  describe("chargeMonthlyPackage", () => {
    it("charges monthly package upfront through billing transactions", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_2",
        balanceBefore: decimal("500.00"),
        balanceAfter: decimal("300.00"),
        amount: decimal("200.00"),
        currency: "IDR",
        alreadyProcessed: false,
      })

      const result = await service.chargeMonthlyPackage({
        organizationId: "org_1",
        amount: decimal("200.00"),
        subscriptionId: "sub_1",
        stackId: "stack_1",
        idempotencyKey: "app-package:stack_1:2026-06",
      })

      expect(result.alreadyProcessed).toBe(false)
      expect(mockBillingTransactionService.debitServiceBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          amount: decimal("200.00"),
          source: "PACKAGE",
          line: expect.objectContaining({
            description: "App Hosting monthly package",
            lineType: "SUBSCRIPTION",
          }),
        }),
      )
    })

    it("rejects when balance is insufficient for package", async () => {
      const account = billingAccount({ balance: decimal("50.00") })
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE"),
      )

      await expect(
        service.chargeMonthlyPackage({
          organizationId: "org_1",
          amount: decimal("200.00"),
          subscriptionId: "sub_1",
          stackId: "stack_1",
          idempotencyKey: "app-package:stack_1:2026-06",
        }),
      ).rejects.toThrow("INSUFFICIENT_BALANCE")
    })
  })

  describe("checkGraceAndSuspend", () => {
    it("suspends app after 24 hours in payment grace", async () => {
      const graceStartedAt = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      const stack = applicationStack({
        metadataJson: {
          billingState: "PAYMENT_GRACE",
          billingGraceStartedAt: graceStartedAt.toISOString(),
        },
      })
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
      mockPrisma.applicationStack.update.mockResolvedValue({
        ...stack,
        status: "SUSPENDED",
      })

      const result = await service.checkGraceAndSuspend({ stackId: "stack_1" })

      expect(result.suspended).toBe(true)
      expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "stack_1" },
          data: expect.objectContaining({
            status: "SUSPENDED",
            metadataJson: expect.objectContaining({
              billingState: "SUSPENDED",
            }),
          }),
        }),
      )
    })

    it("does not suspend when within 24-hour grace window", async () => {
      const graceStartedAt = new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      const stack = applicationStack({
        metadataJson: {
          billingState: "PAYMENT_GRACE",
          billingGraceStartedAt: graceStartedAt.toISOString(),
        },
      })
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)

      const result = await service.checkGraceAndSuspend({ stackId: "stack_1" })

      expect(result.suspended).toBe(false)
      expect(mockPrisma.applicationStack.update).not.toHaveBeenCalled()
    })

    it("clears payment grace when balance is sufficient after top-up", async () => {
      const stack = applicationStack({
        metadataJson: {
          billingState: "PAYMENT_GRACE",
          billingGraceStartedAt: new Date().toISOString(),
        },
      })
      const account = billingAccount({ balance: decimal("500.00") })
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.applicationStack.update.mockResolvedValue(stack)

      const result = await service.clearGraceIfFunded({
        stackId: "stack_1",
        organizationId: "org_1",
        hourlyCost: decimal("5.00"),
      })

      expect(result.cleared).toBe(true)
      expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "stack_1" },
          data: expect.objectContaining({
            metadataJson: expect.not.objectContaining({
              billingState: "PAYMENT_GRACE",
            }),
          }),
        }),
      )
    })

    it("does not clear grace when balance is still insufficient", async () => {
      const stack = applicationStack({
        metadataJson: {
          billingState: "PAYMENT_GRACE",
          billingGraceStartedAt: new Date().toISOString(),
        },
      })
      const account = billingAccount({ balance: decimal("2.00") })
      mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)

      const result = await service.clearGraceIfFunded({
        stackId: "stack_1",
        organizationId: "org_1",
        hourlyCost: decimal("5.00"),
      })

      expect(result.cleared).toBe(false)
      expect(mockPrisma.applicationStack.update).not.toHaveBeenCalled()
    })
  })
})
