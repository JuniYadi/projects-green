import { PAYG_BASE_LIMITS } from "@/modules/deploy/deploy.constants"
import {
  computeHourlyCost,
  FIXED_PLAN_HOURLY_COST,
} from "@/modules/deploy/deploy-pricing"
import type { ResourcePlanId } from "@/modules/deploy/deploy.types"

export type ResourceSelectionInput = {
  resourcePlanId: ResourcePlanId
  cpu?: number
  memory?: number
  bufferHours?: number
}

export type ResolvedResourceSelection = {
  cpu: number
  memory: number
  hourlyCost: number
}

const FIXED_PLAN_RESOURCES: Record<
  Exclude<ResourcePlanId, "payg">,
  Pick<ResolvedResourceSelection, "cpu" | "memory">
> = {
  starter: { cpu: 100, memory: 256 },
  pro: { cpu: 500, memory: 1024 },
}

const isStepValue = (value: number, step: number): boolean => {
  return value % step === 0
}

export const resolveResourceSelection = (
  selection: ResourceSelectionInput
): ResolvedResourceSelection => {
  if (
    selection.bufferHours !== undefined &&
    (!Number.isInteger(selection.bufferHours) ||
      selection.bufferHours < 24 ||
      selection.bufferHours > 720)
  ) {
    throw new Error("RESOURCE_SELECTION_INVALID")
  }

  if (selection.resourcePlanId !== "payg") {
    const resources = FIXED_PLAN_RESOURCES[selection.resourcePlanId]
    return {
      ...resources,
      hourlyCost: FIXED_PLAN_HOURLY_COST[selection.resourcePlanId],
    }
  }

  const cpu = selection.cpu ?? PAYG_BASE_LIMITS.cpu.min
  const memory = selection.memory ?? PAYG_BASE_LIMITS.memory.min
  const validCpu =
    Number.isInteger(cpu) &&
    cpu >= PAYG_BASE_LIMITS.cpu.min &&
    cpu <= PAYG_BASE_LIMITS.cpu.max &&
    isStepValue(cpu, PAYG_BASE_LIMITS.cpu.step)
  const validMemory =
    Number.isInteger(memory) &&
    memory >= PAYG_BASE_LIMITS.memory.min &&
    memory <= PAYG_BASE_LIMITS.memory.max &&
    isStepValue(memory, PAYG_BASE_LIMITS.memory.step)

  if (!validCpu || !validMemory) {
    throw new Error("RESOURCE_SELECTION_INVALID")
  }

  return {
    cpu,
    memory,
    hourlyCost: computeHourlyCost({
      resourcePlanId: "payg",
      cpu,
      memory,
    }),
  }
}
