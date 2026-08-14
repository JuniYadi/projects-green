import { Elysia } from "elysia"
import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { CurrencyNotFoundError, CurrencyService } from "../../currency.service"
import { prisma as defaultPrisma } from "@/lib/prisma"
import { toPricingDTO } from "../../pricing/pricing.dto"
import type { RecurringBillingPeriod } from "../../pricing/pricing.types"

const periods = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const
const pricingInclude = {
  servicePlan: { include: { package: true } },
  region: true,
} as const

type PricingWithRelations = Prisma.ServicePricingGetPayload<{
  include: typeof pricingInclude
}>

type PricingDb = Pick<
  PrismaClient,
  | "servicePricing"
  | "servicePlan"
  | "serviceRegion"
  | "billingOrderLine"
  | "serviceSubscription"
  | "$transaction"
>

type AdminPricingRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  prisma?: PricingDb
  currencyService?: Pick<CurrencyService, "getByCode" | "convert">
}

const baseInputSchema = z.object({
  planId: z.string().trim().min(1),
  regionId: z.string().trim().min(1),
  billingPeriod: z.enum(periods),
  chargeUnit: z.enum(["SUBSCRIPTION", "DEVICE"]),
  periodPrice: z.coerce.number().finite().min(0),
  currency: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .transform((value) => value.toUpperCase()),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
})

const inputSchema = baseInputSchema.superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo <= value.effectiveFrom) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveTo"],
      message: "effectiveTo must be later than effectiveFrom.",
    })
  }
})

const patchSchema = baseInputSchema.partial().superRefine((value, ctx) => {
  if (
    value.effectiveFrom &&
    value.effectiveTo &&
    value.effectiveTo <= value.effectiveFrom
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveTo"],
      message: "effectiveTo must be later than effectiveFrom.",
    })
  }
})

const querySchema = z.object({
  packageCode: z.string().optional(),
  planCode: z.string().optional(),
  regionCode: z.string().optional(),
  billingPeriod: z.enum(periods).optional(),
  currency: z.string().optional(),
  includeInactive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === true || value === "true"),
})

function validationError(set: RouteSet, message = "Invalid pricing input.") {
  set.status = 422
  return { ok: false as const, error: "VALIDATION_ERROR", message }
}
function notFound(set: RouteSet, message: string) {
  set.status = 404
  return { ok: false as const, error: "NOT_FOUND", message }
}
function conflict(set: RouteSet, message: string) {
  set.status = 422
  return { ok: false as const, error: "CONFLICT", message }
}
function serverError(set: RouteSet) {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR",
    message: "Unable to manage pricing.",
  }
}
function isPrismaConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

async function computeBasePriceIdr(
  periodPrice: number,
  currency: string,
  currencies: Pick<CurrencyService, "convert">
): Promise<Prisma.Decimal> {
  if (currency === "IDR") {
    return new Prisma.Decimal(periodPrice)
  }
  return currencies.convert(periodPrice, currency, "IDR")
}

export const createAdminPricingRoutes = (deps: AdminPricingRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const db = deps.prisma ?? defaultPrisma
  const currencies = deps.currencyService ?? new CurrencyService(db as never)

  return new Elysia()
    .get("/admin/pricing", async ({ query, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const parsed = querySchema.safeParse(query)
      if (!parsed.success) return validationError(set)
      try {
        const {
          packageCode,
          planCode,
          regionCode,
          billingPeriod,
          currency,
          includeInactive,
        } = parsed.data
        const where: Prisma.ServicePricingWhereInput = {
          type: "BUNDLE",
          billingMode: "PACKAGE",
          ...(includeInactive ? {} : { isActive: true }),
          ...(billingPeriod ? { billingPeriod } : {}),
          ...(currency ? { currency: currency.toUpperCase() } : {}),
          ...(planCode || packageCode
            ? {
                servicePlan: {
                  ...(planCode ? { code: planCode } : {}),
                  ...(packageCode
                    ? { package: { code: packageCode as never } }
                    : {}),
                },
              }
            : {}),
          ...(regionCode ? { region: { code: regionCode } } : {}),
        }
        const rows = await db.servicePricing.findMany({
          where,
          include: pricingInclude,
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        })
        const data = rows.map((row) =>
          toPricingDTO(row as PricingWithRelations)
        )
        return { ok: true as const, data, pricing: data }
      } catch (error) {
        console.error("[AdminPricingList] Error:", error)
        return serverError(set)
      }
    })
    .post(
      "/admin/pricing",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError
        const parsed = inputSchema.safeParse(body)
        if (!parsed.success) return validationError(set)
        const input = parsed.data
        try {
          const [plan, region, currency] = await Promise.all([
            db.servicePlan.findUnique({
              where: { id: input.planId },
              select: { id: true },
            }),
            db.serviceRegion.findUnique({
              where: { id: input.regionId },
              select: { id: true },
            }),
            currencies.getByCode(input.currency),
          ])
          if (!plan || !region)
            return validationError(set, "Plan or region not found.")
          if (!currency.isActive)
            return validationError(set, "Currency is inactive.")
          const duplicate = await db.servicePricing.findFirst({
            where: {
              planId: input.planId,
              regionId: input.regionId,
              type: "BUNDLE",
              billingMode: "PACKAGE",
              billingPeriod: input.billingPeriod,
              currency: input.currency,
              effectiveFrom: input.effectiveFrom,
              isActive: true,
            },
          })
          if (duplicate)
            return conflict(
              set,
              "An active price already starts at this effective date."
            )
          const basePriceIdr = await computeBasePriceIdr(
            input.periodPrice,
            input.currency,
            currencies
          )
          const created = await db.servicePricing.create({
            data: {
              planId: input.planId,
              regionId: input.regionId,
              type: "BUNDLE",
              billingMode: "PACKAGE",
              billingPeriod: input.billingPeriod,
              chargeUnit: input.chargeUnit,
              periodPrice: new Prisma.Decimal(input.periodPrice),
              basePriceIdr,
              currency: input.currency,
              effectiveFrom: input.effectiveFrom,
              effectiveTo: input.effectiveTo ?? null,
              isActive: input.isActive,
            },
            include: pricingInclude,
          })
          set.status = 201
          return {
            ok: true as const,
            data: toPricingDTO(created as PricingWithRelations),
          }
        } catch (error) {
          if (error instanceof CurrencyNotFoundError)
            return validationError(set, "Currency is not configured.")
          if (isPrismaConflict(error))
            return conflict(
              set,
              "A price with this effective identity already exists."
            )
          console.error("[AdminPricingCreate] Error:", error)
          return serverError(set)
        }
      },
      { body: z.record(z.string(), z.unknown()) }
    )
    .patch("/admin/pricing/:id", async ({ params, body, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const parsed = patchSchema.safeParse(body)
      if (!parsed.success) return validationError(set)
      try {
        const existing = await db.servicePricing.findUnique({
          where: { id: params.id },
          include: pricingInclude,
        })
        if (!existing) return notFound(set, "Pricing not found.")
        const input = parsed.data
        if (input.currency) {
          const currency = await currencies.getByCode(input.currency)
          if (!currency.isActive)
            return validationError(set, "Currency is inactive.")
        }
        const charged = await db.billingOrderLine.findFirst({
          where: {
            pricingId: params.id,
            order: { status: { in: ["CHARGED", "FULFILLED"] } },
          },
          select: { id: true },
        })
        const merged = {
          planId: input.planId ?? existing.planId,
          regionId: input.regionId ?? existing.regionId,
          billingPeriod: input.billingPeriod ?? existing.billingPeriod,
          chargeUnit: input.chargeUnit ?? existing.chargeUnit,
          periodPrice:
            input.periodPrice ??
            Number(existing.periodPrice ?? existing.basePriceIdr),
          currency: input.currency ?? existing.currency,
          effectiveFrom: input.effectiveFrom ?? existing.effectiveFrom,
          effectiveTo:
            input.effectiveTo === undefined
              ? existing.effectiveTo
              : input.effectiveTo,
          isActive: input.isActive ?? existing.isActive,
        }
        if (
          !merged.billingPeriod ||
          !periods.includes(merged.billingPeriod as RecurringBillingPeriod)
        )
          return validationError(
            set,
            "Only recurring pricing can be managed here."
          )
        if (merged.effectiveTo && merged.effectiveTo <= merged.effectiveFrom)
          return validationError(
            set,
            "effectiveTo must be later than effectiveFrom."
          )
        if (charged) {
          const basePriceIdr = await computeBasePriceIdr(
            merged.periodPrice,
            merged.currency,
            currencies
          )
          const replacement = await db.$transaction(async (tx) => {
            await tx.servicePricing.update({
              where: { id: params.id },
              data: { isActive: false },
            })
            return tx.servicePricing.create({
              data: {
                planId: merged.planId,
                regionId: merged.regionId,
                type: "BUNDLE",
                billingMode: "PACKAGE",
                billingPeriod: merged.billingPeriod,
                chargeUnit: merged.chargeUnit,
                periodPrice: new Prisma.Decimal(merged.periodPrice),
                basePriceIdr,
                currency: merged.currency,
                effectiveFrom: input.effectiveFrom ?? new Date(),
                effectiveTo: merged.effectiveTo,
                isActive: merged.isActive,
              },
              include: pricingInclude,
            })
          })
          return {
            ok: true as const,
            data: toPricingDTO(replacement as PricingWithRelations),
          }
        }
        const basePriceIdr = await computeBasePriceIdr(
          merged.periodPrice,
          merged.currency,
          currencies
        )
        const updated = await db.servicePricing.update({
          where: { id: params.id },
          data: {
            planId: merged.planId,
            regionId: merged.regionId,
            type: "BUNDLE",
            billingMode: "PACKAGE",
            billingPeriod: merged.billingPeriod,
            chargeUnit: merged.chargeUnit,
            periodPrice: new Prisma.Decimal(merged.periodPrice),
            basePriceIdr,
            currency: merged.currency,
            effectiveFrom: merged.effectiveFrom,
            effectiveTo: merged.effectiveTo,
            isActive: merged.isActive,
          },
          include: pricingInclude,
        })
        return {
          ok: true as const,
          data: toPricingDTO(updated as PricingWithRelations),
        }
      } catch (error) {
        if (error instanceof CurrencyNotFoundError)
          return validationError(set, "Currency is not configured.")
        if (isPrismaConflict(error))
          return conflict(
            set,
            "A price with this effective identity already exists."
          )
        console.error("[AdminPricingPatch] Error:", error)
        return serverError(set)
      }
    })
    .delete("/admin/pricing/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      try {
        const existing = await db.servicePricing.findUnique({
          where: { id: params.id },
          include: pricingInclude,
        })
        if (!existing) return notFound(set, "Pricing not found.")
        if (existing.isActive) {
          const [activeOfferCount, activeSubscriptionCount] = await Promise.all(
            [
              db.servicePricing.count({
                where: {
                  planId: existing.planId,
                  regionId: existing.regionId,
                  billingPeriod: existing.billingPeriod,
                  currency: existing.currency,
                  type: "BUNDLE",
                  billingMode: "PACKAGE",
                  isActive: true,
                },
              }),
              db.serviceSubscription.count({
                where: { planId: existing.planId, status: "ACTIVE" },
              }),
            ]
          )
          if (activeSubscriptionCount > 0 && activeOfferCount <= 1)
            return conflict(
              set,
              "The last active offer for an active subscription cannot be removed."
            )
        }
        const updated = await db.servicePricing.update({
          where: { id: params.id },
          data: { isActive: false },
          include: pricingInclude,
        })
        return {
          ok: true as const,
          data: toPricingDTO(updated as PricingWithRelations),
        }
      } catch (error) {
        console.error("[AdminPricingDelete] Error:", error)
        return serverError(set)
      }
    })
}

export const adminPricingRoutes = createAdminPricingRoutes()
