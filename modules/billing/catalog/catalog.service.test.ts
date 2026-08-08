import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const mockFindMany = mock()
const mockFindFirst = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    servicePackage: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
  },
}))

import { CatalogService } from "./catalog.service"

function pricing(id: string, billingPeriod = "MONTHLY") {
  return {
    id,
    billingPeriod,
    periodPrice: new Prisma.Decimal("100000"),
    currency: "IDR",
    chargeUnit: "SUBSCRIPTION",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
  }
}

function plan(
  id: string,
  pricings: Array<Record<string, unknown>> = [pricing("price-1")]
) {
  return {
    id,
    code: "STANDARD",
    name: "Standard",
    resources: { devices: 5 },
    pricings,
  }
}

function product(plans: Array<Record<string, unknown>>) {
  return {
    code: "VPN",
    name: "VPN",
    description: "Secure access",
    plans,
  }
}

describe("CatalogService", () => {
  it("returns only active plans with active currency offers", async () => {
    mockFindMany.mockResolvedValueOnce([
      product([plan("plan-empty", []), plan("plan-standard")]),
      product([plan("plan-without-offers", [])]),
    ])

    const result = await new CatalogService().getCatalog("IDR")

    expect(result.currency).toBe("IDR")
    expect(result.products).toHaveLength(1)
    expect(result.products[0]?.plans).toHaveLength(1)
    expect(result.products[0]?.plans[0]?.offers[0]?.periodPrice).toBe("100000")
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, state: "PUBLISHED" },
        include: expect.objectContaining({
          plans: expect.objectContaining({ where: { isActive: true } }),
        }),
      })
    )
  })

  it("returns null when a requested product is missing or has no offers", async () => {
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(product([plan("plan-empty", [])]))

    const service = new CatalogService()

    expect(await service.getProduct("USD", "VPN")).toBeNull()
    expect(await service.getProduct("USD", "VPN")).toBeNull()
  })

  it("returns a currency-scoped product detail response", async () => {
    mockFindFirst.mockResolvedValueOnce(product([plan("plan-standard")]))

    const result = await new CatalogService().getProduct("USD", "VPN")

    expect(result).toEqual({
      currency: "USD",
      product: expect.objectContaining({
        code: "VPN",
        plans: [expect.objectContaining({ code: "STANDARD" })],
      }),
    })

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: "VPN", isActive: true, state: "PUBLISHED" },
      })
    )
  })
})
