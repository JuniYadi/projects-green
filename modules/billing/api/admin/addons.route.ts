import { Elysia } from "elysia"
import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import { prisma as defaultPrisma } from "@/lib/prisma"
import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"

import { AddonsService } from "../../addons/addons.service"
import {
  createAddonSchema,
  updateAddonSchema,
  attachAddonToPlanSchema,
  updatePlanAddonSchema,
  type AddonPlanAttachmentDTO,
} from "../../addons/addons.dto"

// ─── Deps ────────────────────────────────────────────────────────────────────

type AddonsDb = Pick<
  PrismaClient,
  | "serviceAddon"
  | "serviceAddonPricing"
  | "servicePlanAddon"
  | "serviceSubscriptionAddon"
  | "servicePlan"
>

type AddonsRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  prisma?: AddonsDb
  addonsService?: AddonsService
}

// ─── Query schemas ──────────────────────────────────────────────────────────

const listAddonQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  billingMode: z.enum(["RECURRING", "ONE_TIME", "USAGE"]).optional(),
  isActive: z.boolean().optional(),
  currency: z.string().trim().min(3).max(3).default("IDR"),
})

const listAttachmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.boolean().optional(),
})

// ─── Error helpers ────────────────────────────────────────────────────────────

function notFound(set: RouteSet, message: string): AdminApiError {
  set.status = 404
  return { ok: false, error: "NOT_FOUND", message }
}

function conflict(set: RouteSet, message: string): AdminApiError {
  set.status = 409
  return { ok: false as const, error: "CONFLICT", message }
}

function badRequest(set: RouteSet, message: string): AdminApiError {
  set.status = 400
  return { ok: false as const, error: "BAD_REQUEST", message }
}

function serverError(set: RouteSet, message: string): AdminApiError {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR",
    message,
  }
}

// ─── Route factory ───────────────────────────────────────────────────────────

export const createAdminAddonsRoutes = (deps: AddonsRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const db = deps.prisma ?? defaultPrisma
  const addonsService = deps.addonsService ?? new AddonsService({ prisma: db })

  return (
    new Elysia({ name: "admin-addons" })
      // ─── GET /billing/admin/addons ──────────────────────────
      .get("/admin/addons", async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = listAddonQuerySchema.safeParse(query)
        if (!parsed.success) return badRequest(set, "Invalid query parameters.")

        try {
          const result = await addonsService.listAddons({
            currency: parsed.data.currency,
            page: parsed.data.page,
            limit: parsed.data.limit,
            search: parsed.data.search,
            billingMode: parsed.data.billingMode,
            isActive: parsed.data.isActive,
          })
          return { ok: true as const, ...result }
        } catch (error) {
          console.error("[AdminAddonsList] Error:", error)
          return serverError(set, "Unable to load addons.")
        }
      })

      // ─── GET /billing/admin/addons/:code ────────────────────
      .get("/admin/addons/:code", async ({ params, query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const currency = query.currency ?? "IDR"

        try {
          const result = await addonsService.getAddon({
            currency,
            code: params.code,
          })
          if (!result) return notFound(set, "Addon not found.")
          return { ok: true as const, ...result }
        } catch (error) {
          console.error("[AdminAddonDetail] Error:", error)
          return serverError(set, "Unable to load addon.")
        }
      })

      // ─── POST /billing/admin/addons ─────────────────────────
      .post("/admin/addons", async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = createAddonSchema.safeParse(body)
        if (!parsed.success) return badRequest(set, "Invalid addon input.")

        try {
          const addon = await addonsService.createAddon(
            parsed.data as unknown as Parameters<
              typeof addonsService.createAddon
            >[0]
          )
          set.status = 201
          return { ok: true as const, addon }
        } catch (error) {
          if (error instanceof Error && error.name === "AddonConflictError") {
            return conflict(set, error.message)
          }
          console.error("[AdminAddonCreate] Error:", error)
          return serverError(set, "Unable to create addon.")
        }
      })

      // ─── PATCH /billing/admin/addons/:id ────────────────────
      .patch("/admin/addons/:id", async ({ params, body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = updateAddonSchema.safeParse(body)
        if (!parsed.success) return badRequest(set, "Invalid addon input.")

        try {
          const addon = await addonsService.updateAddon(
            params.id,
            parsed.data as unknown as Parameters<
              typeof addonsService.updateAddon
            >[1]
          )
          return { ok: true as const, addon }
        } catch (error) {
          if (error instanceof Error && error.name === "AddonNotFoundError") {
            return notFound(set, error.message)
          }
          if (error instanceof Error && error.name === "AddonConflictError") {
            return conflict(set, error.message)
          }
          console.error("[AdminAddonUpdate] Error:", error)
          return serverError(set, "Unable to update addon.")
        }
      })

      // ─── DELETE /billing/admin/addons/:id ────────────────────
      .delete("/admin/addons/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          await addonsService.deactivateAddon(params.id)
          set.status = 204
          return
        } catch (error) {
          if (error instanceof Error && error.name === "AddonNotFoundError") {
            return notFound(set, error.message)
          }
          if (error instanceof Error && error.name === "AddonConflictError") {
            return conflict(set, error.message)
          }
          console.error("[AdminAddonDeactivate] Error:", error)
          return serverError(set, "Unable to deactivate addon.")
        }
      })

      // ─── GET /billing/admin/addons/:code/plans ────────────
      .get("/admin/addons/:code/plans", async ({ params, query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = listAttachmentQuerySchema.safeParse(query)
        if (!parsed.success) return badRequest(set, "Invalid query parameters.")

        try {
          const where: Prisma.ServicePlanAddonWhereInput = {
            addon: { code: params.code },
            ...(parsed.data.isActive !== undefined
              ? { isActive: parsed.data.isActive }
              : {}),
          }
          const skip = (parsed.data.page - 1) * parsed.data.limit

          const [rows, total] = await Promise.all([
            db.servicePlanAddon.findMany({
              where,
              include: {
                plan: {
                  select: {
                    id: true,
                    code: true,
                    package: { select: { code: true } },
                  },
                },
                addon: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
              orderBy: { displayOrder: "asc" },
              skip,
              take: parsed.data.limit,
            }),
            db.servicePlanAddon.count({ where }),
          ])

          return {
            ok: true as const,
            attachments: rows.map(
              (row): AddonPlanAttachmentDTO => ({
                id: row.id,
                planId: row.plan.id,
                planCode: row.plan.code,
                packageCode: row.plan.package.code,
                addonId: row.addon.id,
                addonCode: row.addon.code,
                addonName: row.addon.name,
                label: row.label,
                description: row.description,
                isRequired: row.isRequired,
                displayOrder: row.displayOrder,
                enabledTerms: row.enabledTerms as Record<
                  string,
                  unknown
                > | null,
                isActive: row.isActive,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
              })
            ),
            pagination: {
              page: parsed.data.page,
              limit: parsed.data.limit,
              total,
              totalPages: Math.ceil(total / parsed.data.limit),
            },
          }
        } catch (error) {
          console.error("[AdminAddonPlans] Error:", error)
          return serverError(set, "Unable to load plan attachments.")
        }
      })

      // ─── GET /billing/admin/plans/:planId/addons ────────────
      .get("/admin/plans/:planId/addons", async ({ params, query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = listAttachmentQuerySchema.safeParse(query)
        if (!parsed.success) return badRequest(set, "Invalid query parameters.")

        try {
          const result = await addonsService.listPlanAttachments({
            planId: params.planId,
            page: parsed.data.page,
            limit: parsed.data.limit,
            isActive: parsed.data.isActive,
          })
          return {
            ok: true as const,
            attachments: result.attachments,
            pagination: result.pagination,
          }
        } catch (error) {
          console.error("[AdminPlanAddons] Error:", error)
          return serverError(set, "Unable to load plan addons.")
        }
      })

      // ─── GET /billing/admin/plans/:planId/addons/:id ─────────
      .get("/admin/plans/:planId/addons/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const result = await addonsService.getPlanAttachment(params.id)
          if (!result) return notFound(set, "Plan addon attachment not found.")
          return { ok: true as const, ...result }
        } catch (error) {
          console.error("[AdminPlanAddonDetail] Error:", error)
          return serverError(set, "Unable to load plan addon attachment.")
        }
      })

      // ─── POST /billing/admin/plans/:planId/addons ────────────
      .post("/admin/plans/:planId/addons", async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = attachAddonToPlanSchema.safeParse(body)
        if (!parsed.success) return badRequest(set, "Invalid attachment input.")

        try {
          const attachment = await addonsService.attachAddonToPlan(
            parsed.data as unknown as Parameters<
              typeof addonsService.attachAddonToPlan
            >[0]
          )
          set.status = 201
          return { ok: true as const, attachment }
        } catch (error) {
          if (error instanceof Error && error.name === "AddonNotFoundError") {
            return notFound(set, error.message)
          }
          if (error instanceof Error && error.name === "PlanNotFoundError") {
            return notFound(set, error.message)
          }
          if (error instanceof Error && error.name === "AddonConflictError") {
            return conflict(set, error.message)
          }
          console.error("[AdminAttachAddon] Error:", error)
          return serverError(set, "Unable to attach addon to plan.")
        }
      })

      // ─── PATCH /billing/admin/plans/:planId/addons/:id ────────
      .patch(
        "/admin/plans/:planId/addons/:id",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) return actor as AdminApiError

          const parsed = updatePlanAddonSchema.safeParse(body)
          if (!parsed.success)
            return badRequest(set, "Invalid attachment input.")

          try {
            const attachment = await addonsService.updatePlanAttachment(
              params.id,
              parsed.data as unknown as Parameters<
                typeof addonsService.updatePlanAttachment
              >[1]
            )
            return { ok: true as const, attachment }
          } catch (error) {
            if (
              error instanceof Error &&
              error.name === "PlanAttachmentNotFoundError"
            ) {
              return notFound(set, error.message)
            }
            console.error("[AdminUpdatePlanAddon] Error:", error)
            return serverError(set, "Unable to update plan addon attachment.")
          }
        }
      )

      // ─── DELETE /billing/admin/plans/:planId/addons/:id ───────
      .delete("/admin/plans/:planId/addons/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          await addonsService.detachAddonFromPlan(params.id)
          set.status = 204
          return
        } catch (error) {
          if (
            error instanceof Error &&
            error.name === "PlanAttachmentNotFoundError"
          ) {
            return notFound(set, error.message)
          }
          if (error instanceof Error && error.name === "AddonConflictError") {
            return conflict(set, error.message)
          }
          console.error("[AdminDetachAddon] Error:", error)
          return serverError(set, "Unable to detach addon from plan.")
        }
      })
  )
}

export const adminAddonsRoutes = createAdminAddonsRoutes()
