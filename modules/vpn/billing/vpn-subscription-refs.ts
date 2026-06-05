import type { PrismaClient } from "@prisma/client"

import { VpnPriceNotConfiguredError } from "./vpn-pricing"

// ─── Resolver ───────────────────────────────────────────────────────────

export type VpnSubscriptionRefs = {
  packageId: string
  planId: string
  pricingId: string
  regionId: string
}

export class VpnSubscriptionRefsNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VpnSubscriptionRefsNotFoundError"
  }
}

/**
 * Resolve the Package / ServicePlan / Pricing / Region IDs for a
 * (planCode, regionCode) VPN combination. The seed data already
 * contains a `Package(code: "VPN")`, plans `STANDARD` and
 * `PROFESSIONAL`, and pricings for `INDONESIA` and `SINGAPORE`.
 *
 * The Pricing `basePriceIdr` is `0` for VPN today (the static
 * `resolveVpnMonthlyPrice` catalog is the source of truth for actual
 * prices), but the record itself is required for the Subscription
 * model's foreign-key constraints.
 */
export async function resolveVpnSubscriptionRefs(
  prisma: PrismaClient,
  input: { planCode: string; regionCode: string },
): Promise<VpnSubscriptionRefs> {
  const pkg = await prisma.package.findUnique({
    where: { code: "VPN" },
  })
  if (!pkg) {
    throw new VpnSubscriptionRefsNotFoundError(
      "Package with code 'VPN' not found — did you run the billing seed?",
    )
  }

  const plan = await prisma.servicePlan.findUnique({
    where: {
      packageId_code: { packageId: pkg.id, code: input.planCode },
    },
  })
  if (!plan) {
    throw new VpnSubscriptionRefsNotFoundError(
      `ServicePlan not found for package=VPN plan=${input.planCode}`,
    )
  }

  const region = await prisma.region.findUnique({
    where: { code: input.regionCode },
  })
  if (!region) {
    throw new VpnSubscriptionRefsNotFoundError(
      `Region not found: ${input.regionCode}`,
    )
  }

  const pricing = await prisma.pricing.findFirst({
    where: {
      planId: plan.id,
      regionId: region.id,
    },
  })
  if (!pricing) {
    throw new VpnSubscriptionRefsNotFoundError(
      `Pricing not found for plan=${input.planCode} region=${input.regionCode}`,
    )
  }

  return {
    packageId: pkg.id,
    planId: plan.id,
    pricingId: pricing.id,
    regionId: region.id,
  }
}

// Re-export so route tests can stub both helpers in one place.
export { VpnPriceNotConfiguredError }
