import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

// ─── Mocks ──────────────────────────────────────────────────────────────

// Build a tx object that PrismaTransactionClient mock passes to callbacks
function mockTx() {
  return {
    $queryRaw: mock().mockResolvedValue([]),
    whatsappDevice: {
      findUnique: mock(),
      update: mock(),
    },
    billingAccount: {
      findUnique: mock(),
    },
  }
}

const defaultTx = mockTx()

const mockBillingTransactionService = {
  creditBalance: mock(),
  debitBalance: mock(),
  debitServiceBalance: mock(),
}

// Create a separate mock for $transaction
const mockTransaction = mock()
mockTransaction.mockImplementation((cb: (...args: unknown[]) => unknown) => cb(defaultTx))

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingAccount: {
      findUnique: mock(),
    },
    whatsappDevice: {
      findUnique: mock(),
      update: mock(),
    },
    $transaction: mockTransaction,
  },
}))

import { WhatsappBillingService } from "./whatsapp-billing.service"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as unknown as {
  billingAccount: { findUnique: ReturnType<typeof mock> }
  whatsappDevice: {
    findUnique: ReturnType<typeof mock>
    update: ReturnType<typeof mock>
  }
  $transaction: ReturnType<typeof mock>
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
    addonQuota: decimal("0"),
    addonQuotaTotal: decimal("0"),
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
    mockPrisma.$transaction.mockClear()
    mockBillingTransactionService.debitServiceBalance.mockClear()
    mockBillingTransactionService.debitBalance.mockClear()
    mockBillingTransactionService.creditBalance.mockClear()

    const MockTxService = mockBillingTransactionService as unknown as ConstructorParameters<typeof WhatsappBillingService>[1]
    service = new WhatsappBillingService(
      mockPrisma as unknown as PrismaClient,
      MockTxService
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
    beforeEach(() => {
      // Reset tx mocks before each test
      defaultTx.whatsappDevice.findUnique.mockReset()
      defaultTx.whatsappDevice.update.mockReset()
      defaultTx.billingAccount.findUnique.mockReset()
    })

    it("consumes only default allowance when default covers full credit", async () => {
      defaultTx.whatsappDevice.findUnique.mockResolvedValue(
        whatsappDevice({ quotaBaseOut: decimal("100") })
      )

      const result = await service.consumeAllowanceOrChargeOverage({
        organizationId: "org_1",
        deviceId: "device_1",
        quotaCredit: decimal("3"),
        unitPrice: decimal("10.00"),
        idempotencyKey: "wa-message:req_001",
      })

      expect(result.kind).toBe("ALLOWANCE")
      if (result.kind === "ALLOWANCE") {
        expect(result.defaultConsumed.toString()).toBe("3")
        expect(result.addonConsumed.toString()).toBe("0")
        expect(result.remainingDefaultAllowance.toString()).toBe("97")
        expect(result.remainingAddonAllowance.toString()).toBe("0")
      }
      // Only default allowance was decremented
      expect(defaultTx.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device_1" },
          data: { quotaBaseOut: { decrement: decimal("3") } },
        })
      )
      expect(mockBillingTransactionService.debitServiceBalance).not.toHaveBeenCalled()
      expect(defaultTx.billingAccount.findUnique).not.toHaveBeenCalled()
    })

    it("consumes default then addon when default is insufficient but combined covers credit", async () => {
      defaultTx.whatsappDevice.findUnique.mockResolvedValue(
        whatsappDevice({ quotaBaseOut: decimal("2"), addonQuota: decimal("5") })
      )

      const result = await service.consumeAllowanceOrChargeOverage({
        organizationId: "org_1",
        deviceId: "device_1",
        quotaCredit: decimal("4"),
        unitPrice: decimal("10.00"),
        idempotencyKey: "wa-message:req_002",
      })

      expect(result.kind).toBe("ALLOWANCE")
      if (result.kind === "ALLOWANCE") {
        expect(result.defaultConsumed.toString()).toBe("2")
        expect(result.addonConsumed.toString()).toBe("2")
        expect(result.remainingDefaultAllowance.toString()).toBe("0")
        expect(result.remainingAddonAllowance.toString()).toBe("3")
      }
      expect(defaultTx.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device_1" },
          data: {
            quotaBaseOut: new Prisma.Decimal(0),
            addonQuota: { decrement: decimal("2") },
          },
        })
      )
      expect(mockBillingTransactionService.debitServiceBalance).not.toHaveBeenCalled()
    })

    it("charges overage from balance when default + addon is exhausted", async () => {
      defaultTx.whatsappDevice.findUnique.mockResolvedValue(
        whatsappDevice({ quotaBaseOut: decimal("0"), addonQuota: decimal("0") })
      )
      defaultTx.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("100.00") })
      )
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
        idempotencyKey: "wa-message:req_003",
      })

      expect(result.kind).toBe("OVERAGE_CHARGED")
      if (result.kind === "OVERAGE_CHARGED") {
        expect(result.charged.toString()).toBe("10")
        expect(result.adjustmentId).toBe("adj_overage_1")
        expect(result.defaultConsumed.toString()).toBe("0")
        expect(result.addonConsumed.toString()).toBe("0")
      }
      // Both allowances zeroed after successful charge
      expect(defaultTx.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device_1" },
          data: expect.objectContaining({
            quotaBaseOut: new Prisma.Decimal(0),
            addonQuota: new Prisma.Decimal(0),
          }),
        })
      )
      expect(mockBillingTransactionService.debitServiceBalance).toHaveBeenCalled()
    })

    it("charges partial overage when default + addon partially covers the credit", async () => {
      defaultTx.whatsappDevice.findUnique.mockResolvedValue(
        whatsappDevice({ quotaBaseOut: decimal("1"), addonQuota: decimal("2") })
      )
      defaultTx.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("100.00") })
      )
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
        // 1 default + 2 addon = 3 consumed, 7 charged at 10.00 = 70
        expect(result.charged.toString()).toBe("70")
        expect(result.defaultConsumed.toString()).toBe("1")
        expect(result.addonConsumed.toString()).toBe("2")
      }
    })

    it("throws WHATSAPP_DEVICE_NOT_FOUND when device missing", async () => {
      defaultTx.whatsappDevice.findUnique.mockResolvedValue(null)

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

    it("throws BILLING_ACCOUNT_NOT_FOUND when neither allowance nor addon cover and no billing account", async () => {
      defaultTx.whatsappDevice.findUnique.mockResolvedValue(
        whatsappDevice({ quotaBaseOut: decimal("0"), addonQuota: decimal("0") })
      )
      defaultTx.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.consumeAllowanceOrChargeOverage({
          organizationId: "org_1",
          deviceId: "device_1",
          quotaCredit: decimal("1"),
          unitPrice: decimal("10.00"),
          idempotencyKey: "wa-message:req_006",
        })
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")

      // Verify NO state mutation happened
      expect(defaultTx.whatsappDevice.update).not.toHaveBeenCalled()
      expect(mockBillingTransactionService.debitServiceBalance).not.toHaveBeenCalled()
    })

    it("rejects overage send when balance is insufficient", async () => {
      defaultTx.whatsappDevice.findUnique.mockResolvedValue(
        whatsappDevice({ quotaBaseOut: decimal("0"), addonQuota: decimal("0") })
      )
      defaultTx.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("5.00") })
      )
      mockBillingTransactionService.debitServiceBalance.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE")
      )

      await expect(
        service.consumeAllowanceOrChargeOverage({
          organizationId: "org_1",
          deviceId: "device_1",
          quotaCredit: decimal("1"),
          unitPrice: decimal("10.00"),
          idempotencyKey: "wa-message:req_007",
        })
      ).rejects.toThrow("INSUFFICIENT_BALANCE")

      // Verify NO state mutation happened — charge failed before allowance was touched
      expect(defaultTx.whatsappDevice.update).not.toHaveBeenCalled()
    })
  })

  describe("restoreAllowance", () => {
    it("restores default allowance only when default is passed", async () => {
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        ...whatsappDevice(),
        quotaBaseOut: decimal("104"),
      })

      await service.restoreAllowance("device_1", { default: decimal("4") })

      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: { quotaBaseOut: { increment: decimal("4") } },
      })
    })

    it("restores addon allowance only when addon is passed", async () => {
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        ...whatsappDevice(),
        addonQuota: decimal("105"),
      })

      await service.restoreAllowance("device_1", { addon: decimal("5") })

      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: { addonQuota: { increment: decimal("5") } },
      })
    })

    it("restores both allowances when both are passed", async () => {
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        ...whatsappDevice(),
        quotaBaseOut: decimal("102"),
        addonQuota: decimal("103"),
      })

      await service.restoreAllowance("device_1", { default: decimal("2"), addon: decimal("3") })

      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: {
          quotaBaseOut: { increment: decimal("2") },
          addonQuota: { increment: decimal("3") },
        },
      })
    })

    it("accepts number values", async () => {
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        ...whatsappDevice(),
        quotaBaseOut: decimal("104"),
      })

      await service.restoreAllowance("device_1", { default: 4 })

      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith({
        where: { id: "device_1" },
        data: { quotaBaseOut: { increment: decimal("4") } },
      })
    })

    it("skips update when neither amount is provided", async () => {
      await service.restoreAllowance("device_1", {})

      expect(mockPrisma.whatsappDevice.update).not.toHaveBeenCalled()
    })
  })
})
