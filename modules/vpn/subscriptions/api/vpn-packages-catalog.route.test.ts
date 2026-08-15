import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

import { createVpnPackageCatalogRoutes } from "./vpn-packages-catalog.route"

const validPricing = (id: string) => ({
  id,
  type: "BUNDLE",
  billingMode: "PACKAGE",
  billingPeriod: "MONTHLY",
  periodPrice: new Prisma.Decimal("100000"),
  currency: "IDR",
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: null,
  isActive: true,
})

function packageRecord(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    description: null,
    price: null,
    currency: null,
    servicePlanId: `plan-${id}`,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    servicePlan: {
      id: `plan-${id}`,
      isActive: true,
      package: { code: "VPN", isActive: true },
    },
    servers: [],
    ...overrides,
  }
}

const auth = async () => ({ user: null, organizationId: null })
const currency = {
  convert: mock(),
  getRate: mock(),
}

describe("VPN package catalog routes", () => {
  it("returns only packages with an active VPN plan and valid offers", async () => {
    const findMany = mock().mockResolvedValue([
      packageRecord("ready"),
      packageRecord("unpriced"),
      packageRecord("inactive-plan", {
        servicePlan: {
          id: "plan-inactive-plan",
          isActive: false,
          package: { code: "VPN", isActive: true },
        },
      }),
      packageRecord("wrong-parent", {
        servicePlan: {
          id: "plan-wrong-parent",
          isActive: true,
          package: { code: "APP_HOSTING", isActive: true },
        },
      }),
    ])
    const pricingFindMany = mock().mockImplementation(
      async ({ where }: { where: { planId: string } }) =>
        where.planId === "plan-ready" ? [validPricing("pricing-ready")] : []
    )

    const app = createVpnPackageCatalogRoutes({
      db: {
        vpnPackage: { findMany, findFirst: mock() },
        billingAccount: { findUnique: mock() },
        servicePricing: { findMany: pricingFindMany },
      } as never,
      currency: currency as never,
      authenticate: auth,
    })

    const response = await app.handle(
      new Request("http://localhost/vpn/packages")
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject([
      { id: "ready", offers: [{ pricingId: "pricing-ready" }] },
    ])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          servicePlan: expect.objectContaining({ isActive: true }),
        }),
      })
    )
  })

  it("hides an unpriced package from detail responses", async () => {
    const findFirst = mock().mockResolvedValue(packageRecord("unpriced"))
    const app = createVpnPackageCatalogRoutes({
      db: {
        vpnPackage: { findMany: mock(), findFirst },
        billingAccount: { findUnique: mock() },
        servicePricing: { findMany: mock().mockResolvedValue([]) },
      } as never,
      currency: currency as never,
      authenticate: auth,
    })

    const response = await app.handle(
      new Request("http://localhost/vpn/packages/unpriced")
    )

    expect(response.status).toBe(404)
    expect((await response.json()).error).toBe("PACKAGE_UNAVAILABLE")
  })
})
