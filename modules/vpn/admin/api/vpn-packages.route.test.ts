import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

mock.module("@/lib/prisma", () => ({ prisma: {} }))

import { createAdminVpnPackagesRoutes } from "./vpn-packages.route"

const guard = mock(async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))

function packageRecord() {
  return {
    id: "package-1",
    name: "Business VPN",
    description: "For teams",
    price: null,
    currency: null,
    servicePlanId: "plan-1",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    servicePlan: {
      id: "plan-1",
      code: "VPN_PACKAGE_1",
      name: "Business VPN",
      isActive: true,
      package: { code: "VPN", isActive: true },
      pricings: [
        {
          id: "pricing-1",
          type: "BUNDLE",
          billingMode: "PACKAGE",
          billingPeriod: "MONTHLY",
          periodPrice: new Prisma.Decimal("100000"),
          currency: "IDR",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveTo: null,
          isActive: true,
        },
      ],
    },
    servers: [],
  }
}

describe("admin VPN package routes", () => {
  it("returns linked plan and pricing status", async () => {
    const service = {
      list: mock().mockResolvedValue([packageRecord()]),
      create: mock().mockResolvedValue(packageRecord()),
      update: mock().mockResolvedValue(packageRecord()),
      deactivate: mock().mockResolvedValue(packageRecord()),
    }
    const app = createAdminVpnPackagesRoutes({
      requireSuperAdmin: guard,
      service: service as never,
    })

    const response = await app.handle(
      new Request("http://localhost/admin/vpn/packages")
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data[0]).toMatchObject({
      servicePlanId: "plan-1",
      catalogPlan: { code: "VPN_PACKAGE_1" },
      pricingStatus: "READY",
    })
  })

  it("creates a package through the guarded route", async () => {
    const service = {
      list: mock().mockResolvedValue([]),
      create: mock().mockResolvedValue(packageRecord()),
      update: mock(),
      deactivate: mock(),
    }
    const app = createAdminVpnPackagesRoutes({
      requireSuperAdmin: guard,
      service: service as never,
    })

    const response = await app.handle(
      new Request("http://localhost/admin/vpn/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Business VPN",
          serverIds: ["server-1"],
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(service.create).toHaveBeenCalledWith({
      name: "Business VPN",
      isActive: true,
      serverIds: ["server-1"],
    })
  })
})
