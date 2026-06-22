import { Elysia, t } from "elysia"

import { prisma } from "@/lib/prisma"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  toAuditLogDTO,
  toAuditLogListDTO,
  type VpnAuditLogListDTO,
} from "./admin-vpn-audit.dto"

const AUDIT_ACTIONS = [
  "PROVISIONING_STARTED",
  "PROVISIONING_SUCCESS",
  "PROVISIONING_FAILED",
  "PROVISIONING_RETRIED",
] as const

/**
 * Known top-level `action` values. Used to validate the `action` query filter
 * without rejecting future actions (we accept any string to stay forward-
 * compatible with new provisioning events).
 */
const ACTION_FILTER_VALUES = [
  "REGISTERED",
  "REVOKED",
  "CONFIG_DOWNLOADED",
  "PROVISIONING_STARTED",
  "PROVISIONING_SUCCESS",
  "PROVISIONING_FAILED",
  "PROVISIONING_RETRIED",
  "PROVISIONING_STEP",
] as const

const STATUS_FILTER_VALUES = ["OK", "FAILED"] as const

export const createAdminVpnAuditRoutes = (deps: {
  requireSuperAdmin?: typeof requireSuperAdmin
} = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/admin/vpn/audit" })
    .get(
      "/",
      async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const page = Math.max(1, Number(query.page) || 1)
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
        const skip = (page - 1) * limit

        const where: Record<string, unknown> = {}

        if (query.action) {
          where.action = query.action
        }

        if (query.status) {
          // `status` is stored both at the top-level column (for PROVISIONING_STEP)
          // and inside `details` for some legacy entries — cover both.
          where.OR = [
            { status: query.status },
            {
              details: {
                path: ["status"],
                equals: query.status,
              },
            },
          ]
        }

        if (query.q) {
          // Free-text search across the ID-like linkage columns. Prisma's
          // `mode: "insensitive"` is a Postgres-only feature; the app ships
          // with Postgres so it's safe to use here. We also search inside the
          // `details` JSON for legacy rows that only store `serverAccountId`
          // inside the payload (see provisioning-audit-modal fallback).
          // Merge with any OR clauses already added by the `status` filter
          // so we don't clobber them.
          const qClauses = [
            { serverAccountId: { contains: query.q, mode: "insensitive" } },
            { deviceId: { contains: query.q, mode: "insensitive" } },
            { userId: { contains: query.q, mode: "insensitive" } },
            { adminId: { contains: query.q, mode: "insensitive" } },
            {
              details: {
                path: ["serverAccountId"],
                string_contains: query.q,
              },
            },
          ]
          where.OR = [...((where.OR as unknown[] | undefined) ?? []), ...qClauses]
        }

        if (query.from || query.to) {
          const createdAt: Record<string, Date> = {}
          if (query.from) createdAt.gte = new Date(query.from)
          if (query.to) createdAt.lte = new Date(query.to)
          where.createdAt = createdAt
        }

        const [rows, total] = await Promise.all([
          prisma.vpnAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.vpnAuditLog.count({ where }),
        ])

        const data: VpnAuditLogListDTO[] = rows.map(toAuditLogListDTO)

        return {
          ok: true,
          data,
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
          action: t.Optional(
            t.Union(ACTION_FILTER_VALUES.map((v) => t.Literal(v)))
          ),
          status: t.Optional(
            t.Union(STATUS_FILTER_VALUES.map((v) => t.Literal(v)))
          ),
          q: t.Optional(t.String({ maxLength: 128 })),
          from: t.Optional(t.String({ maxLength: 32 })),
          to: t.Optional(t.String({ maxLength: 32 })),
        }),
      }
    )
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
          data: entries.map(toAuditLogDTO),
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
