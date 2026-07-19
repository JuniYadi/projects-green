import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  billingAccountId: z.string().optional(),
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

type AdminAuditLogRouteDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<PlatformAccessRole>
  isAdmin: (actor: {
    platformRole: PlatformAccessRole
    orgRole: string | null | undefined
  }) => boolean
}

const defaultDeps: AdminAuditLogRouteDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  isAdmin: (actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  },
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to view audit logs.",
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
  getPlatformRole: AdminAuditLogRouteDeps["getPlatformRole"]
) {
  const platformRole = await getPlatformRole({
    id: auth.user?.id,
    email: auth.user?.email,
  })

  return {
    platformRole,
    orgRole: auth.role,
  }
}

export const createAdminAuditLogRoutes = (
  deps: Partial<AdminAuditLogRouteDeps> = {}
) => {
  const { authenticate, getPlatformRole, isAdmin } = {
    ...defaultDeps,
    ...deps,
  }

  return (
    new Elysia()
      // GET /billing/admin/billing-audit/logs — List billing audit logs
      .get(
        "/admin/billing-audit/logs",
        async ({ query, set }) => {
          const auth = await authenticate()

          if (!auth.user) {
            return toUnauthorized(set)
          }

          // Check admin access — only super_admin can view audit logs
          const actor = await resolveActor(auth, getPlatformRole)
          if (!isAdmin(actor)) {
            return toForbidden(set, "Only administrators can view audit logs.")
          }

          // Only super_admin can view audit logs
          if (actor.platformRole !== "super_admin") {
            return toForbidden(
              set,
              "Only super administrators can view audit logs."
            )
          }

          try {
            const parsedQuery = listQuerySchema.safeParse(query)
            if (!parsedQuery.success) {
              return toValidationError(set, parsedQuery.error.issues)
            }

            const { page, limit, entityType, entityId, billingAccountId } =
              parsedQuery.data

            const skip = (page - 1) * limit

            // Build where clause
            const where: Prisma.BillingAuditLogWhereInput = {}

            if (entityType) {
              where.entityType = entityType
            }

            if (entityId) {
              where.entityId = entityId
            }

            if (billingAccountId) {
              where.billingAccountId = billingAccountId
            }

            const [logs, total] = await Promise.all([
              prisma.billingAuditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
              }),
              prisma.billingAuditLog.count({ where }),
            ])

            const totalPages = Math.ceil(total / limit)

            return {
              ok: true as const,
              logs: logs.map((log) => ({
                id: log.id,
                billingAccountId: log.billingAccountId,
                billingRunId: log.billingRunId,
                entityType: log.entityType,
                entityId: log.entityId,
                action: log.action,
                actorType: log.actorType,
                actorId: log.actorId,
                contextJson: log.contextJson,
                createdAt: log.createdAt.toISOString(),
              })),
              pagination: {
                page,
                limit,
                total,
                totalPages,
              },
            }
          } catch (error) {
            console.error("[AdminAuditLog] Error:", error)
            return toServerError(set, "Unable to fetch audit logs.")
          }
        },
        {
          query: listQuerySchema,
        }
      )
  )
}

export const adminAuditLogRoutes = createAdminAuditLogRoutes()
