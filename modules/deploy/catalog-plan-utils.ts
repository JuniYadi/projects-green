import type { CatalogPlan } from "@/lib/billing-client"

export type PlanResources = {
  cpu: number
  mem: number
  storage: number
}

function extractNumericResource(values: unknown[], fallback: number): number {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") {
      const num = Number(v)
      if (!Number.isNaN(num)) return num
    }
  }
  return fallback
}

export function getPlanResources(plan: CatalogPlan | undefined): PlanResources {
  if (!plan) return { cpu: 500, mem: 512, storage: 0 }
  const res = plan.resources as Record<string, unknown> | undefined
  const provisioning = res?.provisioning as Record<string, unknown> | undefined
  const features = res?.features as Record<string, unknown> | undefined

  const cpu = extractNumericResource(
    [provisioning?.cpu, features?.defaultCpu, res?.defaultCpu, res?.cpu],
    plan.code === "MEDIUM" ? 1000 : 500
  )

  const rawMem = extractNumericResource(
    [provisioning?.memory, features?.defaultMem, res?.defaultMem, res?.memory],
    plan.code === "MEDIUM" ? 2048 : 512
  )

  // If memory is reported in KiB/bytes or > 32768, normalize safely using 1024 or keep as MiB
  const mem = rawMem > 32768 ? Math.round(rawMem / 1024) : rawMem

  const defaultStorage =
    plan.code?.toUpperCase() === "SMALL"
      ? 5
      : plan.code?.toUpperCase() === "MEDIUM"
        ? 20
        : plan.code?.toUpperCase() === "LARGE"
          ? 50
          : 0

  const storage = extractNumericResource(
    [
      provisioning?.storage,
      features?.storage,
      res?.storage,
      res?.defaultStorage,
    ],
    defaultStorage
  )

  return { cpu, mem, storage }
}

export function getTemplateRequiredStorageGb(blueprint: unknown): number {
  if (!blueprint || typeof blueprint !== "object") return 0
  const bp = blueprint as {
    storage?: {
      enabled?: boolean
      sizeGbDefault?: number
      mounts?: Array<{ type?: string; sizeGb?: number }>
    }
  }

  if (!bp.storage || bp.storage.enabled === false) return 0

  let totalMountsGb = 0
  if (Array.isArray(bp.storage.mounts) && bp.storage.mounts.length > 0) {
    for (const mount of bp.storage.mounts) {
      if (!mount.type || mount.type === "pvc") {
        totalMountsGb += typeof mount.sizeGb === "number" ? mount.sizeGb : 5
      }
    }
  }

  const defaultSize =
    typeof bp.storage.sizeGbDefault === "number" ? bp.storage.sizeGbDefault : 5

  return Math.max(defaultSize, totalMountsGb)
}

export function validatePlanStorageForTemplate(params: {
  requiredStorageGb: number
  planStorageGb: number
  planName?: string
}): { valid: boolean; error?: string } {
  if (params.requiredStorageGb <= 0) return { valid: true }
  if (params.planStorageGb < params.requiredStorageGb) {
    const planLabel = params.planName ? ` "${params.planName}"` : ""
    return {
      valid: false,
      error: `Selected plan${planLabel} provides ${params.planStorageGb} GB storage, but template requires ${params.requiredStorageGb} GB. Please choose a larger plan.`,
    }
  }
  return { valid: true }
}
