/**
 * Mobile pairing routes (T2.1-T2.3).
 *
 * POST /api/vpn/mobile/pairing/generate — Generate QR pairing token.
 * POST /api/vpn/mobile/pairing/claim — Claim a QR pairing token from mobile app.
 * GET  /api/vpn/mobile/pairing/status/:token — Check pairing token status (portal polling).
 */

import { Elysia, t } from "elysia"

import { prisma } from "@/lib/prisma"
import { withAuth } from "@workos-inc/authkit-nextjs"
import {
  createRateLimiter,
  getClientIp,
  buildRateLimitResponse,
  rateLimitHeaders,
} from "@/lib/rate-limit"
import { logAuditEvent } from "@/lib/audit.service"

import {
  VpnPairingTokenService,
  vpnPairingTokenService,
} from "@/modules/vpn/mobile/vpn-pairing-token.service"
import {
  VpnMobileDeviceService,
  vpnMobileDeviceService,
} from "@/modules/vpn/mobile/vpn-mobile-device.service"

import {
  toPairingClaimResultDTO,
  toPairingGenerateResultDTO,
} from "@/modules/vpn/mobile/vpn-pairing-token.dto"

// Rate limiters
const claimRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
})
const generateRateLimiter = createRateLimiter({
  windowMs: 3600_000,
  max: 30,
})

type AuthContext = {
  organizationId?: string | null
  user: { id: string } | null
  role?: string | null
  roles?: string[] | null
}

type RouteSet = { status?: number | string }

type Deps = {
  authenticate?: () => Promise<AuthContext>
  pairingService?: VpnPairingTokenService
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
      message: "Subscription not found.",
      details: {},
    },
  }
}

const badRequest = (set: RouteSet, code: string, message: string) => {
  set.status = 400
  return {
    error: {
      code: code as
        | "PAIRING_TOKEN_USED"
        | "PAIRING_TOKEN_EXPIRED"
        | "SUBSCRIPTION_NOT_ACTIVE",
      message,
      details: {},
    },
  }
}

export const createMobilePairingRoutes = (deps: Deps = {}) => {
  const authenticate = deps.authenticate ?? (() => withAuth())
  const pairingService =
    deps.pairingService ?? vpnPairingTokenService
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const deviceService =
    deps.deviceService ?? vpnMobileDeviceService

  const resolveAuth = async (set: RouteSet) => {
    const auth = await authenticate()
    if (!auth.user) return { error: unauthorized(set) }
    if (!auth.organizationId) {
      return {
        error: forbidden(
          set,
          "No active organization found."
        ),
      }
    }
    return { auth }
  }

  const isAdmin = (auth: AuthContext) => {
    const roles = new Set(
      [auth.role, ...(auth.roles ?? [])].filter(Boolean)
    )
    return [
      "admin",
      "owner",
      "super_admin",
      "user_admin",
      "user_owner",
    ].some((role) => roles.has(role))
  }

  return new Elysia()
    /**
     * Generate a short-lived QR pairing token.
     * Auth: user must own the subscription or be org admin.
     */
    .post(
      "/vpn/mobile/pairing/generate",
      async ({ body, set }) => {
        const ctx = await resolveAuth(set)
        if ("error" in ctx) return ctx.error

        // Rate limit: 30/h per user (user is guaranteed non-null after resolveAuth)
        const rateResult = generateRateLimiter(
          ctx.auth.user!.id
        )
        if (!rateResult.allowed) {
          set.status = 429
          set.headers = rateLimitHeaders(rateResult)
          return buildRateLimitResponse(rateResult)
        }

        // Verify subscription exists and belongs to user's org.
        const subscription =
          await prisma.vpnSubscription.findUnique({
            where: { id: body.subscriptionId },
            select: {
              id: true,
              organizationId: true,
              status: true,
            },
          })

        if (!subscription) return notFound(set)

        // Check ownership: user must own the subscription or be admin.
        if (
          subscription.organizationId !== ctx.auth.organizationId &&
          !isAdmin(ctx.auth)
        ) {
          return forbidden(
            set,
            "You do not have access to this subscription."
          )
        }

        // Only active subscriptions can generate pairing tokens.
        if (subscription.status !== "ACTIVE") {
          set.status = 400
          return {
            error: {
              code: "SUBSCRIPTION_NOT_ACTIVE" as const,
              message:
                "Subscription is not active. Only active subscriptions can pair devices.",
              details: {},
            },
          }
        }

        const result = await pairingService.generate({
          subscriptionId: subscription.id,
          organizationId: ctx.auth.organizationId as string,
        })

        return toPairingGenerateResultDTO(
          result.pairingToken,
          result.expiresAt
        )
      },
      {
        body: t.Object({
          subscriptionId: t.String({ minLength: 1 }),
        }),
      }
    )

    /**
     * Claim a QR pairing token from the mobile app.
     * Auth: None (token is the auth).
     */
    .post(
      "/vpn/mobile/pairing/claim",
      async ({ body, request, set }) => {
        // Rate limit: 5/min per IP
        const rateResult = claimRateLimiter(
          getClientIp(request)
        )
        if (!rateResult.allowed) {
          set.status = 429
          set.headers = rateLimitHeaders(rateResult)
          return buildRateLimitResponse(rateResult)
        }

        try {
          const result = await pairingService.claim({
            pairingToken: body.pairingToken,
            deviceName: body.deviceName,
            deviceFingerprint: body.deviceFingerprint,
            platform: body.platform,
            osVersion: body.osVersion ?? null,
            appVersion: body.appVersion ?? null,
          })

          // Fetch subscription + server accounts for the DTO.
          const subscription =
            await prisma.vpnSubscription.findUnique({
              where: { id: result.subscriptionId },
            })

          if (!subscription) {
            set.status = 404
            return {
              error: {
                code: "NOT_FOUND" as const,
                message:
                  "Subscription not found after claiming token.",
                details: {},
              },
            }
          }

          const accounts =
            await prisma.vpnServerAccount.findMany({
              where: {
                subscriptionId: result.subscriptionId,
              },
              include: {
                server: {
                  select: {
                    name: true,
                    region: { select: { name: true } },
                  },
                },
              },
            })

          // Audit: log device registration via QR
          logAuditEvent({
            deviceId: result.deviceId,
            action: "DEVICE_REGISTERED",
            details: { pairedVia: "QR" },
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent"),
          }).catch(() => {})

          return toPairingClaimResultDTO(
            result.deviceId,
            subscription,
            accounts
          )
        } catch (error) {
          const err = error as Error & {
            name?: string
          }
          if (
            err.name ===
            "VpnPairingTokenAlreadyUsedError"
          ) {
            return badRequest(
              set,
              "PAIRING_TOKEN_USED",
              "This pairing code has already been used. Generate a new one from the portal."
            )
          }
          if (
            err.name ===
            "VpnPairingTokenExpiredError"
          ) {
            return badRequest(
              set,
              "PAIRING_TOKEN_EXPIRED",
              "This pairing code has expired. Generate a new one from the portal."
            )
          }
          if (
            err.name ===
            "VpnPairingTokenInvalidError"
          ) {
            return badRequest(
              set,
              "PAIRING_TOKEN_USED",
              "Invalid pairing code."
            )
          }
          if (
            err.name ===
            "VpnMobileDeviceAlreadyRevokedError"
          ) {
            set.status = 409
            return {
              error: {
                code: "DEVICE_ALREADY_PAIRED" as const,
                message:
                  "This device was previously paired and revoked. Contact support.",
                details: {},
              },
            }
          }
          throw error
        }
      },
      {
        body: t.Object({
          pairingToken: t.String({ minLength: 1 }),
          deviceName: t.String({ minLength: 1 }),
          deviceFingerprint: t.String({ minLength: 1 }),
          platform: t.String({ minLength: 1 }),
          osVersion: t.Optional(t.String()),
          appVersion: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Check pairing token status (used by portal QR UI for polling).
     * Auth: Bearer (admin or subscription owner).
     */
    .get(
      "/vpn/mobile/pairing/status/:token",
      async ({ params, set }) => {
        const ctx = await resolveAuth(set)
        if ("error" in ctx) return ctx.error

        try {
          const result = await pairingService.getStatus(
            params.token
          )
          return result
        } catch (error) {
          const err = error as Error & { name?: string }
          if (
            err.name === "VpnPairingTokenInvalidError"
          ) {
            set.status = 404
            return {
              error: {
                code: "NOT_FOUND" as const,
                message:
                  "Pairing token not found.",
                details: {},
              },
            }
          }
          throw error
        }
      }
    )
}

export const mobilePairingRoutes = createMobilePairingRoutes()
