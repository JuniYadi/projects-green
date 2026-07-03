/**
 * User-facing device management routes (T5.1-T5.3).
 *
 * GET    /api/vpn/mobile/devices — List devices paired to current user's subscriptions.
 * DELETE /api/vpn/mobile/devices/:deviceId — Revoke a specific device.
 * PATCH  /api/vpn/mobile/devices/:deviceId — Update device name.
 */

import { Elysia, t } from "elysia"

import { prisma } from "@/lib/prisma"
import { withAuth } from "@workos-inc/authkit-nextjs"
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

export const createMobileDeviceRoutes = (deps: Deps = {}) => {
  const authenticate = deps.authenticate ?? (() => withAuth())
  const deviceService = deps.deviceService ?? vpnMobileDeviceService

  const resolveOrg = async (set: RouteSet) => {
    const auth = await authenticate()
    if (!auth.user) return { error: unauthorized(set) }
    if (!auth.organizationId) {
      return { error: forbidden(set, "No active organization found.") }
    }
    return { auth, organizationId: auth.organizationId, userId: auth.user.id }
  }

  const isAdmin = (auth: AuthContext) => {
    const roles = new Set([auth.role, ...(auth.roles ?? [])].filter(Boolean))
    return ["admin", "owner", "super_admin", "user_admin", "user_owner"].some(
      (role) => roles.has(role)
    )
  }

  return (
    new Elysia()

      /**
       * List devices paired to current user's subscriptions.
       * Auth: Bearer (session token — user or admin).
       */
      .get("/vpn/mobile/devices", async ({ set }) => {
        const ctx = await resolveOrg(set)
        if ("error" in ctx) return ctx.error

        const devices = await prisma.vpnMobileDevice.findMany({
          where: { organizationId: ctx.organizationId },
          orderBy: { createdAt: "desc" },
        })

        return {
          devices: devices.map((device) => ({
            id: device.id,
            deviceName: device.deviceName,
            platform: device.platform,
            osVersion: device.osVersion,
            subscriptionId: device.subscriptionId,
            subscriptionName: null,
            subscriptionStatus: null,
            status: device.status,
            pairedVia: device.pairedVia,
            lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
            pairedAt: device.createdAt.toISOString(),
            revokedAt: device.revokedAt?.toISOString() ?? null,
            revokedReason: device.revokedReason,
          })),
        }
      })

      /**
       * Revoke a specific device.
       * Auth: Bearer (session token).
       * User can revoke own device; admin can revoke any device in their org.
       */
      .delete(
        "/vpn/mobile/devices/:deviceId",
        async ({ request, params, set }) => {
          const ctx = await resolveOrg(set)
          if ("error" in ctx) return ctx.error

          // Fetch the device to check ownership.
          const device = await prisma.vpnMobileDevice.findUnique({
            where: { id: params.deviceId },
            select: {
              id: true,
              organizationId: true,
              userId: true,
              status: true,
            },
          })

          if (!device) return notFound(set)

          // Check permission: user owns device OR user is org admin.
          const isOwner = device.userId === ctx.userId
          const isOrgAdmin = isAdmin(ctx.auth)

          if (!isOwner && !isOrgAdmin) {
            return forbidden(
              set,
              "You do not have permission to revoke this device."
            )
          }

          try {
            await deviceService.revoke({
              deviceId: device.id,
              revokedBy: ctx.userId,
              reason: "User-initiated revocation",
            })
          } catch (error) {
            const err = error as Error & { name?: string }
            if (err.name === "VpnMobileDeviceNotFoundError")
              return notFound(set)
            if (err.name === "VpnMobileDeviceAlreadyRevokedError") {
              return { ok: true as const }
            }
            throw error
          }

          // Audit: log device revocation
          logAuditEvent({
            deviceId: device.id,
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "DEVICE_REVOKED",
            status: "OK",
            message: "Device revoked by user",
            details: { reason: "User-initiated revocation" },
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent"),
          }).catch(() => {})

          return { ok: true as const }
        }
      )

      /**
       * Replace an active device with a new fingerprint.
       * Auth: Bearer (session token — device owner or org admin).
       *
       * Use case: app reinstall, lost phone, or new device without manually
       * revoking and re-pairing. The old device is revoked with reason
       * REPLACED_BY_NEW_DEVICE and a new device row is created.
       */
      .post(
        "/vpn/mobile/devices/:deviceId/replace",
        async ({ request, params, body, set }) => {
          const ctx = await resolveOrg(set)
          if ("error" in ctx) return ctx.error

          // Fetch device to check ownership and subscription.
          const device = await prisma.vpnMobileDevice.findUnique({
            where: { id: params.deviceId },
            select: {
              id: true,
              userId: true,
              organizationId: true,
              subscriptionId: true,
              status: true,
            },
          })

          if (!device) return notFound(set)

          const isOwner = device.userId === ctx.userId
          const isOrgAdmin = isAdmin(ctx.auth)

          if (!isOwner && !isOrgAdmin) {
            return forbidden(
              set,
              "You do not have permission to replace this device."
            )
          }

          if (device.status === "REVOKED") {
            set.status = 400
            return {
              error: {
                code: "DEVICE_ALREADY_REVOKED" as const,
                message: "This device has already been revoked.",
                details: {},
              },
            }
          }

          let newDevice
          try {
            newDevice = await deviceService.replace({
              oldDeviceId: device.id,
              subscriptionId: device.subscriptionId,
              organizationId: device.organizationId,
              userId: device.userId,
              deviceName: body.deviceName,
              deviceFingerprint: body.deviceFingerprint,
              platform: body.platform,
              osVersion: body.osVersion ?? null,
              appVersion: body.appVersion ?? null,
              pairedVia: device.userId ? "SSO" : "QR",
              replacedBy: ctx.userId,
              reason: "REPLACED_BY_NEW_DEVICE",
            })
          } catch (error) {
            const err = error as Error & { name?: string }
            if (err.name === "VpnMobileDeviceNotFoundError") {
              return notFound(set)
            }
            if (err.name === "VpnMobileDeviceAlreadyRevokedError") {
              set.status = 400
              return {
                error: {
                  code: "DEVICE_ALREADY_REVOKED" as const,
                  message: "This device has already been revoked.",
                  details: {},
                },
              }
            }
            throw error
          }

          // Audit: log device replacement
          logAuditEvent({
            deviceId: newDevice.id,
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            subscriptionId: device.subscriptionId,
            action: "DEVICE_REPLACED",
            status: "OK",
            message: "Device replaced with new fingerprint",
            details: {
              oldDeviceId: device.id,
              reason: "REPLACED_BY_NEW_DEVICE",
            },
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent"),
          }).catch(() => {})

          return {
            ok: true as const,
            device: {
              id: newDevice.id,
              deviceName: newDevice.deviceName,
              platform: newDevice.platform,
              status: newDevice.status,
              pairedAt: newDevice.createdAt.toISOString(),
            },
          }
        },
        {
          body: t.Object({
            deviceName: t.String({ minLength: 1, maxLength: 100 }),
            deviceFingerprint: t.String({ minLength: 1 }),
            platform: t.String({ minLength: 1 }),
            osVersion: t.Optional(t.String()),
            appVersion: t.Optional(t.String()),
          }),
        }
      )

      /**
       * Update device name.
       * Auth: Bearer (session token — device owner).
       */
      .patch(
        "/vpn/mobile/devices/:deviceId",
        async ({ params, body, set }) => {
          const ctx = await resolveOrg(set)
          if ("error" in ctx) return ctx.error

          // Fetch device to check ownership.
          const device = await prisma.vpnMobileDevice.findUnique({
            where: { id: params.deviceId },
            select: { id: true, userId: true, organizationId: true },
          })

          if (!device) return notFound(set)

          // Only device owner or admin can rename.
          const isOwner = device.userId === ctx.userId
          const isOrgAdmin = isAdmin(ctx.auth)

          if (!isOwner && !isOrgAdmin) {
            return forbidden(
              set,
              "You do not have permission to rename this device."
            )
          }

          await deviceService.updateName(device.id, body.deviceName)

          // Audit: log device rename
          logAuditEvent({
            deviceId: device.id,
            userId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "DEVICE_RENAMED",
            status: "OK",
            message: `Device renamed to "${body.deviceName}"`,
            details: { newDeviceName: body.deviceName },
          }).catch(() => {})

          return { ok: true as const }
        },
        {
          body: t.Object({
            deviceName: t.String({ minLength: 1, maxLength: 100 }),
          }),
        }
      )
  )
}

export const mobileDeviceRoutes = createMobileDeviceRoutes()
