import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"

const listQuerySchema = z.object({
  type: z.enum(["CREDIT", "DEBIT", "WRITEOFF"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

type BillingAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = {
  status?: number | string
}

type AdminAdjustmentsRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: { id?: string | null; email?: string | null }) => Promise<PlatformAccessRole>
  isAdmin: (actor: { platformRole: PlatformAccessRole; tenantRole: string | null | undefined }) => boolean
}

const defaultDeps: AdminAdjustmentsRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.tenantRole === "admin" || actor.tenantRole === "owner"
  },
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view adjustments.",
  }
}

const toForbidden = (set: RouteSet, message: string) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    message,
  }
}

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

const toValidationError = (set: RouteSet, issues: z.ZodIssue[]) => {
  set.status = 422
  return {
    ok: false as const,
    error: "VALIDATION_ERROR" as const,
    message: "Please fix the highlighted fields and try again.",
    fieldErrors: fieldErrorMapFromIssues(issues),
  }
}

async function resolveActor(
  auth: BillingAuthContext,
  getPlatformRole: AdminAdjustmentsRouteDeps["getPlatformRole"]
) {
  const platformRole = await getPlatformRole({
    id: auth.user?.id,
    email: auth.user?.email,
  })

  return {
    platformRole,
    tenantRole: auth.role,
  }
}

export const createAdminAdjustmentsRoutes = (
  deps: Partial<AdminAdjustmentsRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return new Elysia()
    // GET /billing/admin/adjustments — List all billing adjustments
    .get(
      "/admin/adjustments",
      async ({ query, set }) => {
        const auth = await authenticate()

        if (!auth.user) {
          return toUnauthorized(set)
        }

        // Check admin access
        const actor = await resolveActor(auth, getPlatformRole)
        if (!isAdmin(actor)) {
          return toForbidden(
            set,
            "Only administrators can view adjustments."
          )
        }

        try {
          const parsedQuery = listQuerySchema.safeParse(query)
          if (!parsedQuery.success) {
            return toValidationError(set, parsedQuery.error.issues)
          }

          const { type, startDate, endDate, page, limit } = parsedQuery.data

          const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1)
          const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10) || 20))
          const skip = (pageNum - 1) * limitNum

          // Build where clause
          const where: Prisma.BillingAdjustmentWhereInput = {}

          if (type) {
            where.adjustmentType = type
          }

          if (startDate || endDate) {
            where.createdAt = {}
            if (startDate) {
              where.createdAt.gte = new Date(startDate)
            }
            if (endDate) {
              const endDateTime = new Date(endDate)
              endDateTime.setHours(23, 59, 59, 999)
              where.createdAt.lte = endDateTime
            }
          }

          const [adjustments, total] = await Promise.all([
            prisma.billingAdjustment.findMany({
              where,
              orderBy: { createdAt: "desc" },
              skip,
              take: limitNum,
              include: {
                billingAccount: {
                  select: {
                    organizationId: true,
                  },
                },
              },
            }),
            prisma.billingAdjustment.count({ where }),
          ])

          const totalPages = Math.ceil(total / limitNum)

          return {
            ok: true as const,
            adjustments: adjustments.map((adj) => ({
              id: adj.id,
              billingAccountId: adj.billingAccountId,
              organizationId: adj.billingAccount.organizationId,
              type: adj.adjustmentType,
              amount: adj.amount.toFixed(2),
              currency: adj.currency,
              reason: adj.reason,
              createdByWorkosUserId: adj.createdByWorkosUserId,
              createdAt: adj.createdAt.toISOString(),
            })),
            pagination: {
              page: pageNum,
              limit: limitNum,
              total,
              totalPages,
            },
          }
        } catch (error) {
          console.error("[AdminAdjustments] Error:", error)
          return toServerError(set, "Unable to fetch adjustments.")
        }
      },
      {
        query: listQuerySchema,
      }
    )
}

export const adminAdjustmentsRoutes = createAdminAdjustmentsRoutes()
