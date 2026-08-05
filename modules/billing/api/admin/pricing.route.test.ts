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
    count: mock(),
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
function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
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
  it("rejects invalid list filters before querying", async () => {
    const response = await app().handle(
      new Request("http://localhost/admin/pricing?billingPeriod=WEEKLY")
    )
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe("VALIDATION_ERROR")
    expect(db.servicePricing.findMany).not.toHaveBeenCalled()
  })

  it("lists inactive prices and applies all optional filters", async () => {
    db.servicePricing.findMany.mockResolvedValueOnce([])
    const response = await app().handle(
      new Request(
        "http://localhost/admin/pricing?planCode=VPN_BASIC&regionCode=ID&currency=usd&includeInactive=true"
      )
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual([])
    expect(db.servicePricing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "BUNDLE",
          billingMode: "PACKAGE",
          currency: "USD",
          servicePlan: {
            code: "VPN_BASIC",
          },
          region: { code: "ID" },
        }),
      })
    )
    expect(
      db.servicePricing.findMany.mock.calls[0]?.[0].where
    ).not.toHaveProperty("isActive")
  })

  it("returns a server error when listing fails", async () => {
    db.servicePricing.findMany.mockRejectedValueOnce(new Error("database down"))
    const response = await app().handle(
      new Request("http://localhost/admin/pricing")
    )
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe("INTERNAL_SERVER_ERROR")
  })

  it("rejects a create when its plan or region is missing", async () => {
    db.servicePlan.findUnique.mockResolvedValueOnce(null)
    db.serviceRegion.findUnique.mockResolvedValueOnce({ id: "region-1" })
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing", "POST", {
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: "150000",
        currency: "IDR",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      })
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Plan or region not found.",
    })
    expect(db.servicePricing.findFirst).not.toHaveBeenCalled()
  })

  it("rejects a create with an inactive currency", async () => {
    db.servicePlan.findUnique.mockResolvedValueOnce({ id: "plan-1" })
    db.serviceRegion.findUnique.mockResolvedValueOnce({ id: "region-1" })
    getCurrencyByCode.mockResolvedValueOnce({ isActive: false })
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing", "POST", {
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: "150000",
        currency: "IDR",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      })
    )
    expect(response.status).toBe(422)
    expect((await response.json()).message).toBe("Currency is inactive.")
    expect(db.servicePricing.findFirst).not.toHaveBeenCalled()
  })

  it("creates a package price and serializes decimal fields", async () => {
    db.servicePlan.findUnique.mockResolvedValueOnce({ id: "plan-1" })
    db.serviceRegion.findUnique.mockResolvedValueOnce({ id: "region-1" })
    db.servicePricing.findFirst.mockResolvedValueOnce(null)
    db.servicePricing.create.mockResolvedValueOnce(pricing)
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing", "POST", {
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: "150000",
        currency: "idr",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        isActive: true,
      })
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data.periodPrice).toBe("150000")
    expect(db.servicePricing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "BUNDLE",
          billingMode: "PACKAGE",
          currency: "IDR",
          periodPrice: expect.any(Prisma.Decimal),
          basePriceIdr: expect.any(Prisma.Decimal),
        }),
      })
    )
  })

  it("maps a Prisma create conflict to the conflict DTO", async () => {
    db.servicePlan.findUnique.mockResolvedValueOnce({ id: "plan-1" })
    db.serviceRegion.findUnique.mockResolvedValueOnce({ id: "region-1" })
    db.servicePricing.findFirst.mockResolvedValueOnce(null)
    db.servicePricing.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "5.22.0",
      })
    )
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing", "POST", {
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: "150000",
        currency: "IDR",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      })
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      ok: false,
      error: "CONFLICT",
      message: "A price with this effective identity already exists.",
    })
  })

  it("returns a server error when creating a price fails unexpectedly", async () => {
    db.servicePlan.findUnique.mockRejectedValueOnce(new Error("database down"))
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing", "POST", {
        planId: "plan-1",
        regionId: "region-1",
        billingPeriod: "MONTHLY",
        chargeUnit: "SUBSCRIPTION",
        periodPrice: "150000",
        currency: "IDR",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      })
    )
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe("INTERNAL_SERVER_ERROR")
  })

  it("rejects patch dates that are not in chronological order", async () => {
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/price-1", "PATCH", {
        effectiveFrom: "2026-02-01T00:00:00.000Z",
        effectiveTo: "2026-01-01T00:00:00.000Z",
      })
    )
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe("VALIDATION_ERROR")
    expect(db.servicePricing.findUnique).not.toHaveBeenCalled()
  })

  it("returns not found when patching a missing price", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(null)
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/missing", "PATCH", {
        periodPrice: "175000",
      })
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: "Pricing not found.",
    })
  })

  it("rejects a patch that changes to an inactive currency", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    getCurrencyByCode.mockResolvedValueOnce({ isActive: false })
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/price-1", "PATCH", {
        currency: "IDR",
      })
    )
    expect(response.status).toBe(422)
    expect((await response.json()).message).toBe("Currency is inactive.")
    expect(db.billingOrderLine.findFirst).not.toHaveBeenCalled()
    expect(db.servicePricing.update).not.toHaveBeenCalled()
  })

  it("rejects a patch when the merged period is not recurring", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce({
      ...pricing,
      billingPeriod: "ONE_TIME",
    })
    db.billingOrderLine.findFirst.mockResolvedValueOnce(null)
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/price-1", "PATCH", {})
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Only recurring pricing can be managed here.",
    })
    expect(db.servicePricing.update).not.toHaveBeenCalled()
  })

  it("rejects a patch whose merged effective dates are invalid", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce({
      ...pricing,
      effectiveTo: new Date("2026-02-01"),
    })
    db.billingOrderLine.findFirst.mockResolvedValueOnce(null)
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/price-1", "PATCH", {
        effectiveFrom: "2026-03-01T00:00:00.000Z",
      })
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "effectiveTo must be later than effectiveFrom.",
    })
    expect(db.servicePricing.update).not.toHaveBeenCalled()
  })

  it("updates an uncharged price in place", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    db.billingOrderLine.findFirst.mockResolvedValueOnce(null)
    db.servicePricing.update.mockResolvedValueOnce({
      ...pricing,
      periodPrice: new Prisma.Decimal("175000"),
      basePriceIdr: new Prisma.Decimal("175000"),
    })
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/price-1", "PATCH", {
        periodPrice: "175000",
      })
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data.periodPrice).toBe("175000")
    expect(db.servicePricing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodPrice: expect.any(Prisma.Decimal),
          basePriceIdr: expect.any(Prisma.Decimal),
          billingMode: "PACKAGE",
          type: "BUNDLE",
        }),
      })
    )
  })

  it("maps a Prisma patch conflict to the conflict DTO", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    db.billingOrderLine.findFirst.mockResolvedValueOnce(null)
    db.servicePricing.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "5.22.0",
      })
    )
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/price-1", "PATCH", {
        periodPrice: "175000",
      })
    )
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe("CONFLICT")
  })

  it("returns a server error when patching a price fails unexpectedly", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    db.billingOrderLine.findFirst.mockResolvedValueOnce(null)
    db.servicePricing.update.mockRejectedValueOnce(new Error("database down"))
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/price-1", "PATCH", {
        periodPrice: "175000",
      })
    )
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe("INTERNAL_SERVER_ERROR")
  })

  it("returns not found when deleting a missing price", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(null)
    const response = await app().handle(
      jsonRequest("http://localhost/admin/pricing/missing", "DELETE", {})
    )
    expect(response.status).toBe(404)
    expect((await response.json()).error).toBe("NOT_FOUND")
  })

  it("protects the last offer for an active subscription", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    db.servicePricing.count.mockResolvedValueOnce(1)
    db.serviceSubscription.count.mockResolvedValueOnce(1)
    const response = await app().handle(
      new Request("http://localhost/admin/pricing/price-1", {
        method: "DELETE",
      })
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      ok: false,
      error: "CONFLICT",
      message:
        "The last active offer for an active subscription cannot be removed.",
    })
    expect(db.servicePricing.update).not.toHaveBeenCalled()
  })

  it("deactivates an active price when another offer remains", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce(pricing)
    db.servicePricing.count.mockResolvedValueOnce(2)
    db.serviceSubscription.count.mockResolvedValueOnce(1)
    db.servicePricing.update.mockResolvedValueOnce({
      ...pricing,
      isActive: false,
    })
    const response = await app().handle(
      new Request("http://localhost/admin/pricing/price-1", {
        method: "DELETE",
      })
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data.isActive).toBe(false)
    expect(db.servicePricing.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
  })

  it("deactivates an already inactive price without counting offers", async () => {
    db.servicePricing.findUnique.mockResolvedValueOnce({
      ...pricing,
      isActive: false,
    })
    db.servicePricing.update.mockResolvedValueOnce({
      ...pricing,
      isActive: false,
    })
    const response = await app().handle(
      new Request("http://localhost/admin/pricing/price-1", {
        method: "DELETE",
      })
    )
    expect(response.status).toBe(200)
    expect(db.servicePricing.count).not.toHaveBeenCalled()
    expect(db.serviceSubscription.count).not.toHaveBeenCalled()
  })

  it("returns a server error when deleting a price fails unexpectedly", async () => {
    db.servicePricing.findUnique.mockRejectedValueOnce(
      new Error("database down")
    )
    const response = await app().handle(
      new Request("http://localhost/admin/pricing/price-1", {
        method: "DELETE",
      })
    )
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe("INTERNAL_SERVER_ERROR")
  })
})
