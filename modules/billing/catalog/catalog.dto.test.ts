import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"

import { toCatalogOfferDTO, toCatalogPlanDTO } from "./catalog.dto"

function pricing(
  billingPeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL",
  overrides: Record<string, unknown> = {}
) {
  return {
    id: `price-${billingPeriod}`,
    billingPeriod,
    periodPrice: new Prisma.Decimal("125000.50"),
    currency: "IDR",
    chargeUnit: "SUBSCRIPTION",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: new Date("2026-12-31T00:00:00.000Z"),
    ...overrides,
  } as unknown as Parameters<typeof toCatalogOfferDTO>[0]
}

describe("catalog DTO mappers", () => {
  it("maps every recurring period to its month count", () => {
    expect(toCatalogOfferDTO(pricing("MONTHLY")).periodMonths).toBe(1)
    expect(toCatalogOfferDTO(pricing("QUARTERLY")).periodMonths).toBe(3)
    expect(toCatalogOfferDTO(pricing("SEMI_ANNUAL")).periodMonths).toBe(6)
    expect(toCatalogOfferDTO(pricing("ANNUAL")).periodMonths).toBe(12)
  })

  it("serializes prices and nullable effective dates", () => {
    expect(
      toCatalogOfferDTO(
        pricing("MONTHLY", {
          periodPrice: null,
          effectiveTo: null,
          chargeUnit: "DEVICE",
        })
      )
    ).toEqual({
      id: "price-MONTHLY",
      billingPeriod: "MONTHLY",
      periodMonths: 1,
      periodPrice: "0",
      currency: "IDR",
      chargeUnit: "DEVICE",
      regionId: null,
      regionCode: null,
      regionName: null,
      regionFlag: null,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
    })
  })

  it("maps plans and nested pricing offers", () => {
    const plan = {
      id: "plan-standard",
      code: "STANDARD",
      name: "Standard",
      resources: { devices: 5 },
      billingStrategy: "PRO_RATA",
      stockControl: "TRACKED",
      stockCount: 10,
      allowBackorder: false,
      isActive: true,
      pricings: [pricing("MONTHLY"), pricing("ANNUAL")],
    } as unknown as Parameters<typeof toCatalogPlanDTO>[0]

    expect(toCatalogPlanDTO(plan)).toEqual({
      id: "plan-standard",
      code: "STANDARD",
      name: "Standard",
      resources: { devices: 5 },
      billingStrategy: "PRO_RATA",
      stockControl: "TRACKED",
      stockCount: 10,
      allowBackorder: false,
      isActive: true,
      offers: [
        expect.objectContaining({ billingPeriod: "MONTHLY", periodMonths: 1 }),
        expect.objectContaining({ billingPeriod: "ANNUAL", periodMonths: 12 }),
      ],
    })
  })
})
