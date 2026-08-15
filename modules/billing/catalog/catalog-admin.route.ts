import { Elysia } from "elysia"
import { z } from "zod"

import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import {
  CatalogAdminService,
  CatalogPackageNotFoundError,
  CatalogPlanNotFoundError,
  CatalogAddonNotFoundError,
  CatalogRegionNotFoundError,
} from "./catalog-admin.service"
import type { RecurringBillingPeriod } from "../pricing/pricing.types"

// ─── Zod schemas ────────────────────────────────────────────────────────────

const periods = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const

const chargeUnits = ["SUBSCRIPTION", "DEVICE"] as const
const addonBillingModes = ["RECURRING", "ONE_TIME", "USAGE"] as const

const upsertProductSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

const upsertPlanSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  resources: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

const effectiveDateRefinement = (
  value: { effectiveFrom: Date; effectiveTo?: Date | null },
  ctx: z.RefinementCtx
) => {
  if (value.effectiveTo && value.effectiveTo <= value.effectiveFrom) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveTo"],
      message: "effectiveTo must be later than effectiveFrom.",
    })
  }
}

const upsertPricingSchema = z
  .object({
    regionId: z.string().trim().min(1),
    billingPeriod: z.enum(periods),
    chargeUnit: z.enum(chargeUnits),
    periodPrice: z.coerce.number().finite().min(0),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(8)
      .transform((v) => v.toUpperCase()),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .superRefine(effectiveDateRefinement)

const upsertAddonSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  billingMode: z.enum(addonBillingModes).optional(),
  isActive: z.boolean().optional(),
})

const upsertAddonPricingSchema = z
  .object({
    billingPeriod: z.enum(periods),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(8)
      .transform((v) => v.toUpperCase()),
    amount: z.coerce.number().finite().min(0),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .superRefine(effectiveDateRefinement)

const offerSchema = z
  .object({
    regionId: z.string().trim().min(1).optional(),
    billingPeriod: z.enum(periods),
    chargeUnit: z.enum(chargeUnits),
    periodPrice: z.coerce.number().finite().min(0),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(8)
      .transform((v) => v.toUpperCase()),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .superRefine(effectiveDateRefinement)

const planAttachmentSchema = z.object({
  planCode: z.string().trim().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  enabledTerms: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

const addonInPublishSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  billingMode: z.enum(addonBillingModes).optional(),
  isActive: z.boolean().optional(),
  prices: z.array(upsertAddonPricingSchema),
  planAttachments: z.array(planAttachmentSchema).optional(),
})

const publishProductSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  plans: z.array(
    z.object({
      code: z.string().trim().min(1),
      name: z.string().trim().min(1),
      resources: z.record(z.string(), z.unknown()).optional(),
      isActive: z.boolean().optional(),
      offers: z.array(offerSchema),
    })
  ),
  addons: z.array(addonInPublishSchema).optional(),
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function validationError(set: RouteSet, message = "Invalid input.") {
  set.status = 422
  return { ok: false as const, error: "VALIDATION_ERROR", message }
}

function notFound(set: RouteSet, message: string) {
  set.status = 404
  return { ok: false as const, error: "NOT_FOUND", message }
}

function serverError(set: RouteSet) {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR",
    message: "Unable to process catalog operation.",
  }
}

function handleServiceError(set: RouteSet, error: unknown) {
  if (error instanceof CatalogPackageNotFoundError) {
    return notFound(set, error.message)
  }
  if (error instanceof CatalogPlanNotFoundError) {
    return notFound(set, error.message)
  }
  if (error instanceof CatalogAddonNotFoundError) {
    return notFound(set, error.message)
  }
  if (error instanceof CatalogRegionNotFoundError) {
    return validationError(set, error.message)
  }
  if (error instanceof Error && error.message.includes("is inactive")) {
    return validationError(set, error.message)
  }
  console.error("[CatalogAdmin] Error:", error)
  return serverError(set)
}

// ─── Route factory ──────────────────────────────────────────────────────────

export type CatalogAdminRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: CatalogAdminService
}

export const createCatalogAdminRoutes = (deps: CatalogAdminRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? new CatalogAdminService()

  return (
    new Elysia()
      // ─── GET /admin/catalog/products/:code ──────────────────────────
      // The public catalog intentionally hides unpriced plans. The admin
      // editor must load them so a newly-created VPN package can be priced.
      .get("/admin/catalog/products/:code", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const product = await service.getProductForAdmin(
            params.code as string
          )
          if (!product) return notFound(set, "Catalog product not found.")
          return { ok: true as const, ...product }
        } catch (error) {
          return handleServiceError(set, error)
        }
      })
      // ─── POST /admin/catalog/products ─────────────────────────────────
      .post("/admin/catalog/products", async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = upsertProductSchema.safeParse(body)
        if (!parsed.success) return validationError(set)

        try {
          const pkg = await service.upsertPackage(parsed.data)
          set.status = 200
          return { ok: true as const, data: pkg }
        } catch (error) {
          return handleServiceError(set, error)
        }
      })

      // ─── POST /admin/catalog/products/:code/plans ─────────────────────
      .post(
        "/admin/catalog/products/:code/plans",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) return actor as AdminApiError

          const parsed = upsertPlanSchema.safeParse(body)
          if (!parsed.success) return validationError(set)

          try {
            const plan = await service.upsertPlan({
              packageCode: params.code as string,
              ...parsed.data,
            })
            set.status = 200
            return { ok: true as const, data: plan }
          } catch (error) {
            return handleServiceError(set, error)
          }
        }
      )

      // ─── POST /admin/catalog/products/:code/plans/:planId/pricing ─────
      .post(
        "/admin/catalog/products/:code/plans/:planId/pricing",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) return actor as AdminApiError

          const parsed = upsertPricingSchema.safeParse(body)
          if (!parsed.success) return validationError(set)

          try {
            const pricing = await service.upsertPlanPricing({
              planId: params.planId as string,
              regionId: parsed.data.regionId,
              billingPeriod: parsed.data
                .billingPeriod as RecurringBillingPeriod,
              chargeUnit: parsed.data.chargeUnit,
              periodPrice: parsed.data.periodPrice,
              currency: parsed.data.currency,
              effectiveFrom: parsed.data.effectiveFrom,
              effectiveTo: parsed.data.effectiveTo ?? undefined,
              isActive: parsed.data.isActive,
            })
            set.status = 200
            return { ok: true as const, data: pricing }
          } catch (error) {
            return handleServiceError(set, error)
          }
        }
      )

      // ─── POST /admin/catalog/addons ───────────────────────────────────
      .post("/admin/catalog/addons", async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = upsertAddonSchema.safeParse(body)
        if (!parsed.success) return validationError(set)

        try {
          const addon = await service.upsertAddon(parsed.data)
          set.status = 200
          return { ok: true as const, data: addon }
        } catch (error) {
          return handleServiceError(set, error)
        }
      })

      // ─── POST /admin/catalog/addons/:addonId/pricing ──────────────────
      .post(
        "/admin/catalog/addons/:addonId/pricing",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) return actor as AdminApiError

          const parsed = upsertAddonPricingSchema.safeParse(body)
          if (!parsed.success) return validationError(set)

          try {
            const addonPricing = await service.upsertAddonPricing({
              addonId: params.addonId as string,
              billingPeriod: parsed.data
                .billingPeriod as RecurringBillingPeriod,
              currency: parsed.data.currency,
              amount: parsed.data.amount,
              effectiveFrom: parsed.data.effectiveFrom,
              effectiveTo: parsed.data.effectiveTo ?? undefined,
              isActive: parsed.data.isActive,
            })
            set.status = 200
            return { ok: true as const, data: addonPricing }
          } catch (error) {
            return handleServiceError(set, error)
          }
        }
      )

      // ─── POST /admin/catalog/products/:code/publish ───────────────────
      .post(
        "/admin/catalog/products/:code/publish",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) return actor as AdminApiError

          const parsed = publishProductSchema.safeParse(body)
          if (!parsed.success) return validationError(set)

          // Enforce param code matches body code
          if (parsed.data.code !== (params.code as string)) {
            return validationError(set, "Body code must match URL param code.")
          }

          try {
            const product = await service.publishProduct({
              ...parsed.data,
              plans: parsed.data.plans.map((plan) => ({
                ...plan,
                offers: plan.offers.map((offer) => ({
                  ...offer,
                  regionId: offer.regionId,
                  billingPeriod: offer.billingPeriod as RecurringBillingPeriod,
                  effectiveTo: offer.effectiveTo ?? undefined,
                })),
              })),
              addons: parsed.data.addons?.map((addon) => ({
                ...addon,
                prices: addon.prices.map((price) => ({
                  ...price,
                  billingPeriod: price.billingPeriod as RecurringBillingPeriod,
                  effectiveTo: price.effectiveTo ?? undefined,
                })),
                planAttachments: addon.planAttachments,
              })),
            })
            set.status = 200
            return { ok: true as const, data: product }
          } catch (error) {
            return handleServiceError(set, error)
          }
        }
      )
  )
}
