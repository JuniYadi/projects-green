import { beforeEach, describe, expect, it, vi } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

const mockPrisma = {
  paymentCurrency: { findUnique: vi.fn() },
  servicePricing: { findMany: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

const { resolveRecurringPrice, RecurringPriceResolutionError } =
  await import("./pricing.service")

const at = new Date("2026-08-05T12:00:00.000Z")

function currency(overrides: Record<string, unknown> = {}) {
  return {
    id: "currency-idr",
    code: "IDR",
    name: "Indonesian Rupiah",
    symbol: "Rp",
    isBase: true,
    ratePerBase: new Prisma.Decimal(1),
    minTopup: new Prisma.Decimal(1),
    maxTopup: new Prisma.Decimal(100),
    minBalanceWarn: new Prisma.Decimal(1),
    isActive: true,
    sortOrder: 0,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  }
}

function recurringRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pricing-monthly",
    planId: "plan-vpn",
    regionId: "region-global",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    billingPeriod: "MONTHLY",
    currency: "IDR",
    periodPrice: new Prisma.Decimal("125000"),
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    chargeUnit: "SUBSCRIPTION",
    isActive: true,
    servicePlan: {
      code: "STANDARD",
      package: { code: "VPN" },
    },
    region: { code: "GLOBAL" },
    ...overrides,
  }
}

describe("resolveRecurringPrice", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma.paymentCurrency.findUnique.mockResolvedValue(currency())
    mockPrisma.servicePricing.findMany.mockResolvedValue([])
  })
  it.each([
    ["MONTHLY", 1],
    ["QUARTERLY", 3],
    ["SEMI_ANNUAL", 6],
    ["ANNUAL", 12],
  ] as const)("maps %s to %s months", async (billingPeriod, periodMonths) => {
    mockPrisma.servicePricing.findMany.mockResolvedValue([
      recurringRow({ billingPeriod }),
    ])

    const result = await resolveRecurringPrice({
      pricingId: "pricing-monthly",
      currency: "IDR",
      at,
    })

    expect(result.billingPeriod).toBe(billingPeriod)
    expect(result.periodMonths).toBe(periodMonths)
    expect(result.periodPrice).toEqual(new Prisma.Decimal("125000"))
  })

  it("returns PRICE_NOT_FOUND when no active effective row matches", async () => {
    mockPrisma.servicePricing.findMany.mockResolvedValue([])

    await expect(
      resolveRecurringPrice({ pricingId: "missing", currency: "IDR", at })
    ).rejects.toMatchObject({ code: "PRICE_NOT_FOUND" })
  })

  it("returns PRICE_CONFIGURATION_CONFLICT for ambiguous effective rows", async () => {
    mockPrisma.servicePricing.findMany.mockResolvedValue([
      recurringRow(),
      recurringRow({ id: "pricing-monthly-replacement" }),
    ])

    await expect(
      resolveRecurringPrice({
        pricingId: "pricing-monthly",
        currency: "IDR",
        at,
      })
    ).rejects.toMatchObject({ code: "PRICE_CONFIGURATION_CONFLICT" })
  })

  it("excludes a row at its exclusive effectiveTo boundary", async () => {
    mockPrisma.servicePricing.findMany.mockResolvedValue([])
    const effectiveTo = new Date("2026-08-05T12:00:00.000Z")

    await expect(
      resolveRecurringPrice({
        pricingId: "pricing-monthly",
        currency: "IDR",
        at: effectiveTo,
      })
    ).rejects.toMatchObject({ code: "PRICE_NOT_FOUND" })
    expect(mockPrisma.servicePricing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          effectiveFrom: { lte: effectiveTo },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveTo } }],
        }),
      })
    )
  })

  it("uses requested currency in the lookup and rejects a currency mismatch", async () => {
    mockPrisma.servicePricing.findMany.mockResolvedValue([])

    await expect(
      resolveRecurringPrice({
        pricingId: "pricing-monthly",
        currency: "USD",
        at,
      })
    ).rejects.toMatchObject({ code: "PRICE_NOT_FOUND" })

    expect(mockPrisma.paymentCurrency.findUnique).toHaveBeenCalledWith({
      where: { code: "USD" },
    })
    expect(mockPrisma.servicePricing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currency: "USD" }),
      })
    )
  })

  it("rejects legacy YEARLY and CUSTOM periods", async () => {
    mockPrisma.servicePricing.findMany.mockResolvedValue([
      recurringRow({ billingPeriod: "YEARLY" }),
    ])

    await expect(
      resolveRecurringPrice({
        pricingId: "pricing-monthly",
        currency: "IDR",
        at,
      })
    ).rejects.toBeInstanceOf(RecurringPriceResolutionError)
  })
})
