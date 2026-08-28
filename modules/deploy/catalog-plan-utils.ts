import type { CatalogPlan } from "@/lib/billing-client"

export function getPlanResources(plan: CatalogPlan | undefined) {
  if (!plan) return { cpu: 500, mem: 512 }
  const res = plan.resources as Record<string, unknown> | undefined
  const provisioning = res?.provisioning as Record<string, unknown> | undefined
  const features = res?.features as Record<string, unknown> | undefined

  const cpu =
    Number(provisioning?.cpu) ||
    Number(features?.defaultCpu) ||
    Number(res?.defaultCpu) ||
    Number(res?.cpu) ||
    (plan.code === "MEDIUM" ? 1000 : 500)

  const rawMem =
    Number(provisioning?.memory) ||
    Number(features?.defaultMem) ||
    Number(res?.defaultMem) ||
    Number(res?.memory) ||
    (plan.code === "MEDIUM" ? 2048 : 512)

  // If memory is reported in KiB/bytes or > 32768, normalize safely using 1024 or keep as MiB
  const mem = rawMem > 32768 ? Math.round(rawMem / 1024) : rawMem

  return { cpu, mem }
}
