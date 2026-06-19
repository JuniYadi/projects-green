import { Prisma } from "@prisma/client"

import type { ResourcePlanId } from "@/modules/deploy/deploy.types"

/**
 * PGREEN-071/069 — Deterministic PAYG pricing.
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
  resourcePlanId: ResourcePlanId
  cpu?: number | null
  memory?: number | null
}): number => {
  if (input.resourcePlanId !== "payg") {
    return FIXED_PLAN_HOURLY_COST[input.resourcePlanId]
  }

  const cpu = input.cpu && input.cpu > 0 ? input.cpu : DEFAULT_PAYG_CPU
  const memory =
    input.memory && input.memory > 0 ? input.memory : DEFAULT_PAYG_MEMORY

  const cost =
    cpu * PAYG_CPU_RATE_PER_MILLI_HOUR + memory * PAYG_MEMORY_RATE_PER_MIB_HOUR

  return round4(cost)
}

/**
 * Decimal variant for persistence and billing-gate math.
 */
export const computeHourlyCostDecimal = (input: {
  resourcePlanId: ResourcePlanId
  cpu?: number | null
  memory?: number | null
}): Prisma.Decimal => {
  return new Prisma.Decimal(String(computeHourlyCost(input)))
}
