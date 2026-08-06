// ─── Cancel ───────────────────────────────────────────────────────────────────

export type CancelSubscriptionResult = {
  ok: true
  transition: "CANCELLED_AT_PERIOD_END"
  effectiveDate: string // ISO date — customer keeps access until currentPeriodEnd
  currentPeriodEnd: string // ISO date
  subscription: SubscriptionTransitionSnapshot
}

export type CancelError =
  | { ok: false; error: "UNAUTHORIZED"; message: string }
  | { ok: false; error: "FORBIDDEN"; message: string }
  | { ok: false; error: "NOT_FOUND"; message: string }
  | { ok: false; error: "INVALID_TRANSITION"; message: string }
  | { ok: false; error: "ALREADY_CANCELLED"; message: string }
  | { ok: false; error: "INTERNAL_SERVER_ERROR"; message: string }

// ─── Reinstate ────────────────────────────────────────────────────────────────

export type ReinstateSubscriptionResult = {
  ok: true
  transition: "REINSTATED"
  effectiveDate: string // ISO date
  subscription: SubscriptionTransitionSnapshot
}

export type ReinstateError =
  | { ok: false; error: "UNAUTHORIZED"; message: string }
  | { ok: false; error: "FORBIDDEN"; message: string }
  | { ok: false; error: "NOT_FOUND"; message: string }
  | { ok: false; error: "INVALID_TRANSITION"; message: string }
  | { ok: false; error: "NOT_PENDING_CANCELLATION"; message: string }
  | { ok: false; error: "INTERNAL_SERVER_ERROR"; message: string }

// ─── Change Plan ───────────────────────────────────────────────────────────────

export type ChangePlanPreviewResult = {
  ok: true
  newPricingId: string
  newPlanCode: string
  newBillingPeriod: string
  newPeriodMonths: number
  newPeriodPrice: string
  newCurrency: string
  effectiveDate: string // ISO date — takes effect at start of next period
  immediateCharge: {
    amount: string
    currency: string
    description: string
  } | null
}

export type ChangePlanResult = {
  ok: true
  transition: "PLAN_CHANGED"
  effectiveDate: string
  previousPricingId: string
  newPricingId: string
  subscription: SubscriptionTransitionSnapshot
}

export type ChangePlanError =
  | { ok: false; error: "UNAUTHORIZED"; message: string }
  | { ok: false; error: "FORBIDDEN"; message: string }
  | { ok: false; error: "NOT_FOUND"; message: string }
  | { ok: false; error: "INVALID_TRANSITION"; message: string }
  | { ok: false; error: "PRICING_NOT_FOUND"; message: string }
  | { ok: false; error: "PRICING_NOT_ACTIVE"; message: string }
  | { ok: false; error: "SAME_PLAN"; message: string }
  | { ok: false; error: "INTERNAL_SERVER_ERROR"; message: string }

// ─── Shared ──────────────────────────────────────────────────────────────────

export type SubscriptionTransitionSnapshot = {
  id: string
  packageCode: string
  planCode: string
  regionCode: string
  pricingId: string
  billingMode: string
  type: string
  status: string
  billingPeriod: string
  periodMonths: number
  periodPrice: string
  currency: string
  currentPeriodStart: string
  currentPeriodEnd: string
  allocatedConfig: Record<string, unknown> | null
  cancelAtPeriodEnd: boolean
}
