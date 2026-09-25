import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import { getHomeOffer } from "./home-offer"

const now = new Date("2026-09-25T12:00:00.000Z")

function db(voucher: Record<string, unknown> | null) {
  const findUnique = mock(async () => voucher)
  const findFirst = mock(async () => ({
    periodPrice: new Prisma.Decimal(29000),
  }))
  return {
    deps: { voucher: { findUnique }, servicePricing: { findFirst } } as never,
    findUnique,
    findFirst,
  }
}

const activeVoucher = {
  status: "ACTIVE",
  kind: "PRODUCT_PROMOTION",
  claimedCount: 14,
  maxClaims: 15,
  expiresAt: new Date("2026-10-25T12:00:00.000Z"),
  targetWorkosUserId: null,
  targetOrganizationId: null,
  allowedPackageCodes: ["APP_HOSTING"],
}

describe("getHomeOffer", () => {
  it("shows the offer only while the app-hosting voucher has capacity", async () => {
    const { deps, findUnique, findFirst } = db(activeVoucher)

    expect(await getHomeOffer(deps, now)).toEqual({
      kind: "promo",
      code: "WELCOME-PFNAI",
    })
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "WELCOME-PFNAI" } })
    )
    expect(findFirst).not.toHaveBeenCalled()
  })

  for (const voucher of [
    null,
    { ...activeVoucher, claimedCount: 15 },
    { ...activeVoucher, status: "DEPLETED" },
    { ...activeVoucher, expiresAt: now },
    { ...activeVoucher, kind: "BALANCE_CREDIT" },
    { ...activeVoucher, maxClaims: 30 },
    { ...activeVoucher, allowedPackageCodes: ["VPN"] },
    { ...activeVoucher, targetWorkosUserId: "target-user" },
  ]) {
    it(`shows live normal pricing when the voucher is ${voucher?.status ?? "missing"} (${voucher?.claimedCount ?? "none"})`, async () => {
      const { deps, findFirst } = db(voucher)
      expect(await getHomeOffer(deps, now)).toEqual({
        kind: "standard",
        monthlyPriceIdr: "29000",
      })
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            servicePlan: {
              code: "STARTER",
              package: { code: "APP_HOSTING" },
            },
            billingPeriod: "MONTHLY",
            currency: "IDR",
          }),
        })
      )
    })
  }

  it("does not invent a price when the database is unavailable", async () => {
    const { deps, findUnique } = db(activeVoucher)
    findUnique.mockRejectedValueOnce(new Error("unavailable"))
    expect(await getHomeOffer(deps, now)).toEqual({
      kind: "standard",
      monthlyPriceIdr: null,
    })
  })
})
