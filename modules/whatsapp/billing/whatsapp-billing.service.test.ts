import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockBillingTransactionService = {
  creditBalance: mock(),
  debitBalance: mock(),
  debitServiceBalance: mock(),
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingAccount: {
      findUnique: mock(),
    },
    whatsappDevice: {
      findUnique: mock(),
      update: mock(),
      updateMany: mock(),
    },
  },
}))

import { WhatsappBillingService } from "./whatsapp-billing.service"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as unknown as {
  billingAccount: { findUnique: any }
  whatsappDevice: {
    findUnique: any
    update: any
    updateMany: any
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

function whatsappDevice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "device_1",
    organizationId: "org_1",
    phoneNumber: "628123456789",
    balance: decimal("0"),
    quotaBase: decimal("1000"),
    quotaBaseOut: decimal("1000"),
    dailyLimitMessage: 0,
    rates: null,
    status: "ACTIVE",
    token: null,
    tokenEncrypted: null,
    tokenIv: null,
    s3Path: null,
    whatsappBusinessAccountId: null,
    whatsappPhoneId: null,
    whatsappApplicationId: null,
    whatsappVersion: "v24.0",
    whatsappProfile: null,
    features: null,
    callbackUrl: null,
    callbackHeaderName: null,
    callbackHeaderValue: null,
    expiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("WhatsappBillingService", () => {
  let service: WhatsappBillingService

  beforeEach(() => {
    mockPrisma.billingAccount.findUnique.mockClear()
    mockPrisma.whatsappDevice.findUnique.mockClear()
    mockPrisma.whatsappDevice.update.mockClear()
    mockPrisma.whatsappDevice.updateMany.mockClear()
    mockBillingTransactionService.debitServiceBalance.mockClear()
    mockBillingTransactionService.debitBalance.mockClear()
    mockBillingTransactionService.creditBalance.mockClear()

    // Recreate with fresh mocks
    const MockTxService = mockBillingTransactionService
    service = new WhatsappBillingService(
      mockPrisma as unknown as PrismaClient,
      MockTxService as never
    )
  })

  describe("chargeMonthlyBase", () => {
    it("charges monthly base price and resets allowance", async () => {
      const account = billingAccount()
      const device = whatsappDevice()

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_monthly_1",
        balanceBefore: decimal("500.00"),
        balanceAfter: decimal("450.00"),
        amount: decimal("50.00"),
        currency: "IDR",
        alreadyProcessed: false,
      })
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        ...device,
        quotaBaseOut: 5000,
      })

      const result = await service.chargeMonthlyBase({
        organizationId: "org_1",
        deviceId: "device_1",
        amount: decimal("50.00"),
        allowance: 5000,
        period: "2026-06",
      })

      expect(
        mockBillingTransactionService.debitServiceBalance
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          amount: decimal("50.00"),
          source: "WHATSAPP",
          reason: expect.stringContaining("monthly base"),
          idempotencyKey: "wa-base:device_1:2026-06",
          line: expect.objectContaining({
            description: expect.stringContaining("monthly base"),
            lineType: "SUBSCRIPTION",
          }),
        })
      )

      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device_1" },
          data: { quotaBaseOut: 5000 },
        })
      )

      expect(result.adjustmentId).toBe("adj_monthly_1")
      expect(result.alreadyProcessed).toBe(false)
    })

    it("throws BILLING_ACCOUNT_NOT_FOUND when billing account missing", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.chargeMonthlyBase({
          organizationId: "org_missing",
          deviceId: "device_1",
          amount: decimal("50.00"),
          allowance: 5000,
          period: "2026-06",
        })
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")
    })

    it("does not double-charge monthly base for same device and period (idempotency)", async () => {
      const account = billingAccount()

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_monthly_1",
        balanceBefore: decimal("500.00"),
        balanceAfter: decimal("500.00"),
        amount: decimal("50.00"),
        currency: "IDR",
        alreadyProcessed: true,
      })

      const result = await service.chargeMonthlyBase({
        organizationId: "org_1",
        deviceId: "device_1",
        amount: decimal("50.00"),
        allowance: 5000,
        period: "2026-06",
      })

      expect(result.alreadyProcessed).toBe(true)
      expect(
        mockBillingTransactionService.debitServiceBalance
      ).toHaveBeenCalledTimes(1)
    })

    it("rejects monthly activation when base price cannot be covered", async () => {
      const account = billingAccount({ balance: decimal("10.00") })

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE")
      )

      await expect(
        service.chargeMonthlyBase({
          organizationId: "org_1",
          deviceId: "device_1",
          amount: decimal("50.00"),
          allowance: 5000,
          period: "2026-06",
        })
      ).rejects.toThrow("INSUFFICIENT_BALANCE")
    })
  })

  describe("consumeAllowanceOrChargeOverage", () => {
    it("consumes allowance without debiting balance when allowance is sufficient", async () => {
      const device = whatsappDevice({ quotaBaseOut: decimal("100") })

      // Atomic update succeeds (allowance >= 1)
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 1 })
      // Follow-up read to get remaining allowance
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        ...device,
        quotaBaseOut: decimal("99"),
      })

      const result = await service.consumeAllowanceOrChargeOverage({
        organizationId: "org_1",
        deviceId: "device_1",
        quotaCredit: decimal("1"),
        unitPrice: decimal("10.00"),
        idempotencyKey: "wa-message:req_001",
      })

      expect(result.kind).toBe("ALLOWANCE")
      expect((result as { remainingAllowance: Prisma.Decimal }).remainingAllowance.toString()).toBe("99")

      expect(mockPrisma.whatsappDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device_1", quotaBaseOut: { gte: decimal("1") } },
          data: { quotaBaseOut: { decrement: decimal("1") } },
        })
      )
      expect(
        mockBillingTransactionService.debitServiceBalance
      ).not.toHaveBeenCalled()
      expect(mockBillingTransactionService.debitBalance).not.toHaveBeenCalled()
    })

    it("charges overage immediately when allowance is exhausted", async () => {
      const device = whatsappDevice({ quotaBaseOut: decimal("0") })
      const account = billingAccount({ balance: decimal("100.00") })

      // Atomic update fails (quotaBaseOut=0 < 1)
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      // Re-read gets current allowance
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue(device)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_overage_1",
        balanceBefore: decimal("100.00"),
        balanceAfter: decimal("90.00"),
        amount: decimal("10.00"),
        currency: "IDR",
        alreadyProcessed: false,
      })

      const result = await service.consumeAllowanceOrChargeOverage({
        organizationId: "org_1",
        deviceId: "device_1",
        quotaCredit: decimal("1"),
        unitPrice: decimal("10.00"),
        idempotencyKey: "wa-message:req_002",
      })

      expect(result.kind).toBe("OVERAGE_CHARGED")
      if (result.kind === "OVERAGE_CHARGED") {
        expect(result.charged.toString()).toBe("10")
        expect(result.adjustmentId).toBe("adj_overage_1")
      }

      // Allowance was already 0, so no update to zero it
      expect(mockPrisma.whatsappDevice.update).not.toHaveBeenCalled()

      expect(
        mockBillingTransactionService.debitServiceBalance
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          amount: decimal("10.00"),
          source: "WHATSAPP",
          reason: expect.stringContaining("overage"),
          idempotencyKey: "wa-message:req_002",
          line: expect.objectContaining({
            description: expect.stringContaining("overage"),
            lineType: "USAGE",
          }),
        })
      )
    })

    it("rejects overage send when balance is insufficient", async () => {
      const device = whatsappDevice({ quotaBaseOut: 0 })
      const account = billingAccount({ balance: decimal("5.00") })

      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue(device)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE")
      )

      await expect(
        service.consumeAllowanceOrChargeOverage({
          organizationId: "org_1",
          deviceId: "device_1",
          quotaCredit: decimal("1"),
          unitPrice: decimal("10.00"),
          idempotencyKey: "wa-message:req_003",
        })
      ).rejects.toThrow("INSUFFICIENT_BALANCE")

      // Verify NO state mutation happened — charge failed before allowance was touched
      expect(mockPrisma.whatsappDevice.update).not.toHaveBeenCalled()
    })

    it("charges partial allowance + overage when allowance partially covers", async () => {
      const device = whatsappDevice({ quotaBaseOut: decimal("3") })
      const account = billingAccount({ balance: decimal("100.00") })

      // Atomic update fails (3 < 10)
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      // Re-read gets current allowance
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue(device)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_overage_2",
        balanceBefore: decimal("100.00"),
        balanceAfter: decimal("30.00"),
        amount: decimal("70.00"),
        currency: "IDR",
        alreadyProcessed: false,
      })

      const result = await service.consumeAllowanceOrChargeOverage({
        organizationId: "org_1",
        deviceId: "device_1",
        quotaCredit: decimal("10"),
        unitPrice: decimal("10.00"),
        idempotencyKey: "wa-message:req_004",
      })

      expect(result.kind).toBe("OVERAGE_CHARGED")
      if (result.kind === "OVERAGE_CHARGED") {
        expect(result.charged.toString()).toBe("70")
      }

      // After successful charge, allowance is zeroed
      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device_1" },
          data: { quotaBaseOut: new Prisma.Decimal(0) },
        })
      )
    })

    it("throws WHATSAPP_DEVICE_NOT_FOUND when device missing", async () => {
      // Atomic update fails (no matching device, or allowance < 1)
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      // Re-read returns null — device doesn't exist
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue(null)

      await expect(
        service.consumeAllowanceOrChargeOverage({
          organizationId: "org_1",
          deviceId: "device_missing",
          quotaCredit: decimal("1"),
          unitPrice: decimal("10.00"),
          idempotencyKey: "wa-message:req_005",
        })
      ).rejects.toThrow("WHATSAPP_DEVICE_NOT_FOUND")
    })

    it("does not create grace state for WhatsApp (no grace period)", async () => {
      const device = whatsappDevice({ quotaBaseOut: decimal("0") })

      // Atomic update fails
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      // Device exists but billing account missing
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue(device)
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.consumeAllowanceOrChargeOverage({
          organizationId: "org_1",
          deviceId: "device_1",
          quotaCredit: decimal("1"),
          unitPrice: decimal("10.00"),
          idempotencyKey: "wa-message:req_006",
        })
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")

      // Verify NO state mutation happened (allowance not zeroed, no debit)
      expect(mockPrisma.whatsappDevice.update).not.toHaveBeenCalled()
      expect(
        mockBillingTransactionService.debitServiceBalance
      ).not.toHaveBeenCalled()
    })
  })

  describe("restoreAllowance", () => {
    it("increments quotaBaseOut by the given amount (number)", async () => {
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        ...whatsappDevice(),
        quotaBaseOut: decimal("104"),
      })

      await service.restoreAllowance("device_1", 4)

      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: { quotaBaseOut: { increment: decimal("4") } },
      })
    })

    it("increments quotaBaseOut by the given amount (Decimal)", async () => {
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        ...whatsappDevice(),
        quotaBaseOut: decimal("104"),
      })

      await service.restoreAllowance("device_1", decimal("2.5"))

      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: { quotaBaseOut: { increment: decimal("2.5") } },
      })
    })
  })
})
