import { getCachedUser } from "@/lib/workos-directory"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { Elysia } from "elysia"
import { prisma } from "@/lib/prisma"
import { Prisma, type WhatsappAuditLog } from "@prisma/client"
import {
  requireSuperAdmin,
  type AdminApiError,
  type AdminActorContext,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import {
  toWhatsappAuditLogDTO,
  type WhatsappAuditLogDTO,
} from "./whatsapp-audit.dto"

const DEFAULT_LIMIT = 20
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

type EnrichedAuditLog = WhatsappAuditLog & {
  deviceLabel: string | null
  actorName: string | null
  actorEmail: string | null
  isPlatformAdmin: boolean
}

async function enrichAuditLogs(
  rawLogs: WhatsappAuditLog[],
  opts: { isConsole: boolean }
): Promise<EnrichedAuditLog[]> {
  if (rawLogs.length === 0) return []

  const deviceIds = [
    ...new Set(
      rawLogs.map((l) => l.deviceId).filter((id): id is string => Boolean(id))
    ),
  ]
  const adminIds = [
    ...new Set(
      rawLogs
        .map((l) => l.adminId)
        .filter((id): id is string => Boolean(id && id.startsWith("user_")))
    ),
  ]

  const [devices, userEntries] = await Promise.all([
    deviceIds.length > 0
      ? prisma.whatsappDevice.findMany({
          where: { id: { in: deviceIds } },
          select: { id: true, phoneNumber: true },
        })
      : [],
    Promise.all(
      adminIds.map(async (id) => {
        const u = await getCachedUser(id)
        return [id, u] as const
      })
    ),
  ])

  const deviceMap = new Map(devices.map((d) => [d.id, d.phoneNumber]))
  const userMap = new Map(
    userEntries.filter(([, u]) => Boolean(u)).map(([id, u]) => [id, u!])
  )

  const emails = Array.from(userMap.values())
    .map((u) => u.email?.toLowerCase())
    .filter((e): e is string => Boolean(e))

  let platformRoles: Array<{ workosUserId: string; email: string | null }> = []
  if (adminIds.length > 0 || emails.length > 0) {
    platformRoles = await prisma.authPlatformUserRole.findMany({
      where: {
        role: "SUPER_ADMIN",
        OR: [
          ...(adminIds.length > 0 ? [{ workosUserId: { in: adminIds } }] : []),
          ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
        ],
      },
      select: { workosUserId: true, email: true },
    })
  }

  const platformAdminWorkosIds = new Set(
    platformRoles.map((p) => p.workosUserId)
  )
  const platformAdminEmails = new Set(
    platformRoles
      .map((p) => p.email?.toLowerCase())
      .filter((e): e is string => Boolean(e))
  )

  const isPlatformUser = (
    adminId: string | null,
    userEmail?: string | null
  ) => {
    if (adminId && platformAdminWorkosIds.has(adminId)) return true
    if (userEmail && platformAdminEmails.has(userEmail.toLowerCase()))
      return true
    return false
  }

  return rawLogs.map((log) => {
    const user = log.adminId ? userMap.get(log.adminId) : null
    const isPlatform = isPlatformUser(log.adminId, user?.email)

    let actorName: string | null
    let actorEmail: string | null

    if (opts.isConsole && isPlatform) {
      // In console workspace: mask platform admin details to prevent privacy leaks
      actorName = "Platform Support"
      actorEmail = null
    } else {
      actorName =
        user?.name ??
        user?.email ??
        (log.adminId ? log.adminId.slice(0, 10) : null)
      actorEmail = user?.email ?? null
    }

    return {
      ...log,
      deviceLabel: log.deviceId
        ? (deviceMap.get(log.deviceId) ?? log.deviceId)
        : null,
      actorName,
      actorEmail,
      isPlatformAdmin: isPlatform,
    }
  })
}

export const createWhatsappAuditRoutes = (
  deps: {
    requireSuperAdmin?: (
      set: RouteSet
    ) => Promise<AdminActorContext | AdminApiError>
  } = {}
) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/admin/whatsapp/audit" })
    .get("/", async ({ query, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const { page, limit, skip } = getPagination(query as any)
      const where = buildWhere(query as any)

      const [total, rawLogs] = await Promise.all([
        prisma.whatsappAuditLog.count({ where }),
        prisma.whatsappAuditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])

      const logs = await enrichAuditLogs(rawLogs, { isConsole: false })

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
    .get(
      "/devices/:deviceId",
      async ({ params: { deviceId }, query, set }: any) => {
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

        const [total, rawLogs] = await Promise.all([
          prisma.whatsappAuditLog.count({ where }),
          prisma.whatsappAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
        ])

        const logs = await enrichAuditLogs(rawLogs, { isConsole: false })

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
      }
    )
}
export const consoleWhatsappAuditRoutes = new Elysia({ prefix: "/audit" })
  .get("/", async ({ request, query, set }: any) => {
    const auth = await resolveAuthContext(request)
    if (!auth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    if (!auth.organizationId) {
      set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Organization required.",
      }
    }

    const { page, limit, skip } = getPagination(query)
    const where = buildWhere(query, auth.organizationId)

    const [total, rawLogs] = await Promise.all([
      prisma.whatsappAuditLog.count({ where }),
      prisma.whatsappAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ])

    const logs = await enrichAuditLogs(rawLogs, { isConsole: true })

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
  .get(
    "/devices/:deviceId",
    async ({ request, params: { deviceId }, query, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required.",
        }
      }

      const device = await prisma.whatsappDevice.findUnique({
        where: { id: deviceId },
        select: { id: true, organizationId: true },
      })
      if (!device) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Device not found." }
      }
      if (device.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const { page, limit, skip } = getPagination(query)
      const where = buildWhere(query, auth.organizationId)
      where.deviceId = deviceId

      const [total, rawLogs] = await Promise.all([
        prisma.whatsappAuditLog.count({ where }),
        prisma.whatsappAuditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])

      const logs = await enrichAuditLogs(rawLogs, { isConsole: true })

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
    }
  )
