import type {
  DetectionResult as LegacyDetectionResult,
  ResourcePlanId,
} from "@/modules/deploy/deploy.types"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"

export type PlanRecommendation = {
  resourcePlanId: ResourcePlanId
  cpu?: number
  memory?: number
  label: string
}

/**
 * PGREEN-071 — Lightweight plan recommendation based on detected framework.
 *
 * Maps detected framework + dependencies to a suggested resource plan and PAYG
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

export type PlanRecommendationInput = {
  primaryFramework: Pick<
    NonNullable<DetectionResult["primaryFramework"]>,
    "id"
  > | null
  requiredDependencies: Array<
    Pick<DetectionResult["requiredDependencies"][number], "kind">
  >
}

export function recommendPlan(
  detection: PlanRecommendationInput | null
): PlanRecommendation {
  if (!detection?.primaryFramework) {
    return FALLBACK_RECOMMENDATION
  }

  const framework = detection.primaryFramework.id.toLowerCase()
  const hasToolchain = detection.requiredDependencies.some(
    (dependency) => dependency.kind === "toolchain"
  )

  if (framework in PAYG_FRAMEWORKS) {
    return {
      resourcePlanId: "payg",
      cpu: hasToolchain ? 1000 : 500,
      memory: hasToolchain ? 2048 : 1024,
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

/**
 * The legacy wizard receives a flattened detection DTO. Keep its adapter
 * separate so the inspection path uses the real detection contract above.
 */
export function recommendPlanForLegacyDetection(
  detection: Pick<LegacyDetectionResult, "framework" | "secondaryEngine"> | null
): PlanRecommendation {
  return recommendPlan({
    primaryFramework: detection?.framework ? { id: detection.framework } : null,
    requiredDependencies: detection?.secondaryEngine
      ? [{ kind: "toolchain" }]
      : [],
  })
}
