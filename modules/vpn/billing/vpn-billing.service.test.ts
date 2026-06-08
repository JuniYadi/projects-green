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
  },
}))

import { VpnBillingService } from "./vpn-billing.service"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as unknown as {
  billingAccount: { findUnique: ReturnType<typeof mock> }
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

// ─── Tests ──────────────────────────────────────────────────────────────

describe("VpnBillingService", () => {
  let service: VpnBillingService

  beforeEach(() => {
    mockPrisma.billingAccount.findUnique.mockClear()
    mockBillingTransactionService.debitServiceBalance.mockClear()
    mockBillingTransactionService.debitBalance.mockClear()
    mockBillingTransactionService.creditBalance.mockClear()

    service = new VpnBillingService(
      mockPrisma as unknown as PrismaClient,
      mockBillingTransactionService as never,
    )
  })

  describe("chargeMonthly", () => {
    it("charges vpn monthly upfront via BillingTransactionService with VPN source", async () => {
      const account = billingAccount()

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_vpn_1",
        balanceBefore: decimal("500.00"),
        balanceAfter: decimal("475.00"),
        amount: decimal("25.00"),
        currency: "IDR",
        alreadyProcessed: false,
      })

      const result = await service.chargeMonthly({
        organizationId: "org_1",
        vpnSubscriptionId: "sub_vpn_1",
        regionCode: "INDONESIA",
        amount: decimal("25.00"),
        period: "2026-06",
      })

      expect(
        mockBillingTransactionService.debitServiceBalance,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          amount: decimal("25.00"),
          currency: "IDR",
          source: "VPN",
          reason: expect.stringContaining("monthly"),
          idempotencyKey: "vpn-monthly:sub_vpn_1:2026-06",
          metadata: expect.objectContaining({
            vpnSubscriptionId: "sub_vpn_1",
            regionCode: "INDONESIA",
            period: "2026-06",
          }),
          line: expect.objectContaining({
            description: "VPN INDONESIA monthly payment",
            quantity: new Prisma.Decimal(1),
            unitPrice: decimal("25.00"),
            lineType: "SUBSCRIPTION",
          }),
        }),
      )

      expect(result.adjustmentId).toBe("adj_vpn_1")
      expect(result.alreadyProcessed).toBe(false)
    })

    it("uses one idempotency key per vpn subscription period", async () => {
      const account = billingAccount()

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_vpn_1",
        balanceBefore: decimal("500.00"),
        balanceAfter: decimal("500.00"),
        amount: decimal("25.00"),
        currency: "IDR",
        alreadyProcessed: true,
      })

      const result = await service.chargeMonthly({
        organizationId: "org_1",
        vpnSubscriptionId: "sub_vpn_1",
        regionCode: "INDONESIA",
        amount: decimal("25.00"),
        period: "2026-06",
      })

      // Idempotency key is stable per (subscription, period) so the second
      // call within the same period returns alreadyProcessed without
      // debiting balance a second time.
      expect(
        mockBillingTransactionService.debitServiceBalance,
      ).toHaveBeenCalledTimes(1)
      expect(
        mockBillingTransactionService.debitServiceBalance.mock.calls[0][0]
          .idempotencyKey,
      ).toBe("vpn-monthly:sub_vpn_1:2026-06")
      expect(result.alreadyProcessed).toBe(true)
    })

    it("uses different idempotency key when period changes (renewal)", async () => {
      const account = billingAccount()

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_vpn_2",
        balanceBefore: decimal("500.00"),
        balanceAfter: decimal("475.00"),
        amount: decimal("25.00"),
        currency: "IDR",
        alreadyProcessed: false,
      })

      await service.chargeMonthly({
        organizationId: "org_1",
        vpnSubscriptionId: "sub_vpn_1",
        regionCode: "INDONESIA",
        amount: decimal("25.00"),
        period: "2026-07",
      })

      expect(
        mockBillingTransactionService.debitServiceBalance.mock.calls[0][0]
          .idempotencyKey,
      ).toBe("vpn-monthly:sub_vpn_1:2026-07")
    })

    it("rejects vpn charging when balance is insufficient", async () => {
      const account = billingAccount({ balance: decimal("10.00") })

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE"),
      )

      await expect(
        service.chargeMonthly({
          organizationId: "org_1",
          vpnSubscriptionId: "sub_vpn_1",
          regionCode: "INDONESIA",
          amount: decimal("25.00"),
          period: "2026-06",
        }),
      ).rejects.toThrow("INSUFFICIENT_BALANCE")
    })

    it("throws BILLING_ACCOUNT_NOT_FOUND when billing account missing", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.chargeMonthly({
          organizationId: "org_missing",
          vpnSubscriptionId: "sub_vpn_1",
          regionCode: "INDONESIA",
          amount: decimal("25.00"),
          period: "2026-06",
        }),
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")

      expect(
        mockBillingTransactionService.debitServiceBalance,
      ).not.toHaveBeenCalled()
    })

    it("propagates account currency to billing transaction (no hardcoded IDR)", async () => {
      const account = billingAccount({
        balance: decimal("2.00"),
        currency: "USD",
      })

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockBillingTransactionService.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_vpn_usd",
        balanceBefore: decimal("2.00"),
        balanceAfter: decimal("1.50"),
        amount: decimal("0.50"),
        currency: "USD",
        alreadyProcessed: false,
      })

      await service.chargeMonthly({
        organizationId: "org_1",
        vpnSubscriptionId: "sub_vpn_usd",
        regionCode: "INDONESIA",
        amount: decimal("0.50"),
        period: "2026-06",
      })

      expect(
        mockBillingTransactionService.debitServiceBalance,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "USD",
          amount: decimal("0.50"),
          idempotencyKey: "vpn-monthly:sub_vpn_usd:2026-06",
        }),
      )
    })
  })
})
