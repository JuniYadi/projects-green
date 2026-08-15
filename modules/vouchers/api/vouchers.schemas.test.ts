import { describe, expect, it } from "bun:test"

import { createPortalVoucherSchema } from "./vouchers.schemas"

const futureExpiry = () => new Date(Date.now() + 60_000).toISOString()

const productPromotion = () => ({
  kind: "PRODUCT_PROMOTION" as const,
  maxClaims: 1,
  expiresAt: futureExpiry(),
  discountType: "PERCENTAGE" as const,
  discountValue: 15,
  currencyPolicy: "MATCH_CURRENCY_ONLY" as const,
  allowedPackageCodes: ["VPN" as const],
  allowedBillingPeriods: ["MONTHLY" as const],
})

describe("createPortalVoucherSchema", () => {
  it("keeps legacy balance-credit requests compatible", () => {
    const result = createPortalVoucherSchema.safeParse({
      maxClaims: 1,
      expiresAt: futureExpiry(),
      amount: 10,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kind).toBe("BALANCE_CREDIT")
      expect(result.data.status).toBe("ACTIVE")
    }
  })

  it("accepts an explicit disabled initial status for balance credit", () => {
    const result = createPortalVoucherSchema.safeParse({
      maxClaims: 1,
      expiresAt: futureExpiry(),
      amount: 10,
      kind: "BALANCE_CREDIT",
      status: "DISABLED",
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.status).toBe("DISABLED")
  })

  it("rejects balance-credit fields on product promotions", () => {
    const result = createPortalVoucherSchema.safeParse({
      ...productPromotion(),
      amount: 10,
      currency: "IDR",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const unrecognized = result.error.issues.filter(
        (issue) => issue.code === "unrecognized_keys"
      )
      expect(unrecognized).toHaveLength(1)
      expect(unrecognized[0]?.keys).toEqual(["amount", "currency"])
    }
  })

  it("requires product eligibility, billing periods, and future expiry", () => {
    const result = createPortalVoucherSchema.safeParse({
      ...productPromotion(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      allowedPackageCodes: [],
      allowedBillingPeriods: [],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."))
      expect(paths).toContain("expiresAt")
      expect(paths).toContain("allowedPackageCodes")
      expect(paths).toContain("allowedBillingPeriods")
    }
  })
})
