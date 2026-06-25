/**
 * Mobile auth routes (T3.1-T3.2).
 *
 * POST /api/vpn/mobile/auth/exchange — Exchange WorkOS OAuth code for a mobile session token.
 * POST /api/vpn/mobile/auth/refresh — Refresh an expired session token.
 */

import crypto from "node:crypto"
import { Elysia, t } from "elysia"

import { prisma } from "@/lib/prisma"
import {
  createRateLimiter,
  getClientIp,
  buildRateLimitResponse,
  rateLimitHeaders,
} from "@/lib/rate-limit"
import { logAuditEvent } from "@/lib/audit.service"

import {
  VpnMobileDeviceService,
  vpnMobileDeviceService,
} from "@/modules/vpn/mobile/vpn-mobile-device.service"

const MOBILE_SESSION_SECRET =
  process.env.MOBILE_SESSION_SECRET ?? process.env.JWT_SECRET ?? ""

const ACCESS_TOKEN_TTL_SECONDS = 604800 // 7 days

// Rate limiters
const exchangeRateLimiter = createRateLimiter({
  windowMs: 3600_000,
  max: 10,
})
const refreshRateLimiter = createRateLimiter({
  windowMs: 3600_000,
  max: 30,
})

/**
 * Sign a mobile session JWT (HS256).
 */
function signSessionJwt(claims: {
  sub: string
  org: string
  device: string
  fingerprint: string
  iat: number
  exp: number
}): string {
  const secret =
    MOBILE_SESSION_SECRET ||
    (() => {
      throw new Error("Missing MOBILE_SESSION_SECRET or JWT_SECRET")
    })()
  const header = { alg: "HS256", typ: "JWT" }
  const headerSegment = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  )
  const payloadSegment = Buffer.from(JSON.stringify(claims)).toString(
    "base64url"
  )
  const signingInput = `${headerSegment}.${payloadSegment}`
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url")
  return `${signingInput}.${signature}`
}

type AuthContext = {
  organizationId?: string | null
  user: { id: string } | null
}

type RouteSet = { status?: number | string }

type Deps = {
  authenticate?: () => Promise<AuthContext>
  exchangeCode?: (code: string) => Promise<AuthContext>
  deviceService?: VpnMobileDeviceService
  now?: () => Date
  signJwt?: typeof signSessionJwt
}

const unauthorized = (set: RouteSet) => {
  set.status = 401
  return {
    error: {
      code: "TOKEN_INVALID" as const,
      message: "Invalid or expired authorization code.",
      details: {},
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const serverError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    error: {
      code: "AUTH_PROVIDER_ERROR" as const,
      message,
      details: {},
    },
  }
}

export const createMobileAuthRoutes = (deps: Deps = {}) => {
  const deviceService = deps.deviceService ?? vpnMobileDeviceService
  const now = deps.now ?? (() => new Date())
  const signJwt = deps.signJwt ?? signSessionJwt

  return new Elysia()
    .post(
      "/vpn/mobile/auth/exchange",
      async ({ body, request, set }) => {
        // Rate limit: 10/h per IP
        const rateResult = exchangeRateLimiter(getClientIp(request))
        if (!rateResult.allowed) {
          set.status = 429
          set.headers = rateLimitHeaders(rateResult)
          return buildRateLimitResponse(rateResult)
        }

        // Resolve auth: code-exchange (mobile) or cookie (web).
        let auth: AuthContext
        if (body.authorizationCode) {
          const exchange = deps.exchangeCode ?? (async (code: string) => {
            const { createWorkOS } = await import("@workos-inc/node")
            // ponytail: direct import, lazy at request time — avoids side effects at module load
            const workos = createWorkOS({
              apiKey: process.env.WORKOS_API_KEY ?? "",
              clientId: process.env.WORKOS_CLIENT_ID ?? "",
            })
            const result = await workos.userManagement.authenticateWithCode({
              code,
              clientId: process.env.WORKOS_CLIENT_ID ?? "",
            })
            return { user: result.user, organizationId: result.organizationId ?? null }
          })
          try {
            auth = await exchange(body.authorizationCode)
          } catch (error: unknown) {
            // WorkOS auth-code failures → 401
            const name = error instanceof Error ? error.name : ""
            if (name === "AuthenticationException" || name === "UnauthorizedException" || name === "BadRequestException") {
              logAuditEvent({
                action: "AUTH_CODE_EXCHANGE",
                status: "FAILED",
                message: "Invalid authorization code",
                errorMessage: error instanceof Error ? error.message : String(error),
                ip: getClientIp(request),
                userAgent: request.headers.get("user-agent"),
              }).catch(() => {})
              return unauthorized(set)
            }
            // Unexpected WorkOS errors → 500
            logAuditEvent({
              action: "AUTH_CODE_EXCHANGE",
              status: "FAILED",
              message: "WorkOS API error during code exchange",
              errorMessage: error instanceof Error ? error.message : String(error),
              ip: getClientIp(request),
              userAgent: request.headers.get("user-agent"),
            }).catch(() => {})
            return serverError(set, "Authentication provider error.")
          }
        } else {
          auth = deps.authenticate
            ? await deps.authenticate()
            : await (async () => {
                // Use default WorkOS auth — but we skip importing
                // withAuth here to keep this side-effect free at
                // import time. The real auth happens at request time.
                const { withAuth } = await import("@workos-inc/authkit-nextjs")
                return withAuth()
              })()
        }

        if (!auth.user) return unauthorized(set)
        if (!auth.organizationId) {
          set.status = 403
          return {
            error: {
              code: "FORBIDDEN" as const,
              message: "No active organization found.",
              details: {},
            },
          }
        }

        // Find the user's active subscription FIRST.
        const subscription = await prisma.vpnSubscription.findFirst({
          where: {
            organizationId: auth.organizationId,
            status: "ACTIVE",
          },
          select: {
            id: true,
            status: true,
            currentPeriodEnd: true,
          },
        })

        if (!subscription) {
          set.status = 403
          return {
            error: {
              code: "SUBSCRIPTION_REQUIRED" as const,
              message:
                "An active VPN subscription is required to register this device.",
              details: {},
            },
          }
        }

        // Find or create the device with subscription link.
        let device: {
          id: string
          status: string
        }
        try {
          device = await deviceService.create({
            subscriptionId: subscription.id,
            organizationId: auth.organizationId,
            userId: auth.user.id,
            deviceName: body.deviceName,
            deviceFingerprint: body.deviceFingerprint,
            platform: body.platform,
            pairedVia: "SSO",
          })
        } catch (error) {
          console.error(
            "[MobileAuth] Device registration failed:",
            error instanceof Error ? error.message : String(error)
          )
          set.status = 500
          return {
            error: {
              code: "INTERNAL_ERROR" as const,
              message: "Device registration failed.",
              details: {},
            },
          }
        }

        // Audit: log device registration.
        logAuditEvent({
          deviceId: device.id,
          userId: auth.user.id,
          organizationId: auth.organizationId,
          action: "DEVICE_REGISTERED",
          status: "OK",
          message: "Device registered via SSO",
          details: { pairedVia: "SSO", deviceName: body.deviceName, platform: body.platform },
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
        }).catch(() => {})

        // Generate session token (no refresh token).
        const iat = Math.floor(now().getTime() / 1000)
        const exp = iat + ACCESS_TOKEN_TTL_SECONDS
        const token = signJwt({
          sub: auth.user.id,
          org: auth.organizationId,
          device: device.id,
          fingerprint: body.deviceFingerprint,
          iat,
          exp,
        })

        return {
          token,
          expiresAt: new Date(exp * 1000).toISOString(),
          user: {
            id: auth.user.id,
            organizationId: auth.organizationId,
          },
          subscription: subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              }
            : null,
        }
      },
      {
        body: t.Object({
          authorizationCode: t.Optional(t.String()),
          deviceName: t.String({ minLength: 1 }),
          deviceFingerprint: t.String({ minLength: 1 }),
          platform: t.String({ minLength: 1 }),
        }),
      }
    )
    .post(
      "/vpn/mobile/auth/refresh",
      async ({ request, set }) => {
        // Rate limit: 30/h per IP
        const rateResult = refreshRateLimiter(getClientIp(request))
        if (!rateResult.allowed) {
          set.status = 429
          set.headers = rateLimitHeaders(rateResult)
          return buildRateLimitResponse(rateResult)
        }

        // Deprecated endpoint.
        set.status = 410
        logAuditEvent({
          action: "AUTH_TOKEN_EXCHANGED",
          status: "FAILED",
          message: "Token refresh attempted on deprecated endpoint",
          errorMessage: "Token refresh is deprecated.",
        }).catch(() => {})
        return {
          error: {
            code: "GONE" as const,
            message:
              "Token refresh is deprecated. Please obtain a new session token via POST /vpn/mobile/auth/exchange.",
            details: {},
          },
        }
      },
      {
        body: t.Object({
          refreshToken: t.String({ minLength: 1 }),
        }),
      }
    )
}

export const mobileAuthRoutes = createMobileAuthRoutes()
