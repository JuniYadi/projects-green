import { Elysia } from "elysia"
import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

import {
  requireSuperAdmin,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { prisma as defaultPrisma } from "@/lib/prisma"

// ─── Types & Schemas ────────────────────────────────────────────────────────

type RegionsDb = Pick<
  PrismaClient,
  "serviceRegion" | "appHostingCluster" | "servicePricing"
>

type AdminRegionsRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  prisma?: RegionsDb
}

export const createRegionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(50, "Code cannot exceed 50 characters.")
    .transform((val) => val.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name cannot exceed 100 characters."),
  country: z
    .string()
    .trim()
    .min(2, "Country must be a 2-letter ISO code.")
    .max(2, "Country must be a 2-letter ISO code.")
    .transform((val) => val.toUpperCase()),
  flag: z.string().trim().max(10).nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

export const updateRegionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(50, "Code cannot exceed 50 characters.")
    .transform((val) => val.toUpperCase())
    .optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name cannot exceed 100 characters.")
    .optional(),
  country: z
    .string()
    .trim()
    .min(2, "Country must be a 2-letter ISO code.")
    .max(2, "Country must be a 2-letter ISO code.")
    .transform((val) => val.toUpperCase())
    .optional(),
  flag: z.string().trim().max(10).nullable().optional(),
  isActive: z.boolean().optional(),
})

// ─── Error Helpers ──────────────────────────────────────────────────────────

function badRequest(
  set: RouteSet,
  message: string,
  fieldErrors?: Record<string, string[]>
): AdminApiError {
  set.status = 400
  return {
    ok: false,
    error: "BAD_REQUEST",
    message,
    fieldErrors,
  }
}

function notFound(set: RouteSet, message: string): AdminApiError {
  set.status = 404
  return {
    ok: false,
    error: "NOT_FOUND",
    message,
  }
}

function conflict(set: RouteSet, message: string): AdminApiError {
  set.status = 409
  return {
    ok: false,
    error: "CONFLICT",
    message,
  }
}

function serverError(
  set: RouteSet,
  message = "Internal Server Error"
): AdminApiError {
  set.status = 500
  return {
    ok: false,
    error: "SERVER_ERROR",
    message,
  }
}

function isPrismaConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

// ─── Route Factory ──────────────────────────────────────────────────────────

export const createAdminRegionsRoutes = (deps: AdminRegionsRouteDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const db = (deps.prisma ?? defaultPrisma) as RegionsDb

  return (
    new Elysia({ name: "admin-regions" })
      // ─── GET /admin/regions ───────────────────────────────────────────
      .get("/admin/regions", async ({ set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const regions = await db.serviceRegion.findMany({
            orderBy: { name: "asc" },
            include: {
              _count: {
                select: {
                  appHostingClusters: true,
                  pricings: true,
                },
              },
            },
          })

          return { ok: true as const, data: regions }
        } catch (error) {
          console.error("[AdminRegionsList] Error:", error)
          return serverError(set, "Unable to load regions.")
        }
      })

      // ─── POST /admin/regions ──────────────────────────────────────────
      .post("/admin/regions", async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = createRegionSchema.safeParse(body)
        if (!parsed.success) {
          return badRequest(
            set,
            "Invalid region input.",
            parsed.error.flatten().fieldErrors
          )
        }

        try {
          const existing = await db.serviceRegion.findUnique({
            where: { code: parsed.data.code },
          })
          if (existing) {
            return conflict(
              set,
              `A region with code '${parsed.data.code}' already exists.`
            )
          }

          const region = await db.serviceRegion.create({
            data: {
              code: parsed.data.code,
              name: parsed.data.name,
              country: parsed.data.country,
              flag: parsed.data.flag ?? null,
              isActive: parsed.data.isActive ?? true,
            },
            include: {
              _count: {
                select: {
                  appHostingClusters: true,
                  pricings: true,
                },
              },
            },
          })

          set.status = 201
          return { ok: true as const, data: region }
        } catch (error) {
          if (isPrismaConflict(error)) {
            return conflict(
              set,
              `A region with code '${parsed.data.code}' already exists.`
            )
          }
          console.error("[AdminRegionsCreate] Error:", error)
          return serverError(set, "Unable to create region.")
        }
      })

      // ─── PATCH /admin/regions/:id ─────────────────────────────────────
      .patch("/admin/regions/:id", async ({ params, body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const parsed = updateRegionSchema.safeParse(body)
        if (!parsed.success) {
          return badRequest(
            set,
            "Invalid region update input.",
            parsed.error.flatten().fieldErrors
          )
        }

        try {
          const existing = await db.serviceRegion.findUnique({
            where: { id: params.id },
          })
          if (!existing) return notFound(set, "Region not found.")

          if (parsed.data.code && parsed.data.code !== existing.code) {
            const duplicate = await db.serviceRegion.findUnique({
              where: { code: parsed.data.code },
            })
            if (duplicate && duplicate.id !== params.id) {
              return conflict(
                set,
                `A region with code '${parsed.data.code}' already exists.`
              )
            }
          }

          const updated = await db.serviceRegion.update({
            where: { id: params.id },
            data: {
              ...(parsed.data.code !== undefined && { code: parsed.data.code }),
              ...(parsed.data.name !== undefined && { name: parsed.data.name }),
              ...(parsed.data.country !== undefined && {
                country: parsed.data.country,
              }),
              ...(parsed.data.flag !== undefined && { flag: parsed.data.flag }),
              ...(parsed.data.isActive !== undefined && {
                isActive: parsed.data.isActive,
              }),
            },
            include: {
              _count: {
                select: {
                  appHostingClusters: true,
                  pricings: true,
                },
              },
            },
          })

          return { ok: true as const, data: updated }
        } catch (error) {
          if (isPrismaConflict(error)) {
            return conflict(
              set,
              `A region with code '${parsed.data.code}' already exists.`
            )
          }
          console.error("[AdminRegionsUpdate] Error:", error)
          return serverError(set, "Unable to update region.")
        }
      })

      // ─── DELETE /admin/regions/:id ────────────────────────────────────
      .delete("/admin/regions/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const existing = await db.serviceRegion.findUnique({
            where: { id: params.id },
            include: {
              _count: {
                select: {
                  appHostingClusters: true,
                  pricings: true,
                },
              },
            },
          })
          if (!existing) return notFound(set, "Region not found.")

          // Check if linked to appHostingClusters or active pricings
          const [clusterCount, activePricingCount] = await Promise.all([
            db.appHostingCluster.count({
              where: { regionId: params.id },
            }),
            db.servicePricing.count({
              where: { regionId: params.id, isActive: true },
            }),
          ])

          if (clusterCount > 0 || activePricingCount > 0) {
            const reasons: string[] = []
            if (clusterCount > 0) {
              reasons.push(`${clusterCount} app hosting cluster(s)`)
            }
            if (activePricingCount > 0) {
              reasons.push(`${activePricingCount} active pricing plan(s)`)
            }
            return conflict(
              set,
              `Cannot delete region because it is referenced by ${reasons.join(" and ")}.`
            )
          }

          const deleted = await db.serviceRegion.delete({
            where: { id: params.id },
          })

          return { ok: true as const, data: deleted }
        } catch (error) {
          console.error("[AdminRegionsDelete] Error:", error)
          return serverError(set, "Unable to delete region.")
        }
      })
  )
}

export const adminRegionsRoutes = createAdminRegionsRoutes()
