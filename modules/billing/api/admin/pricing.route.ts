import { Elysia } from "elysia"
import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { REGION_CODES } from "@/modules/billing/plans"

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
  currencyService?: Pick<CurrencyService, "getByCode">
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
type MatrixPeriod = (typeof periods)[number]
type MatrixInput = {
  enabledPeriods: MatrixPeriod[]
  prices: Record<string, Partial<Record<MatrixPeriod, Prisma.Decimal>>>
}

const matrixValueSchema = z.union([z.string(), z.number().finite()])
const matrixPricesSchema = z.object({
  MONTHLY: matrixValueSchema.optional(),
  QUARTERLY: matrixValueSchema.optional(),
  SEMI_ANNUAL: matrixValueSchema.optional(),
  ANNUAL: matrixValueSchema.optional(),
})
const matrixSchema = z.object({
  enabledPeriods: z
    .array(z.enum(periods))
    .min(1)
    .refine((value) => new Set(value).size === value.length),
  prices: z.record(z.string(), matrixPricesSchema),
})

class MatrixConflictError extends Error {
  constructor() {
    super("The last active offer for an active subscription cannot be removed.")
    this.name = "MatrixConflictError"
  }
}

function normalizeMatrixInput(
  input: z.infer<typeof matrixSchema>
): { ok: true; data: MatrixInput } | { ok: false; message: string } {
  const prices: MatrixInput["prices"] = {}
  for (const [rawCode, rawValues] of Object.entries(input.prices)) {
    const currency = rawCode.trim().toUpperCase()
    if (!currency) return { ok: false, message: "Currency is required." }
    if (prices[currency])
      return { ok: false, message: "Duplicate currency keys are not allowed." }
    const normalized: Partial<Record<MatrixPeriod, Prisma.Decimal>> = {}
    for (const [period, rawValue] of Object.entries(rawValues)) {
      const value =
        typeof rawValue === "number" ? String(rawValue) : rawValue.trim()
      if (!value) continue
      if (!/^\d+(?:\.\d{1,2})?$/.test(value))
        return {
          ok: false,
          message:
            "Prices must be non-negative decimals with at most two fractional digits.",
        }
      const decimal = new Prisma.Decimal(value)
      if (decimal.gt(new Prisma.Decimal("9999999999.99")))
        return {
          ok: false,
          message: "Price exceeds the maximum allowed value.",
        }
      normalized[period as MatrixPeriod] = decimal
    }
    prices[currency] = normalized
  }
  for (const period of input.enabledPeriods) {
    if (!Object.values(prices).some((values) => values[period] !== undefined))
      return { ok: false, message: `At least one ${period} price is required.` }
  }
  return { ok: true, data: { enabledPeriods: input.enabledPeriods, prices } }
}

function matrixKey(currency: string, period: MatrixPeriod) {
  return `${currency}:${period}`
}

function isCurrent(row: PricingWithRelations, now: Date) {
  return row.effectiveFrom <= now && (!row.effectiveTo || row.effectiveTo > now)
}

function selectMatrixRows(rows: PricingWithRelations[], now: Date) {
  const groups = new Map<string, PricingWithRelations[]>()
  for (const row of rows) {
    if (
      !row.billingPeriod ||
      (row.effectiveFrom < now && row.effectiveTo && row.effectiveTo <= now)
    )
      continue
    const key = matrixKey(row.currency, row.billingPeriod as MatrixPeriod)
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  return [...groups.values()].flatMap((group) => {
    const eligible = group.filter(
      (row) => isCurrent(row, now) || row.effectiveFrom > now
    )
    if (!eligible.length) return []
    eligible.sort((left, right) => {
      const rank = (row: PricingWithRelations) =>
        isCurrent(row, now)
          ? row.region.code === REGION_CODES.GLOBAL
            ? 0
            : 1
          : 2
      const rankDiff = rank(left) - rank(right)
      if (rankDiff) return rankDiff
      const effectiveDiff =
        right.effectiveFrom.getTime() - left.effectiveFrom.getTime()
      return (
        effectiveDiff || right.createdAt.getTime() - left.createdAt.getTime()
      )
    })
    return [eligible[0]]
  })
}

function matrixData(
  plan: { id: string; code: string; name: string },
  rows: PricingWithRelations[],
  now: Date,
  hasLegacyRegionalPricing: boolean
) {
  return {
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    packageCode: "VPN" as const,
    pricing: selectMatrixRows(rows, now).map((row) => toPricingDTO(row)),
    hasLegacyRegionalPricing,
  }
}

export const createAdminPricingRoutes = (deps: AdminPricingRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const db = deps.prisma ?? defaultPrisma
  const currencies = deps.currencyService ?? new CurrencyService(db as never)
  return new Elysia()
    .get("/admin/pricing/matrix/:planId", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      try {
        const [plan, globalRegion] = await Promise.all([
          db.servicePlan.findUnique({
            where: { id: params.planId },
            select: {
              id: true,
              code: true,
              name: true,
              package: { select: { code: true } },
            },
          }),
          db.serviceRegion.findUnique({
            where: { code: REGION_CODES.GLOBAL },
            select: { id: true, code: true },
          }),
        ])
        if (!plan || plan.package.code !== "VPN" || !globalRegion)
          return validationError(set, "VPN plan or GLOBAL region not found.")
        const rows = await db.servicePricing.findMany({
          where: {
            planId: plan.id,
            type: "BUNDLE",
            billingMode: "PACKAGE",
            isActive: true,
          },
          include: pricingInclude,
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        })
        const now = new Date()
        const typedRows = rows as PricingWithRelations[]
        return {
          ok: true as const,
          data: matrixData(
            plan,
            typedRows,
            now,
            typedRows.some((row) => row.region.code !== REGION_CODES.GLOBAL)
          ),
        }
      } catch (error) {
        console.error("[AdminPricingMatrixGet] Error:", error)
        return serverError(set)
      }
    })
    .put(
      "/admin/pricing/matrix/:planId",
      async ({ params, body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError
        const parsed = matrixSchema.safeParse(body)
        if (!parsed.success) return validationError(set)
        const normalized = normalizeMatrixInput(parsed.data)
        if (!normalized.ok) return validationError(set, normalized.message)
        try {
          const [plan, globalRegion] = await Promise.all([
            db.servicePlan.findUnique({
              where: { id: params.planId },
              select: {
                id: true,
                code: true,
                name: true,
                package: { select: { code: true } },
              },
            }),
            db.serviceRegion.findUnique({
              where: { code: REGION_CODES.GLOBAL },
              select: { id: true, code: true },
            }),
          ])
          if (!plan || plan.package.code !== "VPN" || !globalRegion)
            return validationError(set, "VPN plan or GLOBAL region not found.")
          try {
            const currencyRows = await Promise.all(
              Object.keys(normalized.data.prices).map((code) =>
                currencies.getByCode(code)
              )
            )
            if (currencyRows.some((currency) => !currency.isActive))
              return validationError(set, "Currency is inactive.")
          } catch (error) {
            if (error instanceof CurrencyNotFoundError)
              return validationError(set, "Currency is not configured.")
            throw error
          }
          const effectiveFrom = new Date()
          const data = await db.$transaction(async (tx) => {
            const [activeRows, activeSubscriptionCount] = await Promise.all([
              tx.servicePricing.findMany({
                where: {
                  planId: plan.id,
                  type: "BUNDLE",
                  billingMode: "PACKAGE",
                  isActive: true,
                },
                include: pricingInclude,
              }),
              tx.serviceSubscription.count({
                where: { planId: plan.id, status: "ACTIVE" },
              }),
            ])
            const rows = activeRows as PricingWithRelations[]
            const grouped = new Map<string, PricingWithRelations[]>()
            for (const row of rows) {
              if (!row.billingPeriod) continue
              const key = matrixKey(
                row.currency,
                row.billingPeriod as MatrixPeriod
              )
              grouped.set(key, [...(grouped.get(key) ?? []), row])
            }
            const desired = new Map<
              string,
              { currency: string; period: MatrixPeriod; value: Prisma.Decimal }
            >()
            for (const period of normalized.data.enabledPeriods) {
              for (const [currency, values] of Object.entries(
                normalized.data.prices
              )) {
                const value = values[period]
                if (value)
                  desired.set(matrixKey(currency, period), {
                    currency,
                    period,
                    value,
                  })
              }
            }
            for (const [key] of grouped) {
              if (!desired.has(key) && activeSubscriptionCount > 0)
                throw new MatrixConflictError()
            }
            const deactivate = async (items: PricingWithRelations[]) => {
              if (items.length)
                await tx.servicePricing.updateMany({
                  where: { id: { in: items.map((item) => item.id) } },
                  data: { isActive: false },
                })
            }
            for (const [key, offer] of desired) {
              const existing = grouped.get(key) ?? []
              const chosen =
                existing
                  .filter((row) => row.region.code === REGION_CODES.GLOBAL)
                  .sort(
                    (left, right) =>
                      right.effectiveFrom.getTime() -
                      left.effectiveFrom.getTime()
                  )[0] ??
                [...existing].sort(
                  (left, right) =>
                    right.effectiveFrom.getTime() - left.effectiveFrom.getTime()
                )[0]
              const charged = chosen
                ? await tx.billingOrderLine.findFirst({
                    where: {
                      pricingId: chosen.id,
                      order: { status: { in: ["CHARGED", "FULFILLED"] } },
                    },
                    select: { id: true },
                  })
                : null
              const canUpdate =
                chosen &&
                !charged &&
                chosen.region.code === REGION_CODES.GLOBAL &&
                chosen.periodPrice?.toString() === offer.value.toString()
              if (canUpdate) {
                await tx.servicePricing.update({
                  where: { id: chosen.id },
                  data: {
                    regionId: globalRegion.id,
                    billingPeriod: offer.period,
                    chargeUnit: "SUBSCRIPTION",
                    periodPrice: offer.value,
                    basePriceIdr: offer.value,
                    effectiveFrom,
                    effectiveTo: null,
                    isActive: true,
                  },
                })
                await deactivate(existing.filter((row) => row.id !== chosen.id))
              } else {
                await deactivate(existing)
                await tx.servicePricing.create({
                  data: {
                    planId: plan.id,
                    regionId: globalRegion.id,
                    type: "BUNDLE",
                    billingMode: "PACKAGE",
                    billingPeriod: offer.period,
                    chargeUnit: "SUBSCRIPTION",
                    periodPrice: offer.value,
                    basePriceIdr: offer.value,
                    currency: offer.currency,
                    effectiveFrom,
                    effectiveTo: null,
                    isActive: true,
                  },
                  include: pricingInclude,
                })
              }
            }
            for (const [key, existing] of grouped) {
              if (!desired.has(key)) await deactivate(existing)
            }
            const refreshed = await tx.servicePricing.findMany({
              where: {
                planId: plan.id,
                type: "BUNDLE",
                billingMode: "PACKAGE",
                isActive: true,
              },
              include: pricingInclude,
            })
            return matrixData(
              plan,
              refreshed as PricingWithRelations[],
              effectiveFrom,
              false
            )
          })
          return { ok: true as const, data }
        } catch (error) {
          if (error instanceof MatrixConflictError)
            return conflict(set, error.message)
          if (error instanceof CurrencyNotFoundError)
            return validationError(set, "Currency is not configured.")
          if (isPrismaConflict(error))
            return conflict(
              set,
              "A price with this effective identity already exists."
            )
          console.error("[AdminPricingMatrixPut] Error:", error)
          return serverError(set)
        }
      },
      { body: z.record(z.string(), z.unknown()) }
    )
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
          const created = await db.servicePricing.create({
            data: {
              planId: input.planId,
              regionId: input.regionId,
              type: "BUNDLE",
              billingMode: "PACKAGE",
              billingPeriod: input.billingPeriod,
              chargeUnit: input.chargeUnit,
              periodPrice: new Prisma.Decimal(input.periodPrice),
              basePriceIdr: new Prisma.Decimal(input.periodPrice),
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
                basePriceIdr: new Prisma.Decimal(merged.periodPrice),
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
            basePriceIdr: new Prisma.Decimal(merged.periodPrice),
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
