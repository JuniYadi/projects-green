export type DomainNetworking = {
  maxCustomDomains: number
  allowWildcardDomain: boolean
  allowCustomTls: boolean
}

export type DomainGatePlan = {
  resources?: unknown
  networking?: unknown
  maxCustomDomains?: unknown
  allowWildcardDomain?: unknown
  allowCustomTls?: unknown
  wildcard?: unknown
}

export type DomainGateInput = {
  plan: DomainGatePlan | unknown
  existingCustomDomains: number
  hostname: string
  wildcard?: boolean
  customTls?: boolean
}

export type DomainGateReason =
  | "QUOTA_EXCEEDED"
  | "WILDCARD_NOT_ALLOWED"
  | "CUSTOM_TLS_NOT_ALLOWED"

export type DomainGateResult = {
  allowed: boolean
  reason: DomainGateReason | null
  usage: { used: number; limit: number }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const firstNumber = (...values: unknown[]) => {
  const value = values.find(
    (candidate): candidate is number =>
      typeof candidate === "number" && Number.isFinite(candidate)
  )
  return value ?? 0
}

const firstBoolean = (...values: unknown[]) => {
  const value = values.find(
    (candidate): candidate is boolean => typeof candidate === "boolean"
  )
  return value ?? false
}

/** Resolve networking limits from a plan's JSON resources configuration. */
export function getDomainNetworking(plan: unknown): DomainNetworking {
  const root = isRecord(plan) ? plan : {}
  const resources = isRecord(root.resources) ? root.resources : {}
  const nested = isRecord(resources.networking)
    ? resources.networking
    : isRecord(root.networking)
      ? root.networking
      : {}

  return {
    maxCustomDomains: Math.max(
      0,
      Math.floor(
        firstNumber(
          nested.maxCustomDomains,
          resources.maxCustomDomains,
          root.maxCustomDomains
        )
      )
    ),
    allowWildcardDomain: firstBoolean(
      nested.allowWildcardDomain,
      resources.allowWildcardDomain,
      root.allowWildcardDomain,
      resources.wildcard,
      root.wildcard
    ),
    allowCustomTls: firstBoolean(
      nested.allowCustomTls,
      resources.allowCustomTls,
      root.allowCustomTls
    ),
  }
}

/** Check whether a new custom domain is available on the subscribed plan. */
export function validateDomainAddition(
  input: DomainGateInput
): DomainGateResult {
  const networking = getDomainNetworking(input.plan)
  const used = Math.max(
    0,
    Number.isFinite(input.existingCustomDomains)
      ? Math.floor(input.existingCustomDomains)
      : 0
  )
  const usage = { used, limit: networking.maxCustomDomains }
  const isWildcard = input.wildcard ?? input.hostname.trim().startsWith("*.")

  if (isWildcard && !networking.allowWildcardDomain) {
    return { allowed: false, reason: "WILDCARD_NOT_ALLOWED", usage }
  }
  if (input.customTls && !networking.allowCustomTls) {
    return { allowed: false, reason: "CUSTOM_TLS_NOT_ALLOWED", usage }
  }
  if (used >= networking.maxCustomDomains) {
    return { allowed: false, reason: "QUOTA_EXCEEDED", usage }
  }
  return { allowed: true, reason: null, usage }
}

export const canAddCustomDomain = (input: DomainGateInput) =>
  validateDomainAddition(input).allowed

export class DomainGateError extends Error {
  readonly reason: DomainGateReason
  readonly usage: DomainGateResult["usage"]

  constructor(result: DomainGateResult) {
    super(result.reason ?? "Domain addition is not allowed")
    this.name = "DomainGateError"
    this.reason = result.reason ?? "QUOTA_EXCEEDED"
    this.usage = result.usage
  }
}
export const evaluateDomainGate = validateDomainAddition
export const checkDomainGate = validateDomainAddition

export function assertDomainAdditionAllowed(input: DomainGateInput): void {
  const result = validateDomainAddition(input)
  if (!result.allowed) throw new DomainGateError(result)
}
export const assertDomainGate = assertDomainAdditionAllowed
