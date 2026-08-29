import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ResourcePlanId } from "@/modules/deploy/deploy.types"

/**
 *
 * The billing gate (deploy-trigger.route.ts) and the deploy submit flow
 * need a single, predictable hourly cost derived from the requested
 * compute so the required-balance check is honest and reproducible.
 *
 * Rates are intentionally simple and explicit so the number shown in the
 * console matches what the gate enforces. Non-PAYG plans carry a fixed
 * hourly rate; PAYG scales linearly with CPU (milli-cores) and memory (MiB).
 */

// Rate units are in the billing account currency (minor decimals supported).
export const PAYG_CPU_RATE_PER_MILLI_HOUR = 0.00005 // per 1m CPU per hour
export const PAYG_MEMORY_RATE_PER_MIB_HOUR = 0.00001 // per 1MiB per hour

export const FIXED_PLAN_HOURLY_COST: Record<
  Exclude<ResourcePlanId, "payg">,
  number
> = {
  starter: 0.02,
  pro: 0.08,
}

const DEFAULT_PAYG_CPU = 100
const DEFAULT_PAYG_MEMORY = 256

const round4 = (value: number): number => {
  return Math.round(value * 10_000) / 10_000
}

/**
 * Compute the hourly cost for a resource plan as a plain number.
 * PAYG uses the requested cpu/memory (with safe defaults); fixed plans
 * use their flat rate.
 */
export const computeHourlyCost = (input: {
  resourcePlanId: string
  cpu?: number | null
  memory?: number | null
}): number => {
  const planKey = input.resourcePlanId.toLowerCase()
  if (planKey !== "payg") {
    const cost =
      FIXED_PLAN_HOURLY_COST[planKey as Exclude<ResourcePlanId, "payg">]
    if (cost !== undefined) return cost
    console.warn(
      `[deploy-pricing] Unknown resourcePlanId: "${planKey}", falling back to PAYG`
    )
  }

  const cpu = input.cpu && input.cpu > 0 ? input.cpu : DEFAULT_PAYG_CPU
  const memory =
    input.memory && input.memory > 0 ? input.memory : DEFAULT_PAYG_MEMORY

  const cost =
    cpu * PAYG_CPU_RATE_PER_MILLI_HOUR + memory * PAYG_MEMORY_RATE_PER_MIB_HOUR

  return round4(cost)
}

/**
 * Resolve hourly cost from database ServicePricing for a given region and plan,
 * falling back to deterministic calculation if no matching pricing row exists (sparse coverage).
 */
export async function resolveServerHourlyCost(input: {
  resourcePlanId: string
  regionId?: string | null
  currency?: string
  cpu?: number | null
  memory?: number | null
}): Promise<{
  hourlyCost: Prisma.Decimal
  source: "SERVICE_PRICING" | "DETERMINISTIC_FALLBACK"
  pricingId?: string
}> {
  const currency = input.currency ?? "USD"
  const planKey = input.resourcePlanId.toUpperCase()

  if (input.regionId) {
    const plan = await prisma.servicePlan.findFirst({
      where: {
        package: { code: "APP_HOSTING" },
        code: planKey,
        isActive: true,
      },
      select: { id: true },
    })

    if (plan) {
      const pricing = await prisma.servicePricing.findFirst({
        where: {
          planId: plan.id,
          regionId: input.regionId,
          currency,
          isActive: true,
        },
        orderBy: { effectiveFrom: "desc" },
      })

      if (pricing) {
        if (
          pricing.billingMode === "PAYG" &&
          (pricing.unitRateCpu || pricing.unitRateMem)
        ) {
          const cpu = input.cpu && input.cpu > 0 ? input.cpu : DEFAULT_PAYG_CPU
          const memory =
            input.memory && input.memory > 0
              ? input.memory
              : DEFAULT_PAYG_MEMORY
          const cpuRate = Number(
            pricing.unitRateCpu ?? PAYG_CPU_RATE_PER_MILLI_HOUR
          )
          const memRate = Number(
            pricing.unitRateMem ?? PAYG_MEMORY_RATE_PER_MIB_HOUR
          )
          const calculated = round4(cpu * cpuRate + memory * memRate)
          return {
            hourlyCost: new Prisma.Decimal(String(calculated)),
            source: "SERVICE_PRICING",
            pricingId: pricing.id,
          }
        }
        if (pricing.periodPrice) {
          // Fixed tier monthly rate converted to hourly (~720 hours/month)
          const hourlyFromPeriod = round4(Number(pricing.periodPrice) / 720)
          return {
            hourlyCost: new Prisma.Decimal(String(hourlyFromPeriod)),
            source: "SERVICE_PRICING",
            pricingId: pricing.id,
          }
        }
      }
    }
  }

  return {
    hourlyCost: computeHourlyCostDecimal(input),
    source: "DETERMINISTIC_FALLBACK",
  }
}

/**
 * Decimal variant for persistence and billing-gate math.
 */
export const computeHourlyCostDecimal = (input: {
  resourcePlanId: string
  cpu?: number | null
  memory?: number | null
}): Prisma.Decimal => {
  return new Prisma.Decimal(String(computeHourlyCost(input)))
}
