import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"

import {
  toVpnPublicPackageDTO,
  toVpnPublicPackageDetailDTO,
} from "./vpn-package-public.dto"

const at = new Date("2026-06-15T00:00:00.000Z")

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

function pricing(overrides: Record<string, unknown> = {}) {
  return {
    id: "pricing-monthly",
    type: "BUNDLE",
    billingMode: "PACKAGE",
    billingPeriod: "MONTHLY",
    periodPrice: decimal("100000"),
    currency: "IDR",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    isActive: true,
    ...overrides,
  }
}

function packageRecord(pricings = [pricing()]) {
  return {
    id: "package-1",
    name: "VPN Pro",
    description: "Fast access",
    price: null,
    currency: null,
    servicePlanId: "plan-1",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    servicePlan: { pricings },
    servers: [
      {
        id: "package-server-1",
        packageId: "package-1",
        serverId: "server-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        server: {
          id: "server-1",
          name: "SG-01",
          region: {
            id: "region-1",
            name: "Singapore",
            slug: "singapore",
            countryCode: "SG",
          },
          hasOpenVpn: true,
          hasWireGuard: true,
          hasProxy: true,
        },
      },
      {
        id: "package-server-2",
        packageId: "package-1",
        serverId: "server-2",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        server: {
          id: "server-2",
          name: "SG-02",
          region: {
            id: "region-2",
            name: "Singapore",
            slug: "singapore",
            countryCode: "SG",
          },
          hasOpenVpn: false,
          hasWireGuard: false,
          hasProxy: false,
        },
      },
    ],
  } as never
}

describe("public VPN package DTO pricing", () => {
  it("maps every recurring period and per-offer conversion", () => {
    const pkg = packageRecord([
      pricing({
        id: "annual",
        billingPeriod: "ANNUAL",
        periodPrice: decimal("1200000"),
        effectiveFrom: new Date("2026-01-04T00:00:00.000Z"),
      }),
      pricing({
        id: "monthly",
        billingPeriod: "MONTHLY",
        periodPrice: decimal("100000"),
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      }),
      pricing({
        id: "quarterly",
        billingPeriod: "QUARTERLY",
        periodPrice: decimal("300000"),
        effectiveFrom: new Date("2026-01-02T00:00:00.000Z"),
      }),
      pricing({
        id: "semi-annual",
        billingPeriod: "SEMI_ANNUAL",
        periodPrice: decimal("600000"),
        effectiveFrom: new Date("2026-01-03T00:00:00.000Z"),
      }),
    ])
    const conversions = new Map([
      [
        "monthly",
        {
          convertedPrice: decimal("10"),
          convertedCurrency: "USD",
          exchangeRate: 0.0001,
        },
      ],
    ])

    const result = toVpnPublicPackageDetailDTO(pkg, conversions, at)

    expect(
      result.offers.map((offer) => [offer.pricingId, offer.periodMonths])
    ).toEqual([
      ["monthly", 1],
      ["quarterly", 3],
      ["semi-annual", 6],
      ["annual", 12],
    ])
    expect(result.offers[0]).toMatchObject({
      periodPrice: "100000",
      convertedPrice: "10",
      convertedCurrency: "USD",
      exchangeRate: 0.0001,
      effectiveTo: null,
      isActive: true,
    })
    expect(result.offers[1].convertedPrice).toBeNull()
    expect(result.price).toBe("100000")
    expect(result.currency).toBe("IDR")
    expect(result.serverCount).toBe(2)
    expect(result.protocolCount).toBe(3)
    expect(result.regions).toEqual(["Singapore"])
    expect(result.servers[0]).toMatchObject({
      serverId: "server-1",
      name: "SG-01",
      protocols: ["OpenVPN", "WireGuard", "Proxy"],
    })
    expect(result.servers[1].protocols).toEqual([])
  })

  it("excludes inactive, non-package, invalid, and out-of-window offers", () => {
    const valid = pricing({
      id: "valid",
      billingPeriod: "QUARTERLY",
      effectiveFrom: new Date("2026-06-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-07-01T00:00:00.000Z"),
    })
    const excluded = [
      pricing({ id: "inactive", isActive: false }),
      pricing({ id: "not-bundle", type: "PAYG" }),
      pricing({ id: "not-package", billingMode: "PAYG" }),
      pricing({ id: "missing-period", billingPeriod: null }),
      pricing({ id: "unknown-period", billingPeriod: "YEARLY" }),
      pricing({ id: "missing-price", periodPrice: null }),
      pricing({ id: "negative-price", periodPrice: decimal("-1") }),
      pricing({
        id: "future",
        effectiveFrom: new Date("2026-06-16T00:00:00.000Z"),
      }),
      pricing({
        id: "expired",
        effectiveTo: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ]

    const result = toVpnPublicPackageDTO(
      packageRecord([valid, ...excluded]),
      new Map(),
      at
    )

    expect(result.offers).toHaveLength(1)
    expect(result.offers[0]).toMatchObject({
      pricingId: "valid",
      billingPeriod: "QUARTERLY",
      periodMonths: 3,
    })
  })

  it("uses stable defaults when a package has no valid current offers", () => {
    const result = toVpnPublicPackageDTO(
      packageRecord([pricing({ isActive: false })]),
      new Map(),
      at
    )

    expect(result.offers).toEqual([])
    expect(result.price).toBe("0")
    expect(result.currency).toBe("IDR")
    expect(result.convertedPrice).toBeNull()
    expect(result.convertedCurrency).toBeNull()
    expect(result.exchangeRate).toBeNull()
  })
})
