import { Elysia, t } from "elysia"

import { prisma } from "@/lib/prisma"
import { requireMobileSession } from "@/modules/vpn/mobile/api/mobile-auth.middleware"

import {
  vpnMobileSessionService,
  type VpnMobileSessionService,
} from "./vpn-mobile-session.service"
import { toSessionDetailDTO } from "./vpn-mobile-session.dto"

type Deps = {
  service?: VpnMobileSessionService
  now?: () => Date
}

export const createMobileSessionRoutes = (deps: Deps = {}) => {
  const service = deps.service ?? vpnMobileSessionService

  return new Elysia()

    /**
     * POST /vpn/mobile/sessions
     * Create session (mobile connects to a server).
     * Body: { serverAccountId }
     * Derives: deviceId from JWT, subscriptionId from device, serverId from serverAccount
     */
    .post(
      "/vpn/mobile/sessions",
      async ({ body, request, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        // Validate server account
        const serverAccount = await prisma.vpnServerAccount.findUnique({
          where: { id: body.serverAccountId },
          select: { id: true, serverId: true, subscriptionId: true },
        })
        if (!serverAccount) {
          set.status = 404
          return {
            error: {
              code: "SERVER_ACCOUNT_NOT_FOUND",
              message: "Server account not found.",
              details: {},
            },
          }
        }

        // Verify server account belongs to the same subscription
        const device = await prisma.vpnMobileDevice.findUnique({
          where: { id: auth.mobileAuth.deviceId },
          select: { subscriptionId: true },
        })
        if (!device || device.subscriptionId !== serverAccount.subscriptionId) {
          set.status = 403
          return {
            error: {
              code: "ACCESS_DENIED",
              message: "Server account does not belong to your subscription.",
              details: {},
            },
          }
        }

        const session = await service.create({
          deviceId: auth.mobileAuth.deviceId,
          subscriptionId: serverAccount.subscriptionId,
          serverAccountId: serverAccount.id,
          serverId: serverAccount.serverId,
        })

        return {
          sessionId: session.id,
          startedAt: session.startedAt.toISOString(),
        }
      },
      {
        body: t.Object({
          serverAccountId: t.String({ minLength: 1 }),
        }),
      }
    )

    /**
     * POST /vpn/mobile/sessions/:id/ping
     * Heartbeat — bump lastPingAt.
     * Validates session belongs to authenticated device.
     */
    .post(
      "/vpn/mobile/sessions/:id/ping",
      async ({ params, request, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        const session = await service.findById(params.id, auth.mobileAuth.organizationId)
        if (!session) {
          set.status = 404
          return {
            error: {
              code: "SESSION_NOT_FOUND",
              message: "Session not found.",
              details: {},
            },
          }
        }

        if (session.deviceId !== auth.mobileAuth.deviceId) {
          set.status = 403
          return {
            error: {
              code: "ACCESS_DENIED",
              message: "Session does not belong to this device.",
              details: {},
            },
          }
        }

        const updated = await service.ping(params.id)
        if (!updated) {
          set.status = 404
          return {
            error: {
              code: "SESSION_NOT_FOUND",
              message: "Session not found.",
              details: {},
            },
          }
        }

        return { lastPingAt: updated.lastPingAt.toISOString() }
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
      }
    )

    /**
     * PATCH /vpn/mobile/sessions/:id
     * Close session + submit traffic data on disconnect.
     */
    .patch(
      "/vpn/mobile/sessions/:id",
      async ({ params, body, request, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        const session = await service.findById(params.id, auth.mobileAuth.organizationId)
        if (!session) {
          set.status = 404
          return {
            error: {
              code: "SESSION_NOT_FOUND",
              message: "Session not found.",
              details: {},
            },
          }
        }

        if (session.deviceId !== auth.mobileAuth.deviceId) {
          set.status = 403
          return {
            error: {
              code: "ACCESS_DENIED",
              message: "Session does not belong to this device.",
              details: {},
            },
          }
        }

        const updated = await service.close(params.id, {
          txBytes: body.txBytes,
          rxBytes: body.rxBytes,
        })
        if (!updated) {
          set.status = 404
          return {
            error: {
              code: "SESSION_NOT_FOUND",
              message: "Session not found.",
              details: {},
            },
          }
        }

        return {
          id: updated.id,
          status: updated.status,
          endedAt: updated.endedAt?.toISOString() ?? null,
          txBytes: Number(updated.txBytes),
          rxBytes: Number(updated.rxBytes),
        }
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        body: t.Object({
          txBytes: t.Optional(t.Number({ minimum: 0 })),
          rxBytes: t.Optional(t.Number({ minimum: 0 })),
        }),
      }
    )

    /**
     * GET /vpn/mobile/sessions
     * List sessions with filters + group stats for dashboard.
     * Mobile auth: lists own devices' sessions.
     * Query params: status, serverId, subscriptionId, deviceId, cursor, limit
     */
    .get(
      "/vpn/mobile/sessions",
      async ({ query, request, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        // Non-admin mobile users can only see their own device's sessions
        const effectiveDeviceId =
          query.all !== "true" ? auth.mobileAuth.deviceId : query.deviceId

        const result = await service.list({
          status: query.status,
          serverId: query.serverId,
          subscriptionId: query.subscriptionId,
          deviceId: effectiveDeviceId,
          cursor: query.cursor,
          limit: query.limit ?? 20,
          organizationId: auth.mobileAuth.organizationId,
        })

        const sessions = result.sessions.map((s) =>
          toSessionDetailDTO(s)
        )

        // Only return stats when listing without device filter (dashboard view)
        const stats =
          !query.deviceId && !effectiveDeviceId
            ? await service.getStats(auth.mobileAuth.organizationId)
            : undefined

        return { sessions, nextCursor: result.nextCursor, total: result.total, stats }
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          serverId: t.Optional(t.String()),
          subscriptionId: t.Optional(t.String()),
          deviceId: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          all: t.Optional(t.String()),
        }),
      }
    )

    /**
     * GET /vpn/mobile/sessions/stats
     * Dashboard stats: active sessions grouped by server and subscription.
     */
    .get(
      "/vpn/mobile/sessions/stats",
      async ({ request, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        return await service.getStats(auth.mobileAuth.organizationId)
      }
    )
}

export const mobileSessionRoutes = createMobileSessionRoutes()
