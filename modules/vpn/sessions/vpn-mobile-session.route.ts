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

  const errorResponse = t.Object({
    error: t.Object({
      code: t.String(),
      message: t.String(),
      details: t.Object({}, { additionalProperties: true }),
    }),
  })
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
        if (!auth.ok) return { error: auth.error }

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
        detail: {
          tags: ["VPN Mobile Sessions"],
          summary: "Start VPN session",
          description: "Create a new VPN session when the mobile device connects to a server.",
          security: [{ bearerAuth: [] }],
        },
        body: t.Object({
          serverAccountId: t.String({ minLength: 1 }),
        }),
        response: {
          200: t.Object({
            sessionId: t.String(),
            startedAt: t.String(),
          }),
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
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
        if (!auth.ok) return { error: auth.error }

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
        detail: {
          tags: ["VPN Mobile Sessions"],
          summary: "Send session heartbeat",
          description: "Send a heartbeat ping for an active VPN session. Updates lastPingAt timestamp.",
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        response: {
          200: t.Object({
            lastPingAt: t.String(),
          }),
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
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
        if (!auth.ok) return { error: auth.error }

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
        detail: {
          tags: ["VPN Mobile Sessions"],
          summary: "Close session",
          description: "Close a VPN session and submit traffic data on disconnect.",
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        body: t.Object({
          txBytes: t.Optional(t.Number({ minimum: 0 })),
          rxBytes: t.Optional(t.Number({ minimum: 0 })),
        }),
        response: {
          200: t.Object({
            id: t.String(),
            status: t.String(),
            endedAt: t.Nullable(t.String()),
            txBytes: t.Number(),
            rxBytes: t.Number(),
          }),
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
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
        if (!auth.ok) return { error: auth.error }

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
        detail: {
          tags: ["VPN Mobile Sessions"],
          summary: "List sessions",
          description: "List VPN sessions with optional filters by status, server, or device. Supports cursor-based pagination.",
          security: [{ bearerAuth: [] }],
        },
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
        if (!auth.ok) return { error: auth.error }

        return await service.getStats(auth.mobileAuth.organizationId)
      },
      {
        detail: {
          tags: ["VPN Mobile Sessions"],
          summary: "Dashboard session stats",
          description: "Get dashboard session statistics grouped by server and subscription.",
          security: [{ bearerAuth: [] }],
        },
        response: {
          200: t.Object({
            totalActive: t.Number(),
            byServer: t.Record(t.String(), t.Number()),
            bySubscription: t.Record(t.String(), t.Number()),
          }),
          401: errorResponse,
        },
      }
    )
}

export const mobileSessionRoutes = createMobileSessionRoutes()
