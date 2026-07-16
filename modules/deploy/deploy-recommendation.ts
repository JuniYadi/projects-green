import type { DetectionResult, ResourcePlanId } from "@/modules/deploy/deploy.types"

export type PlanRecommendation = {
  resourcePlanId: ResourcePlanId
  cpu?: number
  memory?: number
  label: string
}

/**
 * PGREEN-071 — Lightweight plan recommendation based on detected framework.
 *
 * Maps detected framework + engines to a suggested resource plan and PAYG
 * defaults. Pure heuristic — the user can override in the environment step.
 * Recommendation is a convenience default, not a hard constraint.
 */

const PRO_FRAMEWORKS: Record<string, true> = {
  nextjs: true,
  nuxt: true,
  express: true,
  fastify: true,
  nestjs: true,
  remix: true,
  sveltekit: true,
  astro: true,
  ghost: true,
  umami: true,
  n8n: true,
}

const PAYG_FRAMEWORKS: Record<string, true> = {
  laravel: true,
  wordpress: true,
  strapi: true,
  directus: true,
  payload: true,
  pocketbase: true,
  plausible: true,
  openclaw: true,
}

const FALLBACK_RECOMMENDATION: PlanRecommendation = {
  resourcePlanId: "pro",
  cpu: 500,
  memory: 1024,
  label: "Recommended for general use",
}

export function recommendPlan(
  detection: DetectionResult | null
): PlanRecommendation {
  if (!detection || !detection.framework) {
    return FALLBACK_RECOMMENDATION
  }

  const framework = detection.framework.toLowerCase()

  if (framework in PAYG_FRAMEWORKS) {
    let cpu = 500
    let memory = 1024

    if (detection.secondaryEngine) {
      cpu = 1000
      memory = 2048
    }

    return {
      resourcePlanId: "payg",
      cpu,
      memory,
      label: "AI recommended — heavy framework detected",
    }
  }

  if (framework in PRO_FRAMEWORKS) {
    return {
      resourcePlanId: "pro",
      cpu: 500,
      memory: 1024,
      label: "AI recommended",
    }
  }

  return {
    resourcePlanId: "starter",
    cpu: 100,
    memory: 256,
    label: "AI recommended — light workload",
  }
}
