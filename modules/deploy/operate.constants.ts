import type { K8sEnvironmentId } from "@/modules/deploy/operate.types"

export const OPERATE_TAB_IDS = [
  "overview",
  "domains",
  "env",
  "mounts",
  "scaling",
  "metrics",
  "logs",
  "events",
] as const

export type OperateTabId = (typeof OPERATE_TAB_IDS)[number]

export const OPERATE_TAB_QUERY_KEY = "tab"
export const OPERATE_ENV_QUERY_KEY = "env"

const K8S_ENV_IDS: readonly K8sEnvironmentId[] = [
  "dev",
  "staging",
  "prod",
] as const

export const parseTabQueryValue = (
  value: string | null | undefined
): OperateTabId => {
  if (!value) return "overview"
  const matched = OPERATE_TAB_IDS.find((t) => t === value)
  return matched ?? "overview"
}

export const parseEnvQueryValue = (
  value: string | null | undefined
): K8sEnvironmentId => {
  if (!value) return "prod"
  const matched = K8S_ENV_IDS.find((e) => e === value)
  return matched ?? "prod"
}
