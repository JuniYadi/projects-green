/**
 * UI-local types for the admin catalog / product editor.
 *
 * These types mirror the Prisma schema addon/voucher fields (see schema.prisma
 * models ServiceAddon, ServiceAddonPricing, ServicePlanAddon,
 * ServiceSubscriptionAddon and enums VoucherKind / VoucherDiscountType /
 * VoucherCurrencyPolicy / ServiceAddonBillingMode / BillingPeriod) but are
 * declared locally so the editor UI does not depend on backend wiring that may
 * not yet be available on this branch.
 */

import type {
  BillingPeriod,
  ServiceAddonBillingMode,
  ServiceType,
  VoucherCurrencyPolicy,
  VoucherDiscountType,
  VoucherKind,
} from "@prisma/client"

// ─── Products (ServicePackage) ──────────────────────────────────────────────

export interface ProductBasicsForm {
  code: ServiceType
  name: string
  description: string
  currency: string
  isActive: boolean
}

export interface ProductPlanForm {
  id: string
  code: string
  name: string
  resources: Record<string, unknown>
  isActive: boolean
}

export interface ProductPlanOfferForm {
  id: string
  billingPeriod: BillingPeriod
  periodPrice: string
  currency: string
  chargeUnit: "SUBSCRIPTION" | "DEVICE"
  effectiveFrom: string
  effectiveTo: string | ""
  isActive: boolean
}

export interface ProductPlanEditorForm {
  id: string
  code: string
  name: string
  resources: Record<string, unknown>
  isActive: boolean
  offers: ProductPlanOfferForm[]
}

// ─── Add-ons ────────────────────────────────────────────────────────────────

export interface AddonPricingForm {
  id: string
  billingPeriod: BillingPeriod
  currency: string
  amount: string
  effectiveFrom: string
  effectiveTo: string | ""
  isActive: boolean
}

export interface AddonForm {
  id: string
  code: string
  name: string
  description: string
  billingMode: ServiceAddonBillingMode
  isActive: boolean
  prices: AddonPricingForm[]
}

export interface PlanAddonAttachmentForm {
  id: string
  addonId: string
  label: string | ""
  description: string | ""
  isRequired: boolean
  displayOrder: number
  enabledTerms: Record<string, unknown>
  isActive: boolean
}

// ─── Publish state ──────────────────────────────────────────────────────────

export type ProductPublishState = "draft" | "published" | "archived"

export interface ProductEditorState {
  basics: ProductBasicsForm
  plans: ProductPlanEditorForm[]
  addons: PlanAddonAttachmentForm[]
  publishState: ProductPublishState
  preview: boolean
}

// ─── Addon catalog list item ────────────────────────────────────────────────

export interface AddonListItem {
  id: string
  code: string
  name: string
  description: string | null
  billingMode: ServiceAddonBillingMode
  isActive: boolean
  priceCount: number
  createdAt: string
  updatedAt: string
}

export interface AddonDetail {
  id: string
  code: string
  name: string
  description: string | null
  billingMode: ServiceAddonBillingMode
  isActive: boolean
  prices: Array<{
    id: string
    billingPeriod: BillingPeriod
    currency: string
    amount: string
    effectiveFrom: string
    effectiveTo: string | null
    isActive: boolean
  }>
  planAttachments: Array<{
    id: string
    planId: string
    planCode: string
    planName: string
    label: string | null
    description: string | null
    isRequired: boolean
    displayOrder: number
    isActive: boolean
  }>
  createdAt: string
  updatedAt: string
}

// ─── Re-export enums for convenience ────────────────────────────────────────

export {
  BillingPeriod,
  ServiceAddonBillingMode,
  ServiceType,
  VoucherCurrencyPolicy,
  VoucherDiscountType,
  VoucherKind,
}

// ─── Constants used by the UI ───────────────────────────────────────────────

export const BILLING_PERIODS: BillingPeriod[] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "YEARLY",
  "CUSTOM",
]

export const SERVICE_ADDON_BILLING_MODES: ServiceAddonBillingMode[] = [
  "RECURRING",
  "ONE_TIME",
  "USAGE",
]

export const SUPPORTED_CURRENCIES = ["IDR", "USD"] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const PRODUCT_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "APP_HOSTING", label: "App Hosting" },
  { value: "VPN", label: "VPN" },
  { value: "WHATSAPP", label: "WhatsApp" },
]
