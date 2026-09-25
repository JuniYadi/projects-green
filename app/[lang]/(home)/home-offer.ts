import type { PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type HomeOffer = { monthlyPriceIdr: string | null }

export async function getHomeOffer(
  db: Pick<PrismaClient, "servicePricing"> = prisma,
  now = new Date()
): Promise<HomeOffer> {
  try {
    const pricing = await db.servicePricing.findFirst({
      where: {
        servicePlan: { code: "STARTER", package: { code: "APP_HOSTING" } },
        billingPeriod: "MONTHLY",
        currency: "IDR",
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        periodPrice: { gt: 0 },
      },
      select: { periodPrice: true },
      orderBy: { periodPrice: "asc" },
    })

    return {
      monthlyPriceIdr: pricing?.periodPrice?.toString() ?? null,
    }
  } catch {
    return { monthlyPriceIdr: null }
  }
}
