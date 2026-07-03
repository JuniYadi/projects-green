/**
 * Mobile auth routes (T3.1-T3.2).
 *
 * POST /api/vpn/mobile/auth/exchange — Exchange WorkOS OAuth code for a mobile session token.
 * POST /api/vpn/mobile/auth/refresh — Refresh an expired session token.
 */

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

import {
  ACCESS_TOKEN_TTL_SECONDS,
  signSessionJwt,
} from "@/modules/vpn/mobile/lib/vpn-session.lib"

// Rate limiters
const exchangeRateLimiter = createRateLimiter({
  windowMs: 3600_000,
  max: 10,
})
const loginRateLimiter = createRateLimiter({
  windowMs: 3600_000,
  max: 10,
})
const refreshRateLimiter = createRateLimiter({
  windowMs: 3600_000,
  max: 30,
})

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
  const errorResponse = t.Object({
    error: t.Object({
      code: t.String(),
      message: t.String(),
      details: t.Object({}, { additionalProperties: true }),
    }),
  })

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
          const apiKey = process.env.WORKOS_API_KEY
          const clientId = process.env.WORKOS_CLIENT_ID
          if (!apiKey || !clientId) {
            // ponytail: explicit check avoids cryptic SDK errors
            throw new Error("Authentication provider configuration error.")
          }
          const exchange = deps.exchangeCode ?? (async (code: string) => {
            const { createWorkOS } = await import("@workos-inc/node")
            // ponytail: direct import, lazy at request time — avoids side effects at module load
            const workos = createWorkOS({ apiKey, clientId })
            const result = await workos.userManagement.authenticateWithCode({
              code,
              clientId,
            })
            return { user: result.user, organizationId: result.organizationId ?? null }
          })
          try {
            auth = await exchange(body.authorizationCode)
            logAuditEvent({
              action: "AUTH_CODE_EXCHANGE",
              status: "OK",
              message: "Authorization code exchanged successfully",
              ip: getClientIp(request),
              userAgent: request.headers.get("user-agent"),
            }).catch(() => {})
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
          const err = error as Error & { name?: string }
          if (err.name === "VpnMobileDeviceLimitError") {
            set.status = 403
            logAuditEvent({
              action: "AUTH_CODE_EXCHANGE",
              status: "FAILED",
              message: "Device limit reached",
              ip: getClientIp(request),
              userAgent: request.headers.get("user-agent"),
            }).catch(() => {})
            return {
              error: {
                code: "DEVICE_LIMIT_REACHED" as const,
                message:
                  "The maximum number of devices for this subscription has been reached. Please remove an existing device before adding a new one.",
                details: {},
              },
            }
          }
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
          typ: "mobile-session",
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
        detail: {
          tags: ["VPN Mobile Auth"],
          summary: "Authenticate via SSO authorization code",
          description: "Exchange WorkOS OAuth authorization code for a mobile session JWT token. Returns user info, subscription status, and device registration.",
        },
        body: t.Object({
          authorizationCode: t.Optional(t.String({ minLength: 10 })),
          deviceName: t.String({ minLength: 1 }),
          deviceFingerprint: t.String({ minLength: 1 }),
          platform: t.String({ minLength: 1 }),
        }),
        response: {
          200: t.Object({
            token: t.String(),
            expiresAt: t.String(),
            user: t.Object({
              id: t.String(),
              organizationId: t.String(),
            }),
            subscription: t.Nullable(
              t.Object({
                id: t.String(),
                status: t.String(),
                currentPeriodEnd: t.String(),
              })
            ),
          }),
          401: errorResponse,
          403: errorResponse,
          429: errorResponse,
        },
      }
    )
    /**
     * Path B: Subscription ID → Session Token
     *
     * POST /vpn/mobile/auth/login
     * Auth: None (the subscriptionId is the authorization).
     * Returns same session shape as /pairing/claim.
     */
    .post(
      "/vpn/mobile/auth/login",
      async ({ body, request, set }) => {
        // Rate limit: 10/h per IP
        const rateResult = loginRateLimiter(getClientIp(request))
        if (!rateResult.allowed) {
          set.status = 429
          set.headers = rateLimitHeaders(rateResult)
          return buildRateLimitResponse(rateResult)
        }

        // Validate subscription exists.
        const subscription = await prisma.vpnSubscription.findUnique({
          where: { id: body.subscriptionId },
        })
        if (!subscription) {
          set.status = 404
          logAuditEvent({
            action: "AUTH_MOBILE_LOGIN",
            status: "FAILED",
            message: "Subscription not found",
            subscriptionId: body.subscriptionId,
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent"),
          }).catch(() => {})
          return {
            error: {
              code: "NOT_FOUND" as const,
              message: "Subscription not found.",
              details: {},
            },
          }
        }

        // Validate subscription is active.
        if (subscription.status !== "ACTIVE") {
          set.status = 400
          logAuditEvent({
            action: "AUTH_MOBILE_LOGIN",
            status: "FAILED",
            message: "Subscription not active",
            subscriptionId: body.subscriptionId,
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent"),
          }).catch(() => {})
          return {
            error: {
              code: "SUBSCRIPTION_NOT_ACTIVE" as const,
              message: "Subscription is not active.",
              details: {},
            },
          }
        }

        // Find or create device.
        let device: { id: string; status: string }
        try {
          device = await deviceService.create({
            subscriptionId: subscription.id,
            organizationId: subscription.organizationId,
            deviceName: body.deviceName,
            deviceFingerprint: body.deviceFingerprint,
            platform: body.platform,
            osVersion: body.osVersion ?? null,
            appVersion: body.appVersion ?? null,
            pairedVia: "QR", // ponytail: no SSO on this path, QR is closest generic
          })
        } catch (error) {
          const err = error as Error & { name?: string }
          if (err.name === "VpnMobileDeviceLimitError") {
            set.status = 403
            logAuditEvent({
              action: "AUTH_MOBILE_LOGIN",
              status: "FAILED",
              message: "Device limit reached",
              subscriptionId: body.subscriptionId,
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
          logAuditEvent({
            action: "AUTH_MOBILE_LOGIN",
            status: "FAILED",
            message: "Device registration failed",
            errorMessage: error instanceof Error ? error.message : String(error),
            subscriptionId: body.subscriptionId,
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent"),
          }).catch(() => {})
          set.status = 500
          return {
            error: {
              code: "INTERNAL_ERROR" as const,
              message: "Device registration failed.",
              details: {},
            },
          }
        }

        // Fetch server accounts for profiles.
        const accounts = await prisma.vpnServerAccount.findMany({
          where: { subscriptionId: subscription.id },
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

        // Generate session JWT.
        const iat = Math.floor(now().getTime() / 1000)
        const exp = iat + ACCESS_TOKEN_TTL_SECONDS
        const token = signJwt({
          sub: device.id,
          org: subscription.organizationId,
          device: device.id,
          fingerprint: body.deviceFingerprint,
          iat,
          exp,
          typ: "mobile-session",
        })

        // Audit: log success.
        logAuditEvent({
          deviceId: device.id,
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          action: "AUTH_MOBILE_LOGIN",
          status: "OK",
          message: "Mobile login via subscription ID",
          details: { deviceName: body.deviceName, platform: body.platform },
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
        }).catch(() => {})

        return {
          token,
          expiresAt: new Date(exp * 1000).toISOString(),
          subscription: {
            id: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          },
          profiles: accounts.map((account) => ({
            id: account.id,
            serverName: account.server.name,
            hostname: account.server.hostname,
            serverIp: account.server.ipAddress,
            protocol: account.protocol,
            region: account.server.region.name,
            status: account.provisioningStatus,
          })),
        }
      },
      {
        detail: {
          tags: ["VPN Mobile Auth"],
          summary: "Login with subscription ID",
          description: "Authenticate using a subscription ID directly (paired via QR flow). Returns session token, subscription info, and available VPN profiles.",
        },
        body: t.Object({
          subscriptionId: t.String({ minLength: 1 }),
          deviceName: t.String({ minLength: 1 }),
          deviceFingerprint: t.String({ minLength: 1 }),
          platform: t.String({ minLength: 1 }),
          osVersion: t.Optional(t.String()),
          appVersion: t.Optional(t.String()),
        }),
        response: {
          200: t.Object({
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
        detail: {
          tags: ["VPN Mobile Auth"],
          summary: "Refresh session token (deprecated)",
          description: "Deprecated. Returns 410 Gone — obtain a fresh token via POST /vpn/mobile/auth/exchange.",
        },
        body: t.Object({
          refreshToken: t.String({ minLength: 1 }),
        }),
        response: {
          410: errorResponse,
        },
      }
    )
}

export const mobileAuthRoutes = createMobileAuthRoutes()
