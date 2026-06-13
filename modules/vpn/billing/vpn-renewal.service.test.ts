import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

// ─── Mocks ──────────────────────────────────────────────────────────────
//
// Leaf-dependency mocks only per AGENTS.md. The renewal service takes its
// prisma + transactions via constructor, so we inject plain mocks rather
// than mock.module to avoid cross-file cache pollution.

const mockTransactions = {
  debitServiceBalance: mock(),
}

const mockPrisma = {
  vpnSubscription: {
    findMany: mock(),
    update: mock(),
    updateMany: mock(),
  },
}

import { VpnRenewalService } from "./vpn-renewal.service"

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

const NOW = new Date("2026-06-15T00:00:00Z")

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_vpn_1",
    organizationId: "org_1",
    packageId: "pkg_vpn",
    priceLocked: decimal("100000"),
    currency: "IDR",
    status: "ACTIVE",
    renewalFailedAt: null,
    currentPeriodStart: new Date("2026-05-15T00:00:00Z"),
    currentPeriodEnd: new Date("2026-06-15T00:00:00Z"),
    ...overrides,
  }
}

const createService = () =>
  new VpnRenewalService(
    mockPrisma as never,
    mockTransactions as never
  )

beforeEach(() => {
  mockPrisma.vpnSubscription.findMany.mockReset()
  mockPrisma.vpnSubscription.update.mockReset()
  mockPrisma.vpnSubscription.updateMany.mockReset()
  mockTransactions.debitServiceBalance.mockReset()
  mockTransactions.debitServiceBalance.mockResolvedValue({
    billingAccountId: "ba_1",
    adjustmentId: "adj_renew",
    balanceBefore: decimal("500000"),
    balanceAfter: decimal("400000"),
    amount: decimal("100000"),
    currency: "IDR",
    alreadyProcessed: false,
  })
  mockPrisma.vpnSubscription.update.mockImplementation(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: args.where.id,
      ...args.data,
    })
  )
})

describe("VpnRenewalService", () => {
  describe("renewDueSubscriptions", () => {
    it("renews due subscriptions at the locked price and extends period", async () => {
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription()])
        .mockResolvedValueOnce([])
      mockPrisma.vpnSubscription.updateMany.mockResolvedValue({ count: 1 })

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.renewed).toBe(1)
      expect(result.suspended).toBe(0)
      expect(result.expired).toBe(0)
      expect(result.errors).toBe(0)

      expect(mockTransactions.debitServiceBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          amount: decimal("100000"),
          currency: "IDR",
          source: "VPN",
          idempotencyKey: "vpn-package:sub_vpn_1:2026-06",
        })
      )
      expect(mockPrisma.vpnSubscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "sub_vpn_1",
            currentPeriodEnd: { lte: NOW },
          }),
          data: expect.objectContaining({
            status: "ACTIVE",
            renewalFailedAt: null,
          }),
        })
      )
    })

    it("scans ACTIVE and SUSPENDED subscriptions that are due", async () => {
      mockPrisma.vpnSubscription.findMany.mockResolvedValue([])

      await createService().renewDueSubscriptions(NOW)

      expect(mockPrisma.vpnSubscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["ACTIVE", "SUSPENDED"] },
            currentPeriodEnd: { lte: NOW },
          }),
        })
      )
    })
  })

  describe("grace ladder on INSUFFICIENT_BALANCE", () => {
    beforeEach(() => {
      mockTransactions.debitServiceBalance.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE")
      )
    })

    it("day 0: records renewalFailedAt and retries (no suspend)", async () => {
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription({ renewalFailedAt: null })])
        .mockResolvedValueOnce([])

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.retried).toBe(1)
      expect(result.suspended).toBe(0)
      expect(result.expired).toBe(0)
      expect(mockPrisma.vpnSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub_vpn_1" },
          data: { renewalFailedAt: NOW },
        })
      )
    })

    it("day 3: suspends the subscription", async () => {
      const failedAt = new Date("2026-06-12T00:00:00Z") // 3 days before NOW
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription({ renewalFailedAt: failedAt })])
        .mockResolvedValueOnce([])

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.suspended).toBe(1)
      expect(result.expired).toBe(0)
      expect(mockPrisma.vpnSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub_vpn_1" },
          data: expect.objectContaining({ status: "SUSPENDED" }),
        })
      )
    })

    it("day 7: expires the subscription", async () => {
      const failedAt = new Date("2026-06-08T00:00:00Z") // 7 days before NOW
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription({ renewalFailedAt: failedAt })])
        .mockResolvedValueOnce([])

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.expired).toBe(1)
      expect(result.suspended).toBe(0)
      expect(mockPrisma.vpnSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub_vpn_1" },
          data: { status: "EXPIRED" },
        })
      )
    })
  })

  describe("idempotency & safety", () => {
    it("skips extension when charge was already processed", async () => {
      mockTransactions.debitServiceBalance.mockResolvedValue({
        billingAccountId: "ba_1",
        adjustmentId: "adj_renew",
        balanceBefore: decimal("400000"),
        balanceAfter: decimal("400000"),
        amount: decimal("100000"),
        currency: "IDR",
        alreadyProcessed: true,
      })
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription()])
        .mockResolvedValueOnce([])

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.renewed).toBe(0)
      expect(mockPrisma.vpnSubscription.updateMany).not.toHaveBeenCalled()
    })

    it("does not double-extend (updateMany WHERE guard returns 0)", async () => {
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription()])
        .mockResolvedValueOnce([])
      mockPrisma.vpnSubscription.updateMany.mockResolvedValue({ count: 0 })

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.renewed).toBe(0)
      expect(result.errors).toBe(0)
    })

    it("counts extendPeriod failure as an error, not a renewal", async () => {
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription()])
        .mockResolvedValueOnce([])
      mockPrisma.vpnSubscription.updateMany.mockRejectedValue(
        new Error("DB_CONNECTION_ERROR")
      )

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.renewed).toBe(0)
      expect(result.errors).toBe(1)
    })

    it("counts non-balance charge errors as errors", async () => {
      mockTransactions.debitServiceBalance.mockRejectedValue(
        new Error("BILLING_ACCOUNT_NOT_FOUND")
      )
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription()])
        .mockResolvedValueOnce([])

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.errors).toBe(1)
      expect(result.suspended).toBe(0)
    })

    it("renews multiple due subscriptions in one batch", async () => {
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([
          subscription({ id: "sub_1" }),
          subscription({ id: "sub_2" }),
          subscription({ id: "sub_3" }),
        ])
        .mockResolvedValueOnce([])
      mockPrisma.vpnSubscription.updateMany.mockResolvedValue({ count: 1 })

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.renewed).toBe(3)
      expect(mockTransactions.debitServiceBalance).toHaveBeenCalledTimes(3)
    })

    it("does not touch subscriptions when none are due", async () => {
      mockPrisma.vpnSubscription.findMany.mockResolvedValue([])

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.renewed).toBe(0)
      expect(mockTransactions.debitServiceBalance).not.toHaveBeenCalled()
    })
  })
})
