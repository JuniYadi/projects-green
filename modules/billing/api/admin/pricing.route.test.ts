import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

import { CurrencyNotFoundError } from "../../currency.service"
import { createAdminPricingRoutes } from "./pricing.route"

const getCurrencyByCode = mock(async () => ({ isActive: true }))

const guard = mock(async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))
const db = {
  servicePricing: {
    findMany: mock(),
    findUnique: mock(),
    findFirst: mock(),
    create: mock(),
    update: mock(),
  },
  servicePlan: { findUnique: mock() },
  serviceRegion: { findUnique: mock() },
  billingOrderLine: { findFirst: mock() },
  serviceSubscription: { count: mock() },
  $transaction: mock(async (fn: (tx: typeof db) => unknown) => fn(db)),
}

const pricing = {
  id: "price-1",
  planId: "plan-1",
  regionId: "region-1",
  type: "BUNDLE",
  billingMode: "PACKAGE",
  billingPeriod: "MONTHLY",
  currency: "IDR",
  periodPrice: new Prisma.Decimal("150000"),
  effectiveFrom: new Date("2026-01-01"),
  effectiveTo: null,
  chargeUnit: "SUBSCRIPTION",
  basePriceIdr: new Prisma.Decimal("150000"),
  monthlyCapIdr: null,
  unitRateCpu: null,
  unitRateMem: null,
  unitRateMessage: null,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  servicePlan: { id: "plan-1", code: "VPN_BASIC", package: { code: "VPN" } },
  region: { id: "region-1", code: "ID", name: "Indonesia" },
}

function app() {
  return new Elysia()
    .use(
      createAdminPricingRoutes({
        requireSuperAdmin: guard,
        prisma: db as never,
        currencyService: { getByCode: getCurrencyByCode } as never,
      })
    )
    .compile()
}

describe("admin pricing routes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    guard.mockResolvedValue({
      ok: true as const,
      userId: "admin-1",
      platformRole: "super_admin" as const,
    })
    getCurrencyByCode.mockResolvedValue({ isActive: true })
  })

  it("rejects negative prices and non-recurring periods", async () => {
    const response = await app().handle(
      new Request("http://localhost/admin/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: "plan-1",
          regionId: "region-1",
          billingPeriod: "YEARLY",
          chargeUnit: "SUBSCRIPTION",
          periodPrice: -1,
          currency: "IDR",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          isActive: true,
        }),
      })
    )
    expect(response.status).toBe(422)
    expect(db.servicePricing.create).not.toHaveBeenCalled()
  })

  it("lists complete-period prices with filters", async () => {
    db.servicePricing.findMany.mockResolvedValueOnce([pricing])
    const response = await app().handle(
      new Request(
        "http://localhost/admin/pricing?packageCode=VPN&billingPeriod=MONTHLY"
      )
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data[0].periodPrice).toBe("150000")
    expect(body.data[0].billingPeriod).toBe("MONTHLY")
    expect(db.servicePricing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ billingPeriod: "MONTHLY" }),
      })
    )
  })

  it("creates package pricing server-side and rejects duplicate active effective starts", async () => {
    db.servicePlan.findUnique.mockResolvedValueOnce({
      id: "plan-1",
      packageId: "pkg-1",
    })
    db.serviceRegion.findUnique.mockResolvedValueOnce({ id: "region-1" })
    db.servicePricing.findFirst.mockResolvedValueOnce(pricing)
    const response = await app().handle(
      new Request("http://localhost/admin/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: "plan-1",
          regionId: "region-1",
          billingPeriod: "MONTHLY",
          chargeUnit: "SUBSCRIPTION",
          periodPrice: "150000",
          currency: "IDR",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          isActive: true,
        }),
      })
    )
    expect(response.status).toBe(422)
    expect(db.servicePricing.create).not.toHaveBeenCalled()
  })

  it("maps an unknown POST currency to the validation error DTO", async () => {
    db.servicePlan.findUnique.mockResolvedValueOnce({ id: "plan-1" })
    db.serviceRegion.findUnique.mockResolvedValueOnce({ id: "region-1" })
    getCurrencyByCode.mockRejectedValueOnce(new CurrencyNotFoundError("XYZ"))

    const response = await app().handle(
      new Request("http://localhost/admin/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: "plan-1",
          regionId: "region-1",
          billingPeriod: "MONTHLY",
          chargeUnit: "SUBSCRIPTION",
          periodPrice: "150000",
          currency: "XYZ",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Currency is not configured.",
    })
    expect(db.servicePricing.create).not.toHaveBeenCalled()
  })

  it("maps an unknown PATCH currency to the validation error DTO", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    getCurrencyByCode.mockRejectedValueOnce(new CurrencyNotFoundError("XYZ"))

    const response = await app().handle(
      new Request("http://localhost/admin/pricing/price-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currency: "XYZ" }),
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Currency is not configured.",
    })
    expect(db.servicePricing.update).not.toHaveBeenCalled()
    expect(db.servicePricing.create).not.toHaveBeenCalled()
  })

  it("replaces a charged row instead of mutating its snapshot", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    db.billingOrderLine.findFirst.mockResolvedValueOnce({
      order: { status: "CHARGED" },
    })
    db.servicePricing.update.mockResolvedValueOnce({
      ...pricing,
      isActive: false,
    })
    db.servicePricing.create.mockResolvedValueOnce({
      ...pricing,
      id: "price-2",
      periodPrice: new Prisma.Decimal("175000"),
    })
    const response = await app().handle(
      new Request("http://localhost/admin/pricing/price-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ periodPrice: "175000" }),
      })
    )
    expect(response.status).toBe(200)
    expect(db.servicePricing.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
    expect(db.servicePricing.create).toHaveBeenCalled()
  })
})
