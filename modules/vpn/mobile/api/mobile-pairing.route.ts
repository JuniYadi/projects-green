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
import { VpnMobileDeviceLimitError } from "@/modules/vpn/mobile/vpn-mobile.errors"

import {
  VpnPairingTokenService,
  vpnPairingTokenService,
} from "@/modules/vpn/mobile/vpn-pairing-token.service"
import {
  VpnMobileDeviceService,
  vpnMobileDeviceService,
} from "@/modules/vpn/mobile/vpn-mobile-device.service"

import {
  signSessionJwt,
  ACCESS_TOKEN_TTL_SECONDS,
} from "@/modules/vpn/mobile/lib/vpn-session.lib"

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
  now?: () => Date
  signJwt?: typeof signSessionJwt
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
        | "PAIRING_TOKEN_INVALID"
        | "SUBSCRIPTION_NOT_ACTIVE",
      message,
      details: {},
    },
  }
}

export const createMobilePairingRoutes = (deps: Deps = {}) => {
  const authenticate = deps.authenticate ?? (() => withAuth())
  const pairingService = deps.pairingService ?? vpnPairingTokenService
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const deviceService = deps.deviceService ?? vpnMobileDeviceService
  const now = deps.now ?? (() => new Date())
  const signJwt = deps.signJwt ?? signSessionJwt
  const errorResponse = t.Object({
    error: t.Object({
      code: t.String(),
      message: t.String(),
      details: t.Object({}, { additionalProperties: true }),
    }),
  })

  const resolveAuth = async (set: RouteSet) => {
    let auth: AuthContext
    try {
      auth = await authenticate()
    } catch (error) {
      console.error(
        "[AUTH ERROR] withAuth threw — middleware header mismatch?",
        error instanceof Error ? error.stack ?? error.message : String(error)
      )
      set.status = 500
      return {
        error: {
          code: "AUTH_SERVICE_ERROR" as const,
          message: "Authentication service unavailable.",
          details: {},
        },
      }
    }
    if (!auth.user) return unauthorized(set)
    if (!auth.organizationId) {
      return forbidden(set, "No active organization found.")
    }
    return { auth }
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
       * Generate a short-lived QR pairing token.
       * Auth: user must own the subscription or be org admin.
       */
      .post(
        "/vpn/mobile/pairing/generate",
        async ({ body, set }) => {
          const ctx = await resolveAuth(set)
          if ("error" in ctx) return ctx

          // Rate limit: 30/h per user (user is guaranteed non-null after resolveAuth)
          const rateResult = generateRateLimiter(ctx.auth.user!.id)
          if (!rateResult.allowed) {
            set.status = 429
            set.headers = rateLimitHeaders(rateResult)
            return buildRateLimitResponse(rateResult)
          }

          // Verify subscription exists and belongs to user's org.
          const subscription = await prisma.vpnSubscription.findUnique({
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
          detail: {
            tags: ["VPN Mobile Pairing"],
            summary: "Generate QR pairing token",
            description: "Generate a short-lived JWT-based QR pairing token for mobile device pairing. Requires Bearer auth (user must own the subscription or be org admin).",
            security: [{ bearerAuth: [] }],
          },
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
          const rateResult = claimRateLimiter(getClientIp(request))
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
            const subscription = await prisma.vpnSubscription.findUnique({
              where: { id: result.subscriptionId },
            })

            if (!subscription) {
              set.status = 404
              return {
                error: {
                  code: "NOT_FOUND" as const,
                  message: "Subscription not found after claiming token.",
                  details: {},
                },
              }
            }

            // ponytail: data integrity — org must be present
            if (!result.organizationId) {
              set.status = 500
              return {
                error: {
                  code: "INTERNAL_ERROR" as const,
                  message: "Organization not found after claiming pairing token.",
                  details: {},
                },
              }
            }

            const accounts = await prisma.vpnServerAccount.findMany({
              where: {
                subscriptionId: result.subscriptionId,
              },
              include: {
                server: {
                  select: {
                    name: true,
                    hostname: true,
                    ipAddress: true,
                    region: { select: { name: true } },
                  },
                },
              },
            })

            // Audit: log device registration via QR
            logAuditEvent({
              deviceId: result.deviceId,
              organizationId: result.organizationId,
              subscriptionId: result.subscriptionId,
              action: "DEVICE_REGISTERED",
              status: "OK",
              message: "Device paired via QR code",
              details: { pairedVia: "QR", deviceName: body.deviceName, platform: body.platform },
              ip: getClientIp(request),
              userAgent: request.headers.get("user-agent"),
            }).catch(() => {})

            // Audit: log mobile login via QR
            logAuditEvent({
              deviceId: result.deviceId,
              organizationId: result.organizationId,
              subscriptionId: result.subscriptionId,
              action: "AUTH_MOBILE_LOGIN",
              status: "OK",
              message: "Mobile login via QR code pairing",
              details: { deviceName: body.deviceName, platform: body.platform },
              ip: getClientIp(request),
              userAgent: request.headers.get("user-agent"),
            }).catch(() => {})

            // Generate session JWT so mobile can call downstream endpoints
            // ponytail: sub=deviceId since there's no WorkOS user on this path
            const iat = Math.floor(now().getTime() / 1000)
            const exp = iat + ACCESS_TOKEN_TTL_SECONDS
            const token = signJwt({
              sub: result.deviceId,
              org: result.organizationId ?? "",
              device: result.deviceId,
              fingerprint: body.deviceFingerprint,
              iat,
              exp,
              typ: "mobile-session",
            })

            return toPairingClaimResultDTO(
              result.deviceId,
              subscription,
              accounts,
              { token, expiresAt: new Date(exp * 1000).toISOString() }
            )
          } catch (error) {
            const err = error as Error & {
              name?: string
            }
            if (err.name === "VpnPairingTokenAlreadyUsedError") {
              return badRequest(
                set,
                "PAIRING_TOKEN_USED",
                "This pairing code has already been used. Generate a new one from the portal."
              )
            }
            if (err.name === "VpnPairingTokenExpiredError") {
              return badRequest(
                set,
                "PAIRING_TOKEN_EXPIRED",
                "This pairing code has expired. Generate a new one from the portal."
              )
            }
            if (err.name === "VpnPairingTokenInvalidError") {
              return badRequest(
                set,
                "PAIRING_TOKEN_INVALID",
                "Invalid pairing code."
              )
            }
            if (err.name === "VpnMobileDeviceLimitError") {
              set.status = 403
              logAuditEvent({
                action: "AUTH_MOBILE_CLAIM",
                status: "FAILED",
                message: "Device limit reached during pairing claim",
                subscriptionId: (err as VpnMobileDeviceLimitError).subscriptionId,
                organizationId: (err as VpnMobileDeviceLimitError).organizationId,
                ip: getClientIp(request),
                userAgent: request.headers.get("user-agent"),
              }).catch(() => {})
              return {
                error: {
                  code: "DEVICE_LIMIT_REACHED" as const,
                  message:
                    "The maximum number of devices for this subscription has been reached.",
                  details: {},
                },
              }
            }
            throw error
          }
        },
        {
          detail: {
            tags: ["VPN Mobile Pairing"],
            summary: "Claim pairing token from mobile app",
            description: "Claim a QR pairing token from the mobile app. The pairing token itself acts as the authorization credential.",
          },
          body: t.Object({
            pairingToken: t.String({ minLength: 1 }),
            deviceName: t.String({ minLength: 1 }),
            deviceFingerprint: t.String({ minLength: 1 }),
            platform: t.String({ minLength: 1 }),
            osVersion: t.Optional(t.String()),
            appVersion: t.Optional(t.String()),
          }),
          response: {
            200: t.Object({
              deviceId: t.String(),
              token: t.String(),
              expiresAt: t.String(),
              subscription: t.Object({
                id: t.String(),
                status: t.String(),
                currentPeriodEnd: t.String(),
              }),
              profiles: t.Array(
                t.Object({
                  id: t.String(),
                  serverName: t.String(),
                  hostname: t.String(),
                  serverIp: t.Nullable(t.String()),
                  protocol: t.String(),
                  region: t.String(),
                  status: t.String(),
                })
              ),
            }),
            400: errorResponse,
            403: errorResponse,
            404: errorResponse,
            429: errorResponse,
          },
        }
      )

      /**
       * Check pairing token status (used by portal QR UI for polling).
       * Auth: Bearer (admin or subscription owner).
       */
      .get("/vpn/mobile/pairing/status/:token", async ({ params, set }) => {
        const ctx = await resolveAuth(set)
        if ("error" in ctx) return ctx

        try {
          const result = await pairingService.getStatus(params.token)
          return result
        } catch (error) {
          const err = error as Error & { name?: string }
          // Invalid or expired tokens are expected during polling — return
          // a safe status instead of 500 so the modal can react.
          if (
            err.name === "VpnPairingTokenInvalidError" ||
            err.name === "VpnPairingTokenExpiredError"
          ) {
            return { status: "expired" as const }
          }
          // Log unexpected errors for debugging and return a distinct
          // status so the UI can differentiate between "token expired" and
          // "service unavailable" instead of silently masking incidents.
          console.error(
            "[PAIRING STATUS] unexpected error:",
            err.name,
            err.message
          )
          return { status: "error" as const, message: err.message }
        }
      },
      {
        detail: {
          tags: ["VPN Mobile Pairing"],
          summary: "Poll pairing token status",
          description: "Check the current status of a QR pairing token for the portal QR polling UI.",
        },
      })
  )
}

export const mobilePairingRoutes = createMobilePairingRoutes()
