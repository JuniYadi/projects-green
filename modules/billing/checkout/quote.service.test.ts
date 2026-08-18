import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import type { ResolvedRecurringPrice } from "../pricing/pricing.types"

const mockPrisma = {
  servicePlanAddon: { findMany: mock() },
  servicePlan: { findUnique: mock() },
  voucher: { findUnique: mock() },
  billingOrder: { count: mock() },
  billingAccount: { findUnique: mock() },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { CheckoutQuoteService } = await import("./quote.service")

const resolvedPrice: ResolvedRecurringPrice = {
  pricingId: "pricing-1",
  packageCode: "VPN",
  planId: "plan-1",
  planCode: "PRO",
  regionCode: "GLOBAL",
  billingPeriod: "MONTHLY",
  periodMonths: 1,
  chargeUnit: "SUBSCRIPTION",
  periodPrice: new Prisma.Decimal("100000"),
  currency: "IDR",
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: null,
}

function buildService() {
  return new CheckoutQuoteService(mockPrisma as never, {
    resolvePrice: mock(async () => resolvedPrice),
    convertCurrency: mock(async (amount: Prisma.Decimal) => amount.mul(17000)),
    now: () => new Date("2026-08-06T10:00:00.000Z"),
  })
}

beforeEach(() => {
  mockPrisma.servicePlanAddon.findMany.mockReset()
  mockPrisma.servicePlan.findUnique.mockReset()
  mockPrisma.voucher.findUnique.mockReset()
  mockPrisma.billingOrder.count.mockReset()
  mockPrisma.billingAccount.findUnique.mockReset()
  mockPrisma.billingAccount.findUnique.mockResolvedValue({ currency: "IDR" })
  mockPrisma.servicePlan.findUnique.mockResolvedValue({
    stockControl: "UNLIMITED",
    stockCount: null,
    allowBackorder: false,
    billingStrategy: "FIXED_CYCLE",
  })
})
describe("CheckoutQuoteService", () => {
  it("quotes selected addons and a percentage promotion", async () => {
    mockPrisma.servicePlanAddon.findMany.mockResolvedValueOnce([
      {
        id: "attachment-1",
        addonId: "addon-1",
        isRequired: false,
        label: "Redis",
        description: "Fast cache",
        addon: {
          id: "addon-1",
          code: "REDIS",
          name: "Redis",
          description: "Fast cache",
          prices: [
            { id: "addon-price-1", amount: new Prisma.Decimal("20000") },
          ],
        },
      },
    ])
    mockPrisma.voucher.findUnique.mockResolvedValueOnce({
      id: "voucher-1",
      code: "SAVE10",
      status: "ACTIVE",
      kind: "PRODUCT_PROMOTION",
      discountType: "PERCENTAGE",
      discountValue: new Prisma.Decimal("10"),
      currency: "IDR",
      currencyPolicy: "MATCH_CURRENCY_ONLY",
      firstCheckoutOnly: false,
      allowUpgrade: false,
      stackable: false,
      minimumOrderAmount: null,
      maximumDiscountAmount: null,
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      targetWorkosUserId: null,
      targetOrganizationId: null,
      allowedPackageCodes: ["VPN"],
      allowedPlanCodes: ["PRO"],
      allowedBillingPeriods: ["MONTHLY"],
    })
    mockPrisma.billingOrder.count.mockResolvedValueOnce(0)

    const quote = await buildService().createQuote({
      organizationId: "org-1",
      pricingId: "pricing-1",
      addonIds: ["addon-1"],
      voucherCode: "save10",
      idempotencyKey: "quote-1",
    })

    expect(quote.subtotal).toBe("120000")
    expect(quote.discount).toBe("12000")
    expect(quote.firstPayment).toBe("108000")
    expect(quote.addons).toHaveLength(1)
    expect(quote.voucher?.code).toBe("SAVE10")
    expect(quote.expiresAt).toBe("2026-08-06T10:15:00.000Z")
  })

  it("generates distinct quote IDs for the same clock time", async () => {
    mockPrisma.servicePlanAddon.findMany.mockResolvedValue([])
    const service = buildService()
    const input = {
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "same-key",
    }

    const [first, second] = await Promise.all([
      service.createQuote(input),
      service.createQuote(input),
    ])

    expect(first.quoteId).not.toBe(second.quoteId)
    expect(first.quoteToken).not.toBe(second.quoteToken)
  })

  it("records the forward exchange rate for a fixed converted promotion", async () => {
    mockPrisma.servicePlanAddon.findMany.mockResolvedValueOnce([])
    mockPrisma.voucher.findUnique.mockResolvedValueOnce({
      id: "voucher-3",
      code: "USD20",
      status: "ACTIVE",
      kind: "PRODUCT_PROMOTION",
      discountType: "FIXED",
      discountValue: new Prisma.Decimal("20"),
      discountCurrency: "USD",
      currency: "USD",
      currencyPolicy: "CONVERT_AT_CHECKOUT",
      firstCheckoutOnly: false,
      allowUpgrade: false,
      stackable: false,
      minimumOrderAmount: null,
      maximumDiscountAmount: null,
      expiresAt: new Date("2026-08-31T00:00:00.000Z"),
      targetWorkosUserId: null,
      targetOrganizationId: null,
      allowedPackageCodes: null,
      allowedPlanCodes: null,
      allowedBillingPeriods: null,
    })

    const quote = await buildService().createQuote({
      organizationId: "org-1",
      pricingId: "pricing-1",
      voucherCode: "USD20",
      idempotencyKey: "quote-3",
    })

    expect(quote.voucher).toMatchObject({
      discountAmount: "100000",
      exchangeRate: "17000",
      rateAt: "2026-08-06T10:00:00.000Z",
    })
  })

  it("uses the supplied quote clock for quote timestamps", async () => {
    mockPrisma.servicePlanAddon.findMany.mockResolvedValueOnce([])
    const now = new Date("2026-09-10T12:34:56.000Z")

    const quote = await buildService().createQuote({
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "quote-4",
      now,
    })

    expect(quote.periodStart).toBe("2026-09-10T12:34:56.000Z")
    expect(quote.expiresAt).toBe("2026-09-10T12:49:56.000Z")
    expect(quote.periodEnd).toBe("2026-10-10T12:34:56.000Z")
  })

  it("rejects an exact-currency fixed promotion mismatch", async () => {
    mockPrisma.servicePlanAddon.findMany.mockResolvedValueOnce([])
    mockPrisma.voucher.findUnique.mockResolvedValueOnce({
      id: "voucher-2",
      code: "USD20",
      status: "ACTIVE",
      kind: "PRODUCT_PROMOTION",
      discountType: "FIXED",
      discountValue: new Prisma.Decimal("20"),
      discountCurrency: "USD",
      currency: "USD",
      currencyPolicy: "MATCH_CURRENCY_ONLY",
      firstCheckoutOnly: false,
      allowUpgrade: false,
      stackable: false,
      minimumOrderAmount: null,
      maximumDiscountAmount: null,
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      targetWorkosUserId: null,
      targetOrganizationId: null,
      allowedPackageCodes: null,
      allowedPlanCodes: null,
      allowedBillingPeriods: null,
    })

    await expect(
      buildService().createQuote({
        organizationId: "org-1",
        pricingId: "pricing-1",
        voucherCode: "USD20",
        idempotencyKey: "quote-2",
      })
    ).rejects.toMatchObject({ code: "BILLING_CURRENCY_MISMATCH" })
  })

  it("throws OUT_OF_STOCK error when product is tracked and out of stock without backorder", async () => {
    mockPrisma.servicePlan.findUnique.mockResolvedValueOnce({
      stockControl: "TRACKED",
      stockCount: 0,
      allowBackorder: false,
      billingStrategy: "FIXED_CYCLE",
    })

    const service = buildService()
    await expect(
      service.createQuote({
        organizationId: "org-1",
        pricingId: "pricing-1",
        idempotencyKey: "idem-stock-1",
      })
    ).rejects.toThrow("out of stock")
  })

  it("calculates prorated day-rate when billingStrategy is PRO_RATA on monthly term", async () => {
    mockPrisma.servicePlanAddon.findMany.mockResolvedValueOnce([])
    mockPrisma.servicePlan.findUnique.mockResolvedValueOnce({
      stockControl: "UNLIMITED",
      stockCount: null,
      allowBackorder: false,
      billingStrategy: "PRO_RATA",
    })

    const service = buildService()
    const quote = await service.createQuote({
      organizationId: "org-1",
      pricingId: "pricing-1",
      idempotencyKey: "idem-prorata-1",
    })

    expect(quote.isProrated).toBe(true)
    expect(quote.proratedDays).toBe(26) // Aug 6 to Aug 31 = 26 days
    expect(quote.totalDaysInPeriod).toBe(31)
    expect(Number(quote.subtotal)).toBeLessThan(100000)
    expect(quote.periodEnd).toContain("2026-08-31")
  })
})
