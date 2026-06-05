import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

// ─── Mocks ──────────────────────────────────────────────────────────────
//
// Leaf-dependency mocks only per AGENTS.md.

const mockVpnBillingService = {
  chargeMonthly: mock(),
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findMany: mock(),
      update: mock(),
    },
  },
}))

import { VpnRenewalService } from "./vpn-renewal.service"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as unknown as {
  subscription: {
    findMany: ReturnType<typeof mock>
    update: ReturnType<typeof mock>
  }
}

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

function vpnSubscription(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sub_vpn_1",
    organizationId: "org_1",
    packageId: "pkg_vpn",
    planId: "plan_standard",
    pricingId: "pricing_standard_idr",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    status: "ACTIVE",
    currentPeriodStart: new Date("2026-05-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
    plan: { code: "STANDARD" },
    metadata: {
      regionCode: "INDONESIA",
      planCode: "STANDARD",
    },
    ...overrides,
  }
}

const createService = () =>
  new VpnRenewalService(
    mockPrisma as never,
    mockVpnBillingService as never,
  )

beforeEach(() => {
  mockPrisma.subscription.findMany.mockReset()
  mockPrisma.subscription.update.mockReset()
  mockVpnBillingService.chargeMonthly.mockReset()
  mockVpnBillingService.chargeMonthly.mockResolvedValue({
    billingAccountId: "ba_1",
    adjustmentId: "adj_renew",
    balanceBefore: decimal("500.00"),
    balanceAfter: decimal("475.00"),
    amount: decimal("25.00"),
    currency: "IDR",
    alreadyProcessed: false,
  })
})

describe("VpnRenewalService", () => {
  describe("renewDueSubscriptions", () => {
    it("renews due subscriptions and extends period by one month", async () => {
      const dueSub = vpnSubscription({
        currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
      })
      mockPrisma.subscription.findMany.mockResolvedValue([dueSub])
      mockPrisma.subscription.update.mockImplementation(
        async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          ...args.data,
        }),
      )

      const result = await createService().renewDueSubscriptions()

      expect(result.renewed).toBe(1)
      expect(result.suspended).toBe(0)
      expect(result.errors).toBe(0)

      expect(mockVpnBillingService.chargeMonthly).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          vpnSubscriptionId: "sub_vpn_1",
          regionCode: "INDONESIA",
          amount: decimal("25000"),
          period: "2026-06",
        }),
      )

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub_vpn_1" },
          data: expect.objectContaining({
            status: "ACTIVE",
          }),
        }),
      )
    })

    it("suspends subscription when balance is insufficient (no grace period)", async () => {
      const dueSub = vpnSubscription()
      mockPrisma.subscription.findMany.mockResolvedValue([dueSub])
      mockVpnBillingService.chargeMonthly.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE"),
      )
      mockPrisma.subscription.update.mockImplementation(
        async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          ...args.data,
        }),
      )

      const result = await createService().renewDueSubscriptions()

      expect(result.renewed).toBe(0)
      expect(result.suspended).toBe(1)
      expect(result.errors).toBe(0)

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub_vpn_1" },
          data: expect.objectContaining({ status: "SUSPENDED" }),
        }),
      )
    })

    it("does not double-charge already-renewed subscriptions (idempotency)", async () => {
      const dueSub = vpnSubscription({
        currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
      })
      mockPrisma.subscription.findMany.mockResolvedValue([dueSub])
      // First call: succeeds
      mockVpnBillingService.chargeMonthly
        .mockResolvedValueOnce({
          billingAccountId: "ba_1",
          adjustmentId: "adj_renew_1",
          balanceBefore: decimal("500.00"),
          balanceAfter: decimal("475.00"),
          amount: decimal("25.00"),
          currency: "IDR",
          alreadyProcessed: false,
        })
        // Second call (duplicate retry): alreadyProcessed
        .mockResolvedValueOnce({
          billingAccountId: "ba_1",
          adjustmentId: "adj_renew_1",
          balanceBefore: decimal("475.00"),
          balanceAfter: decimal("475.00"),
          amount: decimal("25.00"),
          currency: "IDR",
          alreadyProcessed: true,
        })
      mockPrisma.subscription.update.mockImplementation(
        async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          ...args.data,
        }),
      )

      // Run twice — second call should see alreadyProcessed and skip extending
      await createService().renewDueSubscriptions()
      await createService().renewDueSubscriptions()

      // chargeMonthly was called twice (both runs), but the second run's
      // alreadyProcessed=true means we should count only unique renewals.
      // update should have been called once (first run extended period).
      expect(mockVpnBillingService.chargeMonthly).toHaveBeenCalledTimes(2)
      expect(mockPrisma.subscription.update).toHaveBeenCalledTimes(1)
    })

    it("does not touch subscriptions with future period end", async () => {
      // The findMany WHERE clause (currentPeriodEnd <= now) would filter
      // out future subs at the DB layer. The service cannot find or charge
      // them because they never enter the renewal loop. We assert that
      // the query only targets due subscriptions.
      mockPrisma.subscription.findMany.mockResolvedValue([])

      const result = await createService().renewDueSubscriptions()

      expect(result.renewed).toBe(0)
      expect(result.suspended).toBe(0)
      expect(result.errors).toBe(0)
      expect(mockVpnBillingService.chargeMonthly).not.toHaveBeenCalled()

      // Confirm the query includes the due-only filter
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currentPeriodEnd: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      )
    })

    it("renews multiple due subscriptions in batch", async () => {
      const subs = [
        vpnSubscription({ id: "sub_1", organizationId: "org_1" }),
        vpnSubscription({ id: "sub_2", organizationId: "org_2" }),
        vpnSubscription({ id: "sub_3", organizationId: "org_1" }),
      ]
      mockPrisma.subscription.findMany.mockResolvedValue(subs)
      mockPrisma.subscription.update.mockImplementation(
        async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          ...args.data,
        }),
      )

      const result = await createService().renewDueSubscriptions()

      expect(result.renewed).toBe(3)
      expect(mockVpnBillingService.chargeMonthly).toHaveBeenCalledTimes(3)
    })

    it("uses idempotency key with current period (not previous)", async () => {
      const dueSub = vpnSubscription({
        // Past period
        currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
      })
      mockPrisma.subscription.findMany.mockResolvedValue([dueSub])
      mockPrisma.subscription.update.mockImplementation(
        async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          ...args.data,
        }),
      )

      await createService().renewDueSubscriptions()

      // Period should be current month (2026-06), not the expired one
      expect(mockVpnBillingService.chargeMonthly).toHaveBeenCalledWith(
        expect.objectContaining({
          period: "2026-06",
        }),
      )
    })
  })
})
