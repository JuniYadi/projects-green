import type { PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const PROMO_CODE = "WELCOME-PFNAI"

export type HomeOffer =
  | { kind: "promo"; code: typeof PROMO_CODE }
  | { kind: "standard"; monthlyPriceIdr: string | null }

export async function getHomeOffer(
  db: Pick<PrismaClient, "voucher" | "servicePricing"> = prisma,
  now = new Date()
): Promise<HomeOffer> {
  try {
    const voucher = await db.voucher.findUnique({
      where: { code: PROMO_CODE },
      select: {
        status: true,
        kind: true,
        claimedCount: true,
        maxClaims: true,
        expiresAt: true,
        targetWorkosUserId: true,
        targetOrganizationId: true,
        allowedPackageCodes: true,
      },
    })

    const allowedPackages = voucher?.allowedPackageCodes
    if (
      voucher?.status === "ACTIVE" &&
      voucher.kind === "PRODUCT_PROMOTION" &&
      voucher.maxClaims === 15 &&
      voucher.claimedCount < voucher.maxClaims &&
      voucher.expiresAt > now &&
      !voucher.targetWorkosUserId &&
      !voucher.targetOrganizationId &&
      Array.isArray(allowedPackages) &&
      allowedPackages.includes("APP_HOSTING")
    ) {
      return { kind: "promo", code: PROMO_CODE }
    }

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
      kind: "standard",
      monthlyPriceIdr: pricing?.periodPrice?.toString() ?? null,
    }
  } catch {
    return { kind: "standard", monthlyPriceIdr: null }
  }
}
