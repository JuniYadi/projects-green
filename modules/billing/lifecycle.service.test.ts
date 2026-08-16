import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Prisma, type PrismaClient } from "@prisma/client"

const mockSubscriptionFindFirst = mock()
const mockSubscriptionUpdate = mock()
const mockPricingFindUnique = mock()
const mockBillingAccountFindUnique = mock()
const mockResolveRecurringPrice = mock()
const mockEmitBillingAudit = mock()

const mockPrismaClient = {
  serviceSubscription: {
    findFirst: mockSubscriptionFindFirst,
    update: mockSubscriptionUpdate,
  },
  servicePricing: { findUnique: mockPricingFindUnique },
  billingAccount: { findUnique: mockBillingAccountFindUnique },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrismaClient }))
mock.module("@/modules/billing/pricing/pricing.service", () => ({
  resolveRecurringPrice: mockResolveRecurringPrice,
}))
mock.module("./audit/audit.service", () => ({
  emitBillingAudit: mockEmitBillingAudit,
}))

import { SubscriptionLifecycleService } from "./lifecycle.service"

/**
 * Shaped to satisfy `subscriptionInclude` + `toSnapshot`, which read
 * `pricing.region.code`, `pricing.basePriceIdr`, `package.code`, and
 * `allocatedConfig`. A thinner fixture makes `toSnapshot` throw before any
 * assertion runs.
 */
const subscriptionShape = {
  id: "sub-1",
  organizationId: "org-1",
  pricingId: "pricing-old",
  planId: "plan-old",
  priceLocked: new Prisma.Decimal("100000.00"),
  currency: "IDR",
  billingPeriod: "MONTHLY",
  quantity: new Prisma.Decimal("1"),
  currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
  status: "ACTIVE",
  cancelAtPeriodEnd: false,
  commitmentEndsAt: null,
  allocatedConfig: null,
  metadata: null,
  plan: { code: "PLAN_NEW" },
  package: { code: "VPN" },
  pricing: {
    billingMode: "PACKAGE",
    type: "BUNDLE",
    basePriceIdr: new Prisma.Decimal("100000.00"),
    periodPrice: new Prisma.Decimal("100000.00"),
    currency: "IDR",
    billingPeriod: "MONTHLY",
    region: { code: "ID" },
    servicePlan: { code: "PLAN_NEW", packageId: "package-vpn" },
  },
}

describe("SubscriptionLifecycleService.changePlan", () => {
  let service: SubscriptionLifecycleService

  beforeEach(() => {
    mock.clearAllMocks()

    mockSubscriptionFindFirst.mockResolvedValue(subscriptionShape)
    mockPricingFindUnique.mockResolvedValue({
      id: "pricing-new",
      planId: "plan-new",
      servicePlan: { code: "PLAN_NEW" },
      region: { code: "ID" },
    })
    mockBillingAccountFindUnique.mockResolvedValue({ currency: "IDR" })
    mockResolveRecurringPrice.mockResolvedValue({
      pricingId: "pricing-new",
      packageCode: "VPN",
      planId: "plan-new",
      planCode: "PLAN_NEW",
      regionCode: "ID",
      billingPeriod: "MONTHLY",
      periodMonths: 1,
      chargeUnit: "SUBSCRIPTION",
      periodPrice: new Prisma.Decimal("250000.00"),
      currency: "IDR",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: null,
    })
    mockSubscriptionUpdate.mockResolvedValue({
      ...subscriptionShape,
      pricingId: "pricing-new",
      planId: "plan-new",
      priceLocked: new Prisma.Decimal("250000.00"),
    })

    service = new SubscriptionLifecycleService(
      mockPrismaClient as unknown as PrismaClient
    )
  })

  it("relocks priceLocked to the new pricing so renewal bills the new price", async () => {
    await service.changePlan("org-1", "sub-1", "pricing-new")

    const updateArg = mockSubscriptionUpdate.mock.calls[0][0]
    expect(updateArg.data.priceLocked.toString()).toBe("250000")
    expect(updateArg.data.pricingId).toBe("pricing-new")
    expect(updateArg.data.planId).toBe("plan-new")
  })

  it("relocks currency and billing period from the resolved price", async () => {
    mockResolveRecurringPrice.mockResolvedValue({
      pricingId: "pricing-new",
      packageCode: "VPN",
      planId: "plan-new",
      planCode: "PLAN_NEW",
      regionCode: "ID",
      billingPeriod: "ANNUAL",
      periodMonths: 12,
      chargeUnit: "SUBSCRIPTION",
      periodPrice: new Prisma.Decimal("2500000.00"),
      currency: "IDR",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: null,
    })

    await service.changePlan("org-1", "sub-1", "pricing-new")

    const updateArg = mockSubscriptionUpdate.mock.calls[0][0]
    expect(updateArg.data.billingPeriod).toBe("ANNUAL")
    expect(updateArg.data.currency).toBe("IDR")
  })

  it("audits the previous and new locked price", async () => {
    await service.changePlan("org-1", "sub-1", "pricing-new", "actor-1")

    const auditArg = mockEmitBillingAudit.mock.calls[0][0]
    expect(auditArg.context.previousPriceLocked).toBe("100000.00")
    expect(auditArg.context.newPriceLocked).toBe("250000.00")
    expect(auditArg.context.currency).toBe("IDR")
  })
})

describe("SubscriptionLifecycleService.cancelAtPeriodEnd commitment gate", () => {
  let service: SubscriptionLifecycleService

  beforeEach(() => {
    mock.clearAllMocks()
    mockSubscriptionUpdate.mockResolvedValue(subscriptionShape)
    service = new SubscriptionLifecycleService(
      mockPrismaClient as unknown as PrismaClient
    )
  })

  it("rejects cancellation before the commitment ends", async () => {
    mockSubscriptionFindFirst.mockResolvedValue({
      ...subscriptionShape,
      commitmentEndsAt: new Date("2099-01-01T00:00:00.000Z"),
    })

    await expect(service.cancelAtPeriodEnd("org-1", "sub-1")).rejects.toThrow(
      "SUBSCRIPTION_COMMITMENT_ACTIVE"
    )
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it("allows cancellation once the commitment has passed", async () => {
    mockSubscriptionFindFirst.mockResolvedValue({
      ...subscriptionShape,
      commitmentEndsAt: new Date("2020-01-01T00:00:00.000Z"),
    })

    const result = await service.cancelAtPeriodEnd("org-1", "sub-1")

    expect(result.ok).toBe(true)
    expect(mockSubscriptionUpdate).toHaveBeenCalled()
  })

  it("allows cancellation when there is no commitment", async () => {
    mockSubscriptionFindFirst.mockResolvedValue({
      ...subscriptionShape,
      commitmentEndsAt: null,
    })

    const result = await service.cancelAtPeriodEnd("org-1", "sub-1")

    expect(result.ok).toBe(true)
  })
})
