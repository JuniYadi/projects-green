import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"

import {
  isCurrentVpnPackageOffer,
  vpnPeriodMonths,
} from "./vpn-package-pricing"

const pricing = (overrides: Record<string, unknown> = {}) => ({
  type: "BUNDLE",
  billingMode: "PACKAGE",
  billingPeriod: "MONTHLY",
  periodPrice: new Prisma.Decimal("100000"),
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  effectiveTo: null,
  isActive: true,
  ...overrides,
})

describe("VPN package pricing eligibility", () => {
  it("accepts active recurring offers in their effective window", () => {
    expect(
      isCurrentVpnPackageOffer(pricing(), new Date("2026-06-01T00:00:00Z"))
    ).toBe(true)
  })

  it("rejects inactive, malformed, and out-of-window offers", () => {
    const at = new Date("2026-06-01T00:00:00Z")
    expect(isCurrentVpnPackageOffer(pricing({ isActive: false }), at)).toBe(
      false
    )
    expect(
      isCurrentVpnPackageOffer(pricing({ billingPeriod: "CUSTOM" }), at)
    ).toBe(false)
    expect(
      isCurrentVpnPackageOffer(
        pricing({ effectiveTo: new Date("2026-05-01T00:00:00Z") }),
        at
      )
    ).toBe(false)
  })

  it("maps recurring periods to their package durations", () => {
    expect(vpnPeriodMonths("MONTHLY")).toBe(1)
    expect(vpnPeriodMonths("QUARTERLY")).toBe(3)
    expect(vpnPeriodMonths("SEMI_ANNUAL")).toBe(6)
    expect(vpnPeriodMonths("ANNUAL")).toBe(12)
  })
})
