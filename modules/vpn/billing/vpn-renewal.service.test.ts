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
      updateMany: mock(),
    },
  },
}))

import { VpnRenewalService } from "./vpn-renewal.service"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as unknown as {
  subscription: {
    findMany: ReturnType<typeof mock>
    update: ReturnType<typeof mock>
    updateMany: ReturnType<typeof mock>
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
  mockPrisma.subscription.updateMany.mockReset()
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
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 })

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

      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "sub_vpn_1",
            currentPeriodEnd: { lte: expect.any(Date) },
          }),
          data: expect.objectContaining({
            status: "ACTIVE",
          }),
        }),
      )
    })

    it("suspends subscription when balance is insufficient (no grace period)", async () => {
      const dueSub = vpnSubscription()
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])
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

    it("does not double-extend on concurrent workers (updateMany WHERE guard)", async () => {
      const dueSub = vpnSubscription({
        currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
      })
      // Each worker run calls findMany twice: once to get the sub, once to break the loop.
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])

      // Worker A: updateMany matches 1 row (actual extension)
      // Worker B: updateMany matches 0 rows (already extended)
      mockPrisma.subscription.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })

      // Worker A runs
      const serviceA = createService()
      const resultA = await serviceA.renewDueSubscriptions()
      expect(resultA.renewed).toBe(1)

      // Worker B runs
      const serviceB = createService()
      const resultB = await serviceB.renewDueSubscriptions()
      expect(resultB.renewed).toBe(0) // updateMany returned 0 rows

      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(2)
    })

    it("does not double-charge already-renewed subscriptions (idempotency)", async () => {
      const dueSub = vpnSubscription({
        currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
      })
      // Each worker run calls findMany twice
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])

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
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 })

      // Run twice — second call should see alreadyProcessed and skip extending
      await createService().renewDueSubscriptions()
      await createService().renewDueSubscriptions()

      // chargeMonthly was called twice (both runs), but the second run's
      // alreadyProcessed=true means we skip the extension.
      // updateMany should have been called once (first run extended period).
      expect(mockVpnBillingService.chargeMonthly).toHaveBeenCalledTimes(2)
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(1)
    })

    it("does not count extendPeriod failure as renewed (Issue 2 guard)", async () => {
      const dueSub = vpnSubscription({
        currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
      })
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])
      // extendPeriod throws (transient DB error)
      mockPrisma.subscription.updateMany.mockRejectedValue(
        new Error("DB_CONNECTION_ERROR"),
      )

      const result = await createService().renewDueSubscriptions()

      expect(result.renewed).toBe(0) // charge was ok but extension failed
      expect(result.errors).toBe(1)  // counted as error
      expect(result.suspended).toBe(0)

      // chargeMonthly was attempted
      expect(mockVpnBillingService.chargeMonthly).toHaveBeenCalledTimes(1)
      // updateMany was attempted (and failed)
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(1)
    })

    it("does not touch subscriptions with future period end", async () => {
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
          take: expect.any(Number),
          orderBy: expect.any(Object),
        }),
      )
    })

    it("renews multiple due subscriptions in batch with pagination", async () => {
      const subs = [
        vpnSubscription({ id: "sub_1", organizationId: "org_1" }),
        vpnSubscription({ id: "sub_2", organizationId: "org_2" }),
        vpnSubscription({ id: "sub_3", organizationId: "org_1" }),
      ]
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce(subs)
        .mockResolvedValueOnce([])
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 })

      const result = await createService().renewDueSubscriptions()

      expect(result.renewed).toBe(3)
      expect(mockVpnBillingService.chargeMonthly).toHaveBeenCalledTimes(3)
    })

    it("uses idempotency key with current period (not previous)", async () => {
      const dueSub = vpnSubscription({
        currentPeriodEnd: new Date("2026-05-31T23:59:59Z"),
      })
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([dueSub])
        .mockResolvedValueOnce([])
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 })

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
