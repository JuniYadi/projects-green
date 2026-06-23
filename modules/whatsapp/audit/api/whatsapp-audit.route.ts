import { Elysia } from "elysia"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  requireSuperAdmin,
  type AdminApiError,
  type AdminActorContext,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { toWhatsappAuditLogDTO, type WhatsappAuditLogDTO } from "./whatsapp-audit.dto"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

type AuditRouteSet = { status?: number | string }

function isAdminError(
  v: AdminActorContext | AdminApiError
): v is AdminApiError {
  return "ok" in v && !v.ok
}

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  return { page, limit, skip: (page - 1) * limit }
}

type AuditQuery = {
  page?: number
  limit?: number
  action?: string
  status?: string
  deviceId?: string
  q?: string
  from?: string
  to?: string
}

function buildWhere(query: Record<string, unknown>, orgScope?: string) {
  const where: Prisma.WhatsappAuditLogWhereInput = {}

  if (orgScope) {
    where.organizationId = orgScope
  }

  if (query.action) {
    where.action = String(query.action)
  }
  if (query.status) {
    where.status = String(query.status)
  }
  if (query.deviceId) {
    where.deviceId = String(query.deviceId)
  }
  if (query.q) {
    const q = String(query.q)
    // ponytail: OR across message, adminId, deviceId — naive search, upgrade to tsvector if slow
    where.OR = [
      { message: { contains: q, mode: "insensitive" } },
      { adminId: { contains: q, mode: "insensitive" } },
      { deviceId: { contains: q, mode: "insensitive" } },
    ]
  }
  if (query.from || query.to) {
    where.createdAt = {}
    if (query.from) {
      ;(where.createdAt as any).gte = new Date(String(query.from))
    }
    if (query.to) {
      ;(where.createdAt as any).lte = new Date(String(query.to))
    }
  }

  return where
}

export const createWhatsappAuditRoutes = (deps: {
  requireSuperAdmin?: (set: RouteSet) => Promise<AdminActorContext | AdminApiError>
} = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/admin/whatsapp/audit" })
    .get("/", async ({ query, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const { page, limit, skip } = getPagination(query as any)
      const where = buildWhere(query as any)

      const [total, logs] = await Promise.all([
        prisma.whatsappAuditLog.count({ where }),
        prisma.whatsappAuditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])

      return {
        ok: true,
        data: logs.map(toWhatsappAuditLogDTO),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    })
    .get("/devices/:deviceId", async ({ params: { deviceId }, query, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      // Verify device exists
      const device = await prisma.whatsappDevice.findUnique({
        where: { id: deviceId },
        select: { id: true, organizationId: true },
      })
      if (!device) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Device not found." }
      }

      const { page, limit, skip } = getPagination(query as any)
      const where = buildWhere(query as any, device.organizationId)
      where.deviceId = deviceId

      const [total, logs] = await Promise.all([
        prisma.whatsappAuditLog.count({ where }),
        prisma.whatsappAuditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])

      return {
        ok: true,
        data: logs.map(toWhatsappAuditLogDTO),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    })
}
