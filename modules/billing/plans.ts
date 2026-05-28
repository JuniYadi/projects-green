// Service types (mirrors ServiceType enum in schema)
export const SERVICE_TYPES = ["APP_HOSTING", "VPN", "WHATSAPP"] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

// Subscription types (mirrors SubscriptionType enum in schema)
export const SUBSCRIPTION_TYPES = ["PAYG", "BUNDLE", "CUSTOM"] as const
export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number]

// Billing modes (mirrors BillingMode enum in schema)
export const BILLING_MODES = ["PACKAGE", "PAYG", "CUSTOM"] as const
export type BillingMode = (typeof BILLING_MODES)[number]

// Subscription status (mirrors BillingSubscriptionStatus2 enum in schema)
export const SUBSCRIPTION_STATUSES = ["ACTIVE", "SUSPENDED", "CANCELLED"] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

// Adjustment types (mirrors AdjustmentType enum in schema)
export const ADJUSTMENT_TYPES = ["CREDIT", "DEBIT"] as const
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number]

// ─── Plan codes (from DB seed) ────────────────────────────────────────────────

export const APP_HOSTING_PLANS = {
  STARTER: "STARTER",
  BASIC: "BASIC",
  STANDARD: "STANDARD",
  PROFESSIONAL: "PROFESSIONAL",
  CUSTOM: "CUSTOM",
} as const

export const VPN_PLANS = {
  STANDARD: "STANDARD",
  PROFESSIONAL: "PROFESSIONAL",
} as const

export const WHATSAPP_PLANS = {
  LITE: "LITE",
  STANDARD: "STANDARD",
  PROFESSIONAL: "PROFESSIONAL",
  ENTERPRISE: "ENTERPRISE",
} as const

// ─── Region codes (from DB seed) ──────────────────────────────────────────────

export const REGION_CODES = {
  INDONESIA: "INDONESIA",
  SINGAPORE: "SINGAPORE",
  GLOBAL: "GLOBAL",
} as const

// ─── Labels for UI ────────────────────────────────────────────────────────────

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  APP_HOSTING: "App Hosting",
  VPN: "VPN",
  WHATSAPP: "WhatsApp",
}

export const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = {
  PAYG: "Pay-as-you-go",
  BUNDLE: "Bundle",
  CUSTOM: "Custom",
}

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  PACKAGE: "Package",
  PAYG: "Pay-as-you-go",
  CUSTOM: "Custom",
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
}

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  CREDIT: "Credit",
  DEBIT: "Debit",
}

export const PLAN_LABELS: Record<string, string> = {
  // APP_HOSTING
  STARTER: "Starter",
  BASIC: "Basic",
  STANDARD: "Standard",
  PROFESSIONAL: "Professional",
  CUSTOM: "Custom",
  // VPN
  // WHATSAPP
  LITE: "Lite",
  ENTERPRISE: "Enterprise",
}

export const REGION_LABELS: Record<string, string> = {
  INDONESIA: "🇮🇩 Indonesia",
  SINGAPORE: "🇸🇬 Singapore",
  GLOBAL: "🌐 Global",
}