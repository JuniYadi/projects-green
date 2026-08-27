import type React from "react"
import type { ServiceType } from "@prisma/client"

export type PlanResourcePartitions = {
  features: Record<string, unknown>
  provisioning: Record<string, unknown>
  provisioningFields: unknown[]
}

export interface ProductProvisionAdapter<TConfig = Record<string, unknown>> {
  id: ServiceType
  name: string
  description: string
  defaultConfig?: TConfig
  defaultBlueprint?: TConfig
  parsePlanConfig?: (config: unknown) => TConfig
  parseBlueprint?: (config: unknown) => TConfig
  PlanConfigComponent: React.ComponentType<{
    value: TConfig
    onChange: (config: TConfig) => void
    disabled?: boolean
    errors?: Record<string, string>
  }>
  validatePlanConfig?: (config: unknown) => {
    valid: boolean
    errors?: Record<string, string>
  }

  fulfill?: (
    input: unknown,
    tx: unknown
  ) => Promise<{ success: boolean; accountIds: string[] }>
}
