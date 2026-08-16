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
  vpnMobileDevice: {
    updateMany: mock(),
    deleteMany: mock(),
  },
  vpnPairingToken: {
    deleteMany: mock(),
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
  new VpnRenewalService(mockPrisma as never, mockTransactions as never)

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
  mockPrisma.vpnMobileDevice.updateMany.mockClear()
  mockPrisma.vpnMobileDevice.deleteMany.mockClear()
  mockPrisma.vpnPairingToken.deleteMany.mockClear()
  mockPrisma.vpnMobileDevice.updateMany.mockResolvedValue({ count: 0 })
  mockPrisma.vpnMobileDevice.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.vpnPairingToken.deleteMany.mockResolvedValue({ count: 0 })
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

      // Verify calendar-month alignment: extendPeriod should extend to
      // end of July 2026 (month+2=8, day 0 = July 31)
      const expectedPeriodEnd = new Date(Date.UTC(2026, 7, 0, 23, 59, 59, 999))
      expect(mockPrisma.vpnSubscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "sub_vpn_1",
            currentPeriodEnd: { lte: NOW },
          }),
          data: expect.objectContaining({
            status: "ACTIVE",
            currentPeriodEnd: expectedPeriodEnd,
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

  // The 3/7-days-after-failure ladder is retired. Suspend and terminate are
  // RenewalCoordinatorService's job, covered by
  // modules/billing/renewal/renewal-coordinator.service.test.ts and
  // modules/vpn/billing/vpn-renewal-callbacks.test.ts.
  describe("renewal failure on INSUFFICIENT_BALANCE", () => {
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
      expect(mockPrisma.vpnSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub_vpn_1" },
          data: { renewalFailedAt: NOW },
        })
      )
    })

    it("never transitions status itself, however long the failure lasts", async () => {
      const failedAt = new Date("2026-06-08T00:00:00Z") // 7 days before NOW
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription({ renewalFailedAt: failedAt })])
        .mockResolvedValueOnce([])

      await createService().renewDueSubscriptions(NOW)

      expect(mockPrisma.vpnSubscription.update).toHaveBeenCalledWith({
        where: { id: "sub_vpn_1" },
        data: { renewalFailedAt: failedAt },
      })
      expect(mockPrisma.vpnSubscription.update).toHaveBeenCalledTimes(1)
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

  describe("lifecycle & cleanup hooks", () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000)

    // T7.1 (device suspend) and T7.2 (device revoke) moved to the renewal
    // coordinator callbacks — see vpn-renewal-callbacks.test.ts.

    it("T7.3: reactivates SUSPENDED mobile devices on successful renewal", async () => {
      mockPrisma.vpnSubscription.findMany
        .mockResolvedValueOnce([subscription()])
        .mockResolvedValueOnce([])
      mockPrisma.vpnSubscription.updateMany.mockResolvedValue({ count: 1 })

      const result = await createService().renewDueSubscriptions(NOW)

      expect(result.renewed).toBe(1)
      expect(mockPrisma.vpnMobileDevice.updateMany).toHaveBeenCalledWith({
        where: { subscriptionId: "sub_vpn_1", status: "SUSPENDED" },
        data: { status: "ACTIVE", revokedReason: null },
      })
    })

    it("T7.4: deletes expired pairing tokens older than 7 days", async () => {
      mockPrisma.vpnSubscription.findMany.mockResolvedValue([])

      await createService().renewDueSubscriptions(NOW)

      expect(mockPrisma.vpnPairingToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: sevenDaysAgo } },
      })
    })

    it("T7.5: deletes REVOKED mobile devices older than 30 days", async () => {
      mockPrisma.vpnSubscription.findMany.mockResolvedValue([])

      await createService().renewDueSubscriptions(NOW)

      expect(mockPrisma.vpnMobileDevice.deleteMany).toHaveBeenCalledWith({
        where: { status: "REVOKED", revokedAt: { lt: thirtyDaysAgo } },
      })
    })
  })
})
