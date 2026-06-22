import { Elysia, t } from "elysia"

import { prisma } from "@/lib/prisma"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"

const AUDIT_ACTIONS = [
  "PROVISIONING_STARTED",
  "PROVISIONING_SUCCESS",
  "PROVISIONING_FAILED",
  "PROVISIONING_RETRIED",
] as const

export const createAdminVpnAuditRoutes = (deps: {
  requireSuperAdmin?: typeof requireSuperAdmin
} = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/admin/vpn/audit" })
    .get(
      "/accounts/:saId",
      async ({ params, query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const page = Math.max(1, Number(query.page) || 1)
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
        const skip = (page - 1) * limit

        const actionFilter: Record<string, unknown> | undefined =
          query.type === "steps"
            ? { action: "PROVISIONING_STEP" }
            : query.type === "all"
              ? undefined
              : { action: { in: AUDIT_ACTIONS } }

        const where: Record<string, unknown> = {
          details: { path: ["serverAccountId"], equals: params.saId },
          ...actionFilter,
        }

        const [entries, total] = await Promise.all([
          prisma.vpnAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.vpnAuditLog.count({ where }),
        ])

        return {
          ok: true,
          data: entries,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.Numeric({ minimum: 1 })),
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
          type: t.Optional(t.Union([t.Literal("steps"), t.Literal("audit"), t.Literal("all")])),
        }),
      }
    )
}
