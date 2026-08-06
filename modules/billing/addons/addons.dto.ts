import type { Prisma, ServiceAddonBillingMode } from "@prisma/client"

import type { RecurringBillingPeriod } from "../pricing/pricing.types"

/**
 * The recurring billing periods that addon prices can be offered in.
 */
export const ADDON_RECURRING_PERIODS: ReadonlyArray<RecurringBillingPeriod> = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
]

/**
 * Maps a BillingPeriod enum value to its normalized number of months.
 * Only the standard recurring periods are supported for addons.
 */
export const ADDON_PERIOD_MONTHS: Record<
  RecurringBillingPeriod,
  1 | 3 | 6 | 12
> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

// ─── Pricing record (internal Prisma payload) ─────────────────────────────

export type AddonPricingRecord = Prisma.ServiceAddonPricingGetPayload<object>

// A simple relation-include shape that Prisma's GetPayload type can resolve.
// Effective-date and active filtering is applied in toAddonDTO / toAddonPriceDTO
// so the type stays clean and Prisma-compatible.
type AddonWithPricesInclude = {
  include: {
    prices: true
  }
}

export type AddonRecord = Prisma.ServiceAddonGetPayload<AddonWithPricesInclude>

// ─── Plan attachment include (shared between service and DTO) ─────────────

export type PlanAttachmentIncludeShape = {
  include: {
    plan: {
      select: {
        id: true
        code: true
        package: { select: { code: true } }
      }
    }
    addon: {
      select: {
        id: true
        code: true
        name: true
      }
    }
  }
}

export type AddonPlanAttachmentRecord =
  Prisma.ServicePlanAddonGetPayload<PlanAttachmentIncludeShape>

// ─── Pricing DTO ────────────────────────────────────────────────────────────

export type AddonPriceDTO = {
  id: string
  billingPeriod: RecurringBillingPeriod
  periodMonths: 1 | 3 | 6 | 12
  amount: string
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
}

export function toAddonPriceDTO(
  pricing: AddonPricingRecord
): AddonPriceDTO | null {
  const billingPeriod = pricing.billingPeriod as RecurringBillingPeriod
  if (!(billingPeriod in ADDON_PERIOD_MONTHS)) return null

  return {
    id: pricing.id,
    billingPeriod,
    periodMonths: ADDON_PERIOD_MONTHS[billingPeriod],
    amount: pricing.amount.toString(),
    currency: pricing.currency,
    effectiveFrom: pricing.effectiveFrom.toISOString(),
    effectiveTo: pricing.effectiveTo?.toISOString() ?? null,
    isActive: pricing.isActive,
  }
}

// ─── Addon DTO ───────────────────────────────────────────────────────────────

export type AddonDTO = {
  id: string
  code: string
  name: string
  description: string | null
  billingMode: ServiceAddonBillingMode
  isActive: boolean
  createdAt: string
  updatedAt: string
  prices: AddonPriceDTO[]
}

function isPriceCurrent(pricing: AddonPricingRecord, now: Date): boolean {
  if (!pricing.isActive) return false
  if (pricing.effectiveFrom > now) return false
  if (pricing.effectiveTo !== null && pricing.effectiveTo < now) return false
  return true
}

export function toAddonDTO(addon: AddonRecord): AddonDTO {
  const now = new Date()
  return {
    id: addon.id,
    code: addon.code,
    name: addon.name,
    description: addon.description,
    billingMode: addon.billingMode as ServiceAddonBillingMode,
    isActive: addon.isActive,
    createdAt: addon.createdAt.toISOString(),
    updatedAt: addon.updatedAt.toISOString(),
    prices: addon.prices
      .filter(
        (
          p
        ): p is AddonPricingRecord & {
          billingPeriod: RecurringBillingPeriod
        } => (p.billingPeriod as string) in ADDON_PERIOD_MONTHS
      )
      .filter((p) => isPriceCurrent(p, now))
      .map(toAddonPriceDTO)
      .filter((p): p is AddonPriceDTO => p !== null),
  }
}

// ─── Plan attachment DTO ─────────────────────────────────────────────────────

export type AddonPlanAttachmentDTO = {
  id: string
  planId: string
  planCode: string
  packageCode: string
  addonId: string
  addonCode: string
  addonName: string
  label: string | null
  description: string | null
  isRequired: boolean
  displayOrder: number
  enabledTerms: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function toAddonPlanAttachmentDTO(
  attachment: AddonPlanAttachmentRecord
): AddonPlanAttachmentDTO {
  return {
    id: attachment.id,
    planId: attachment.plan.id,
    planCode: attachment.plan.code,
    packageCode: attachment.plan.package.code,
    addonId: attachment.addon.id,
    addonCode: attachment.addon.code,
    addonName: attachment.addon.name,
    label: attachment.label,
    description: attachment.description,
    isRequired: attachment.isRequired,
    displayOrder: attachment.displayOrder,
    enabledTerms: attachment.enabledTerms as Record<string, unknown> | null,
    isActive: attachment.isActive,
    createdAt: attachment.createdAt.toISOString(),
    updatedAt: attachment.updatedAt.toISOString(),
  }
}

// ─── List responses ─────────────────────────────────────────────────────────

export type AddonListResponse = {
  addons: AddonDTO[]
  currency: string
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type AddonDetailResponse = {
  addon: AddonDTO
}

export type AddonPlanAttachmentListResponse = {
  attachments: AddonPlanAttachmentDTO[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type AddonPlanAttachmentDetailResponse = {
  attachment: AddonPlanAttachmentDTO
}

// ─── Input schemas (Zod) ────────────────────────────────────────────────────

import { z } from "zod"

export const addonPriceSchema = z.object({
  billingPeriod: z.enum(
    ADDON_RECURRING_PERIODS as readonly [string, ...string[]]
  ),
  currency: z.string().trim().min(3).max(3).default("IDR"),
  amount: z.coerce.number().positive(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
})

export const createAddonSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(256),
  description: z.string().trim().max(1024).optional().nullable(),
  billingMode: z
    .enum(["RECURRING", "ONE_TIME", "USAGE"] as const)
    .default("RECURRING"),
  prices: z
    .array(addonPriceSchema)
    .min(1)
    .refine(
      (prices) =>
        prices.every(
          (p) =>
            !p.effectiveTo ||
            !p.effectiveFrom ||
            p.effectiveTo >= p.effectiveFrom
        ),
      {
        message: "effectiveTo must be on or after effectiveFrom.",
      }
    ),
  isActive: z.boolean().default(true),
})

export const updateAddonSchema = createAddonSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  })

export const attachAddonToPlanSchema = z.object({
  planId: z.string().trim().min(1),
  addonId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(256).optional(),
  description: z.string().trim().max(1024).optional().nullable(),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  enabledTerms: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const updatePlanAddonSchema = attachAddonToPlanSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  })

export type CreateAddonInput = z.infer<typeof createAddonSchema>
export type UpdateAddonInput = z.infer<typeof updateAddonSchema>
export type AttachAddonToPlanInput = z.infer<typeof attachAddonToPlanSchema>
export type UpdatePlanAddonInput = z.infer<typeof updatePlanAddonSchema>
