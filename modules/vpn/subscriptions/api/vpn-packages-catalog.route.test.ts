import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import { Elysia } from "elysia"

import { createVpnPackageCatalogRoutes } from "./vpn-packages-catalog.route"

const packageFindMany = mock<(...args: unknown[]) => Promise<unknown[]>>(
  async () => []
)
const packageFindFirst = mock<(...args: unknown[]) => Promise<unknown | null>>(
  async () => null
)
const pricingFindMany = mock<(...args: unknown[]) => Promise<unknown[]>>(
  async () => []
)

const db = {
  vpnPackage: { findMany: packageFindMany, findFirst: packageFindFirst },
  billingAccount: { findUnique: mock(async () => null) },
  servicePricing: { findMany: pricingFindMany },
}

function packageRecord(isPlanActive = true) {
  return {
    id: "package-1",
    name: "Business VPN",
    description: "For teams",
    servicePlanId: "plan-1",
    price: null,
    currency: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    servicePlan: { id: "plan-1", isActive: isPlanActive },
    servers: [
      {
        id: "package-server-1",
        packageId: "package-1",
        serverId: "server-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        server: {
          id: "server-1",
          name: "Jakarta",
          hasOpenVpn: true,
          hasWireGuard: false,
          hasProxy: false,
          region: {
            id: "region-1",
            name: "Indonesia",
            slug: "indonesia",
            countryCode: "ID",
          },
        },
      },
    ],
  }
}

function pricing(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-1",
    planId: "plan-1",
    regionId: "region-1",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    billingPeriod: "MONTHLY",
    periodPrice: new Prisma.Decimal("100000"),
    currency: "IDR",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    isActive: true,
    ...overrides,
  }
}

function app() {
  return new Elysia().use(
    createVpnPackageCatalogRoutes({
      db: db as never,
      authenticate: async () => ({ user: null, organizationId: null }),
    })
  )
}

describe("VPN package catalog route", () => {
  beforeEach(() => {
    packageFindMany.mockClear()
    packageFindFirst.mockClear()
    pricingFindMany.mockClear()
    packageFindMany.mockResolvedValue([])
    packageFindFirst.mockResolvedValue(null)
    pricingFindMany.mockResolvedValue([])
  })

  it("exposes only packages with an active plan and current offer", async () => {
    packageFindMany.mockResolvedValueOnce([packageRecord()])
    pricingFindMany.mockResolvedValueOnce([pricing()])

    const response = await app().handle(
      new Request("http://localhost/vpn/packages")
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].offers[0]).toMatchObject({
      pricingId: "offer-1",
      billingPeriod: "MONTHLY",
    })
  })

  it("excludes an inactive linked plan before mapping offers", async () => {
    packageFindMany.mockResolvedValueOnce([])

    const response = await app().handle(
      new Request("http://localhost/vpn/packages")
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual([])
    expect(packageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          servicePlan: { isActive: true },
        },
      })
    )
    expect(pricingFindMany).not.toHaveBeenCalled()
  })

  it("returns unavailable for an unpriced package detail", async () => {
    packageFindFirst.mockResolvedValueOnce(packageRecord())
    pricingFindMany.mockResolvedValueOnce([])

    const response = await app().handle(
      new Request("http://localhost/vpn/packages/package-1")
    )

    expect(response.status).toBe(404)
    expect((await response.json()).error).toBe("PACKAGE_UNAVAILABLE")
  })
})
