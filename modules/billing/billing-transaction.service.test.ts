import { describe, expect, it, vi, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

const mockPrisma = {
  $transaction: vi.fn(),
  billingAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  billingAdjustment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  invoice: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  invoiceLine: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

import { BillingTransactionService } from "./billing-transaction.service"
import type { BalanceMutationInput } from "./billing-transaction.service"

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

function billingAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ba_1",
    organizationId: "org_1",
    balance: decimal("100.00"),
    currency: "IDR",
    timezone: "UTC",
    status: "ACTIVE",
    metadataJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function baseInput(overrides: Partial<BalanceMutationInput> = {}): BalanceMutationInput {
  return {
    organizationId: "org_1",
    amount: decimal("50.00"),
    currency: "IDR",
    source: "TOPUP",
    reason: "Test top-up",
    idempotencyKey: "topup:test:001",
    ...overrides,
  }
}

describe("BillingTransactionService", () => {
  let service: BillingTransactionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BillingTransactionService(mockPrisma as unknown as PrismaClient)

    // Default mock: $transaction invokes the callback with mockPrisma
    mockPrisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
      return fn(mockPrisma)
    })
  })

  describe("creditBalance", () => {
    it("credits balance with balanceBefore and balanceAfter metadata", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("150.00"),
      })
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_1",
        billingAccountId: "ba_1",
        adjustmentType: "CREDIT",
        amount: decimal("50.00"),
        currency: "IDR",
      })

      const result = await service.creditBalance(baseInput())

      expect(result.balanceBefore.toString()).toBe("100")
      expect(result.balanceAfter.toString()).toBe("150")
      expect(result.alreadyProcessed).toBe(false)

      // Verify metadata in adjustment creation
      const createCall = mockPrisma.billingAdjustment.create.mock.calls[0][0]
      expect(createCall.data.metadataJson.source).toBe("TOPUP")
      // idempotencyKey is stored under _internal to avoid leaking into user-facing API responses
      expect(createCall.data.metadataJson._internal.idempotencyKey).toBe("topup:test:001")
      expect(createCall.data.metadataJson.balanceBefore).toBe("100")
      expect(createCall.data.metadataJson.balanceAfter).toBe("150")
    })

    it("returns alreadyProcessed=true when idempotencyKey exists", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue({
        id: "adj_existing",
        metadataJson: { _internal: { idempotencyKey: "topup:test:001" } },
      })

      const result = await service.creditBalance(baseInput())

      expect(result.alreadyProcessed).toBe(true)
      expect(result.adjustmentId).toBe("adj_existing")
      // Should not create a new adjustment or update balance
      expect(mockPrisma.billingAccount.update).not.toHaveBeenCalled()
      expect(mockPrisma.billingAdjustment.create).not.toHaveBeenCalled()
    })

    it("rejects currency mismatch", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ currency: "USD" }),
      )

      await expect(
        service.creditBalance(baseInput({ currency: "IDR" })),
      ).rejects.toThrow("CURRENCY_MISMATCH")
    })

    it("throws BILLING_ACCOUNT_NOT_FOUND when account missing", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.creditBalance(baseInput()),
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")
    })

    it("rejects credit that exceeds max balance", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("999999999.00") }),
      )
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)

      await expect(
        service.creditBalance(baseInput({ amount: decimal("1.00") })),
      ).rejects.toThrow("BALANCE_LIMIT_EXCEEDED")
    })
  })

  describe("debitBalance", () => {
    it("debits balance and records metadata", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("40.00"),
      })
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_2",
        billingAccountId: "ba_1",
        adjustmentType: "DEBIT",
        amount: decimal("60.00"),
        currency: "IDR",
      })

      const result = await service.debitBalance(
        baseInput({ amount: decimal("60.00"), source: "APP_HOSTING", reason: "PAYG hourly" }),
      )

      expect(result.balanceBefore.toString()).toBe("100")
      expect(result.balanceAfter.toString()).toBe("40")
      expect(result.alreadyProcessed).toBe(false)
    })

    it("rejects insufficient balance", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("50.00") }),
      )
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)

      await expect(
        service.debitBalance(baseInput({ amount: decimal("60.00") })),
      ).rejects.toThrow("INSUFFICIENT_BALANCE")
    })

    it("rejects debit that exceeds max balance (negative overflow guard)", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("0.00") }),
      )
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)

      await expect(
        service.debitBalance(baseInput({ amount: decimal("0.01") })),
      ).rejects.toThrow("INSUFFICIENT_BALANCE")
    })
  })

  describe("debitServiceBalance", () => {
    it("creates or reuses current-month service invoice and appends line", async () => {
      const account = billingAccount()
      const now = new Date()
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("40.00"),
      })
      // No existing DRAFT service invoice — will create
      mockPrisma.invoice.findFirst.mockResolvedValue(null)
      mockPrisma.invoice.create.mockResolvedValue({
        id: "inv_svc_1",
        billingAccountId: "ba_1",
        invoiceNumber: "SVC-202606-0001",
        type: "SERVICE",
        status: "DRAFT",
        currency: "IDR",
        periodStart,
        periodEnd,
        subtotalAmount: decimal("0"),
        totalAmount: decimal("0"),
      })
      mockPrisma.invoiceLine.create.mockResolvedValue({
        id: "line_1",
        invoiceId: "inv_svc_1",
        lineType: "USAGE",
        description: "App Hosting PAYG usage",
        quantity: decimal("1"),
        unitPrice: decimal("60.00"),
        amount: decimal("60.00"),
        currency: "IDR",
      })
      mockPrisma.invoice.update.mockResolvedValue({
        id: "inv_svc_1",
        subtotalAmount: decimal("60.00"),
        totalAmount: decimal("60.00"),
      })
      mockPrisma.invoice.count.mockResolvedValue(0)
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_3",
        billingAccountId: "ba_1",
        adjustmentType: "DEBIT",
        amount: decimal("60.00"),
        currency: "IDR",
      })

      const result = await service.debitServiceBalance({
        ...baseInput({ amount: decimal("60.00"), source: "APP_HOSTING", reason: "PAYG hourly charge" }),
        line: {
          description: "App Hosting PAYG usage",
          quantity: decimal("1"),
          unitPrice: decimal("60.00"),
          lineType: "USAGE",
        },
      })

      expect(result.balanceBefore.toString()).toBe("100")
      expect(result.balanceAfter.toString()).toBe("40")
      expect(mockPrisma.invoice.findFirst).toHaveBeenCalled()
      expect(mockPrisma.invoiceLine.create).toHaveBeenCalled()
    })
  })
})
