import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"

import {
  hasValidVpnCatalogOffer,
  isVpnCatalogParentActive,
  isValidVpnCatalogOffer,
} from "./vpn-catalog-eligibility"

const at = new Date("2026-08-14T00:00:00.000Z")

function offer(overrides: Record<string, unknown> = {}) {
  return {
    type: "BUNDLE",
    billingMode: "PACKAGE",
    billingPeriod: "MONTHLY",
    periodPrice: new Prisma.Decimal("100000"),
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    isActive: true,
    ...overrides,
  }
}

describe("VPN catalog eligibility", () => {
  it("requires the active VPN parent and plan", () => {
    expect(
      isVpnCatalogParentActive({
        isActive: true,
        package: { code: "VPN", isActive: true },
      })
    ).toBe(true)
    expect(
      isVpnCatalogParentActive({
        isActive: true,
        package: { code: "APP_HOSTING", isActive: true },
      })
    ).toBe(false)
    expect(
      isVpnCatalogParentActive({
        isActive: false,
        package: { code: "VPN", isActive: true },
      })
    ).toBe(false)
  })

  it("accepts only positive active offers inside the effective window", () => {
    expect(isValidVpnCatalogOffer(offer(), at)).toBe(true)
    expect(isValidVpnCatalogOffer(offer({ effectiveTo: at }), at)).toBe(false)
    expect(
      isValidVpnCatalogOffer(
        offer({ periodPrice: new Prisma.Decimal("0") }),
        at
      )
    ).toBe(false)
    expect(
      isValidVpnCatalogOffer(
        offer({ effectiveFrom: new Date("2026-09-01T00:00:00.000Z") }),
        at
      )
    ).toBe(false)
  })

  it("reports whether any offer is purchasable", () => {
    expect(
      hasValidVpnCatalogOffer(
        [offer({ isActive: false }), offer({ id: "valid" })],
        at
      )
    ).toBe(true)
    expect(hasValidVpnCatalogOffer([offer({ isActive: false })], at)).toBe(
      false
    )
  })
})
