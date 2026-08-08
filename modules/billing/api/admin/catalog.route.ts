import { Elysia } from "elysia"
import { z } from "zod"
import type { PrismaClient } from "@prisma/client"

import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { prisma as defaultPrisma } from "@/lib/prisma"
import {
  AdminCatalogService,
  ProductNotFoundError,
  ProductPublishValidationError,
} from "../../catalog/admin-catalog.service"
import type { AdminCatalogProductInput } from "../../catalog/admin-catalog.dto"

const periods = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "YEARLY",
  "CUSTOM",
] as const
const priceSchema = z.object({
  billingPeriod: z.enum(periods),
  currency: z.enum(["IDR", "USD"]),
  amount: z.string().trim().min(1),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  isActive: z.boolean(),
})
const planSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  resources: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
  prices: z.array(priceSchema),
})
const productSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  plans: z.array(planSchema),
})

type AdminCatalogRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  prisma?: Pick<
    PrismaClient,
    | "servicePackage"
    | "servicePlan"
    | "servicePricing"
    | "serviceRegion"
    | "$transaction"
  >
  catalogService?: AdminCatalogService
}

const badRequest = (set: RouteSet, message: string): AdminApiError => {
  set.status = 400
  return { ok: false, error: "BAD_REQUEST", message }
}
const notFound = (set: RouteSet, message: string): AdminApiError => {
  set.status = 404
  return { ok: false, error: "NOT_FOUND", message }
}
const validation = (set: RouteSet, message: string): AdminApiError => {
  set.status = 422
  return { ok: false, error: "VALIDATION_ERROR", message }
}
const serverError = (set: RouteSet): AdminApiError => {
  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_SERVER_ERROR",
    message: "Unable to manage catalog.",
  }
}

export const createAdminCatalogRoutes = (deps: AdminCatalogRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const catalogService =
    deps.catalogService ?? new AdminCatalogService(deps.prisma ?? defaultPrisma)

  return new Elysia({ name: "admin-catalog" })
    .get("/admin/catalog", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      try {
        return {
          ok: true as const,
          products: await catalogService.listProducts(),
        }
      } catch (error) {
        console.error("[AdminCatalogList] Error:", error)
        return serverError(set)
      }
    })
    .get("/admin/catalog/:code", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      try {
        const product = await catalogService.getProduct(params.code)
        return product
          ? { ok: true as const, product }
          : notFound(set, "Product not found.")
      } catch (error) {
        console.error("[AdminCatalogDetail] Error:", error)
        return serverError(set)
      }
    })
    .post("/admin/catalog", async ({ body, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const parsed = productSchema.safeParse(body)
      if (!parsed.success)
        return badRequest(set, "Invalid catalog product input.")
      try {
        return {
          ok: true as const,
          product: await catalogService.saveDraft(
            parsed.data as AdminCatalogProductInput
          ),
        }
      } catch (error) {
        if (error instanceof ProductNotFoundError)
          return notFound(set, error.message)
        if (error instanceof Error && error.message.includes("GLOBAL"))
          return validation(set, error.message)
        if (error instanceof Error && error.message.includes("positive"))
          return validation(set, error.message)
        console.error("[AdminCatalogDraft] Error:", error)
        return serverError(set)
      }
    })
    .patch("/admin/catalog/:code", async ({ params, body, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const parsed = productSchema.omit({ code: true }).safeParse(body)
      if (!parsed.success)
        return badRequest(set, "Invalid catalog product input.")
      try {
        return {
          ok: true as const,
          product: await catalogService.saveDraft({
            ...parsed.data,
            code: params.code,
          } as AdminCatalogProductInput),
        }
      } catch (error) {
        if (error instanceof ProductNotFoundError)
          return notFound(set, error.message)
        if (
          error instanceof Error &&
          (error.message.includes("GLOBAL") ||
            error.message.includes("positive"))
        )
          return validation(set, error.message)
        console.error("[AdminCatalogDraftPatch] Error:", error)
        return serverError(set)
      }
    })
    .post("/admin/catalog/:code/publish", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      try {
        return {
          ok: true as const,
          product: await catalogService.publish(params.code),
        }
      } catch (error) {
        if (
          error instanceof ProductNotFoundError ||
          (error instanceof Error && error.name === "ProductNotFoundError")
        )
          return notFound(set, error.message)
        if (
          error instanceof ProductPublishValidationError ||
          (error instanceof Error &&
            error.name === "ProductPublishValidationError")
        )
          return validation(set, error.message)
        return serverError(set)
      }
    })
}

export const adminCatalogRoutes = createAdminCatalogRoutes()
