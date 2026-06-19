import { describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"

import {
  VpnSubscriptionRefsNotFoundError,
  resolveVpnSubscriptionRefs,
} from "./vpn-subscription-refs"

const mockPrisma = {
  servicePackage: { findUnique: mock() },
  servicePlan: { findUnique: mock() },
  serviceRegion: { findUnique: mock() },
  servicePricing: { findFirst: mock() },
}

function decimal(value: string) {
  return Number.parseFloat(value)
}

describe("resolveVpnSubscriptionRefs", () => {
  it("returns the IDs for a known (plan, region) combination", async () => {
    mockPrisma.servicePackage.findUnique.mockResolvedValue({ id: "pkg_vpn" })
    mockPrisma.servicePlan.findUnique.mockResolvedValue({
      id: "plan_standard_id",
    })
    mockPrisma.serviceRegion.findUnique.mockResolvedValue({
      id: "region_id_id",
    })
    mockPrisma.servicePricing.findFirst.mockResolvedValue({
      id: "pricing_id",
      basePriceIdr: decimal("0"),
    })

    const refs = await resolveVpnSubscriptionRefs(
      mockPrisma as unknown as PrismaClient,
      { planCode: "STANDARD", regionCode: "INDONESIA" }
    )

    expect(refs).toEqual({
      packageId: "pkg_vpn",
      planId: "plan_standard_id",
      pricingId: "pricing_id",
      regionId: "region_id_id",
    })
  })

  it("throws when the VPN package is missing (seed not run)", async () => {
    mockPrisma.servicePackage.findUnique.mockResolvedValue(null)

    await expect(
      resolveVpnSubscriptionRefs(mockPrisma as unknown as PrismaClient, {
        planCode: "STANDARD",
        regionCode: "INDONESIA",
      })
    ).rejects.toThrow(VpnSubscriptionRefsNotFoundError)
  })

  it("throws when the plan code is unknown", async () => {
    mockPrisma.servicePackage.findUnique.mockResolvedValue({ id: "pkg_vpn" })
    mockPrisma.servicePlan.findUnique.mockResolvedValue(null)

    await expect(
      resolveVpnSubscriptionRefs(mockPrisma as unknown as PrismaClient, {
        planCode: "GIGA_PREMIUM",
        regionCode: "INDONESIA",
      })
    ).rejects.toThrow(VpnSubscriptionRefsNotFoundError)
  })

  it("throws when the region is unknown", async () => {
    mockPrisma.servicePackage.findUnique.mockResolvedValue({ id: "pkg_vpn" })
    mockPrisma.servicePlan.findUnique.mockResolvedValue({
      id: "plan_standard_id",
    })
    mockPrisma.serviceRegion.findUnique.mockResolvedValue(null)

    await expect(
      resolveVpnSubscriptionRefs(mockPrisma as unknown as PrismaClient, {
        planCode: "STANDARD",
        regionCode: "MARS",
      })
    ).rejects.toThrow(VpnSubscriptionRefsNotFoundError)
  })

  it("throws when the pricing row is missing for the (plan, region) pair", async () => {
    mockPrisma.servicePackage.findUnique.mockResolvedValue({ id: "pkg_vpn" })
    mockPrisma.servicePlan.findUnique.mockResolvedValue({
      id: "plan_standard_id",
    })
    mockPrisma.serviceRegion.findUnique.mockResolvedValue({
      id: "region_id_id",
    })
    mockPrisma.servicePricing.findFirst.mockResolvedValue(null)

    await expect(
      resolveVpnSubscriptionRefs(mockPrisma as unknown as PrismaClient, {
        planCode: "STANDARD",
        regionCode: "INDONESIA",
      })
    ).rejects.toThrow(VpnSubscriptionRefsNotFoundError)
  })
})
