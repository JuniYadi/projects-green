import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import { getHomeOffer } from "./home-offer"

const now = new Date("2026-09-25T12:00:00.000Z")

describe("getHomeOffer", () => {
  it("shows live app-hosting Starter pricing", async () => {
    const findFirst = mock(async () => ({
      periodPrice: new Prisma.Decimal(29000),
    }))

    expect(
      await getHomeOffer({ servicePricing: { findFirst } } as never, now)
    ).toEqual({ monthlyPriceIdr: "29000" })
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

  it("does not invent a price when pricing is missing", async () => {
    const findFirst = mock(async () => null)
    expect(
      await getHomeOffer({ servicePricing: { findFirst } } as never, now)
    ).toEqual({ monthlyPriceIdr: null })
  })

  it("does not invent a price when the database is unavailable", async () => {
    const findFirst = mock(async () => {
      throw new Error("unavailable")
    })
    expect(
      await getHomeOffer({ servicePricing: { findFirst } } as never, now)
    ).toEqual({ monthlyPriceIdr: null })
  })
})
