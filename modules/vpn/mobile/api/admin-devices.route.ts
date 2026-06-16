/**
 * Admin device management routes (T6.1-T6.3).
 *
 * GET    /api/vpn/mobile/admin/devices — List all devices with filters + pagination.
 * DELETE /api/vpn/mobile/admin/devices/:deviceId — Force-revoke a device.
 * GET    /api/vpn/mobile/admin/devices/export — CSV export of device data.
 */

import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { getClientIp } from "@/lib/rate-limit"
import { logAuditEvent } from "@/lib/audit.service"

import {
  VpnMobileDeviceService,
  vpnMobileDeviceService,
} from "@/modules/vpn/mobile/vpn-mobile-device.service"

type AuthContext = {
  organizationId?: string | null
  user: { id: string } | null
  role?: string | null
  roles?: string[] | null
}

type RouteSet = { status?: number | string }

type Deps = {
  authenticate?: () => Promise<AuthContext>
  deviceService?: VpnMobileDeviceService
}

const unauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    error: {
      code: "TOKEN_INVALID" as const,
      message: "Authentication required.",
      details: {},
    },
  }
}

const forbidden = (set: RouteSet, message: string) => {
  set.status = 403
  return {
    error: {
      code: "FORBIDDEN" as const,
      message,
      details: {},
    },
  }
}

const notFound = (set: RouteSet) => {
  set.status = 404
  return {
    error: {
      code: "NOT_FOUND" as const,
      message: "Device not found.",
      details: {},
    },
  }
}

const isSuperAdmin = (auth: AuthContext) => {
  const roles = new Set([auth.role, ...(auth.roles ?? [])].filter(Boolean))
  return roles.has("super_admin")
}

const isOrgAdmin = (auth: AuthContext) => {
  const roles = new Set([auth.role, ...(auth.roles ?? [])].filter(Boolean))
  return ["admin", "owner", "user_admin", "user_owner"].some((role) =>
    roles.has(role)
  )
}

export const createAdminDevicesRoutes = (deps: Deps = {}) => {
  const authenticate = deps.authenticate ?? (() => withAuth())
  const deviceService = deps.deviceService ?? vpnMobileDeviceService

  const requireAdmin = async (set: RouteSet) => {
    const auth = await authenticate()
    if (!auth.user) return { error: unauthorized(set) }
    if (!auth.organizationId) {
      return { error: forbidden(set, "No active organization found.") }
    }
    if (!isSuperAdmin(auth) && !isOrgAdmin(auth)) {
      return {
        error: forbidden(set, "Admin access required."),
      }
    }
    return { auth, organizationId: auth.organizationId, userId: auth.user.id }
  }

  return new Elysia()

    /**
     * List all devices with filters and pagination.
     * Auth: admin or super admin.
     * Super admin: can see all orgs. Admin: own org only.
     */
    .get(
      "/vpn/mobile/admin/devices",
      async ({ query, set }) => {
        const ctx = await requireAdmin(set)
        if ("error" in ctx) return ctx.error

        const page = Math.max(1, Number(query.page) || 1)
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
        const skip = (page - 1) * limit

        // Build where clause.
        const where: Record<string, unknown> = {}

        // Super admin can filter by org; admin is scoped to own org.
        if (isSuperAdmin(ctx.auth) && query.organizationId) {
          where.organizationId = query.organizationId
        } else if (!isSuperAdmin(ctx.auth)) {
          where.organizationId = ctx.organizationId
        }

        if (query.subscriptionId) {
          where.subscriptionId = query.subscriptionId
        }
        if (query.status) {
          where.status = query.status
        }
        if (query.platform) {
          where.platform = query.platform
        }
        if (query.pairedVia) {
          where.pairedVia = query.pairedVia
        }
        if (query.search) {
          where.deviceName = {
            contains: query.search,
            mode: "insensitive",
          }
        }

        const [devices, total] = await Promise.all([
          prisma.vpnMobileDevice.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.vpnMobileDevice.count({ where }),
        ])

        return {
          devices: devices.map((device) => ({
            id: device.id,
            deviceName: device.deviceName,
            platform: device.platform,
            osVersion: device.osVersion,
            appVersion: device.appVersion,
            subscriptionId: device.subscriptionId,
            subscriptionStatus: null,
            organizationId: device.organizationId,
            organizationName: null,
            status: device.status,
            pairedVia: device.pairedVia,
            lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
            pairedAt: device.createdAt.toISOString(),
            revokedAt: device.revokedAt?.toISOString() ?? null,
            revokedReason: device.revokedReason,
          })),
          total,
          page,
          limit,
        }
      },
      {
        query: t.Object({
          subscriptionId: t.Optional(t.String()),
          organizationId: t.Optional(t.String()),
          status: t.Optional(t.String()),
          platform: t.Optional(t.String()),
          pairedVia: t.Optional(t.String()),
          search: t.Optional(t.String()),
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Force-revoke a device.
     * Auth: admin or super admin.
     */
    .delete(
      "/vpn/mobile/admin/devices/:deviceId",
      async ({ request, params, body, set }) => {
        const ctx = await requireAdmin(set)
        if ("error" in ctx) return ctx.error

        const device = await prisma.vpnMobileDevice.findUnique({
          where: { id: params.deviceId },
          select: { id: true, organizationId: true, status: true },
        })

        if (!device) return notFound(set)

        // Super admin can revoke any device.
        // Org admin can only revoke devices in their org.
        if (!isSuperAdmin(ctx.auth) && device.organizationId !== ctx.organizationId) {
          return forbidden(set, "You do not have permission to revoke this device.")
        }

        try {
          await deviceService.revoke({
            deviceId: device.id,
            revokedBy: ctx.userId,
            reason: body.reason ?? null,
          })
        } catch (error) {
          const err = error as Error & { name?: string }
          if (err.name === "VpnMobileDeviceNotFoundError") return notFound(set)
          if (err.name === "VpnMobileDeviceAlreadyRevokedError") {
            return { ok: true as const }
          }
          throw error
        }

        // Audit: log admin-initiated device revocation
        logAuditEvent({
          deviceId: device.id,
          userId: ctx.userId,
          action: "DEVICE_REVOKED",
          details: {
            revokedBy: ctx.userId,
            reason: body.reason ?? null,
          },
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
        }).catch(() => {})

        return { ok: true as const }
      },
      {
        body: t.Object({
          reason: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Export device data as CSV.
     * Auth: super admin only.
     */
    .get(
      "/vpn/mobile/admin/devices/export",
      async ({ query, set }) => {
        const ctx = await requireAdmin(set)
        if ("error" in ctx) return ctx.error

        // Only super admin can export.
        if (!isSuperAdmin(ctx.auth)) {
          return forbidden(set, "Only super admins can export device data.")
        }

        const where: Record<string, unknown> = {}
        if (query.organizationId) {
          where.organizationId = query.organizationId
        }
        if (query.status) {
          where.status = query.status
        }

        const devices = await prisma.vpnMobileDevice.findMany({
          where,
          orderBy: { createdAt: "desc" },
        })

        // Build CSV.
        const headers = [
          "Device ID",
          "Name",
          "Platform",
          "OS Version",
          "Organization ID",
          "Subscription ID",
          "Status",
          "Paired Via",
          "Paired At",
          "Last Seen",
          "Revoked At",
          "Revoked Reason",
        ]

        const rows = devices.map((d) => [
          d.id,
          d.deviceName,
          d.platform,
          d.osVersion ?? "",
          d.organizationId,
          d.subscriptionId,
          d.status,
          d.pairedVia,
          d.createdAt.toISOString(),
          d.lastSeenAt?.toISOString() ?? "",
          d.revokedAt?.toISOString() ?? "",
          d.revokedReason ?? "",
        ])

        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row
              .map((cell) =>
                `"${String(cell).replace(/"/g, '""')}"`
              )
              .join(",")
          ),
        ].join("\n")

        set.status = 200
        return new Response(csvContent, {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition":
              'attachment; filename="vpn-devices-export.csv"',
          },
        })
      },
      {
        query: t.Object({
          organizationId: t.Optional(t.String()),
          status: t.Optional(t.String()),
        }),
      }
    )
}

export const adminDevicesRoutes = createAdminDevicesRoutes()
