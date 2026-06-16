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
  VpnMobileDeviceService,
  vpnMobileDeviceService,
} from "@/modules/vpn/mobile/vpn-mobile-device.service"

const MOBILE_SESSION_SECRET =
  process.env.MOBILE_SESSION_SECRET ?? process.env.JWT_SECRET ?? ""

const ACCESS_TOKEN_TTL_SECONDS = 86400 // 24 hours
const REFRESH_TOKEN_TTL_SECONDS = 2592000 // 30 days

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
  const deviceService =
    deps.deviceService ?? vpnMobileDeviceService
  const now = deps.now ?? (() => new Date())
  const signJwt = deps.signJwt ?? signSessionJwt

  return new Elysia()
    .post(
      "/vpn/mobile/auth/exchange",
      async ({ body, set }) => {
        // Authenticate user via WorkOS (or injected auth for tests).
        const auth = deps.authenticate
          ? await deps.authenticate()
          : await (async () => {
              // Use default WorkOS auth — but we skip importing
              // withAuth here to keep this side-effect free at
              // import time. The real auth happens at request time.
              const { withAuth } = await import(
                "@workos-inc/authkit-nextjs"
              )
              return withAuth()
            })()

        if (!auth.user) return unauthorized(set)
        if (!auth.organizationId) {
          set.status = 403
          return {
            error: {
              code: "FORBIDDEN" as const,
              message:
                "No active organization found.",
              details: {},
            },
          }
        }

        // Find or create the device via upsert.
        let device: {
          id: string
          status: string
        }
        try {
          device = await deviceService.create({
            subscriptionId: "", // Will be resolved from user's subscription
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
            error instanceof Error
              ? error.message
              : String(error)
          )
          set.status = 500
          return {
            error: {
              code: "INTERNAL_ERROR" as const,
              message:
                "Device registration failed.",
              details: {},
            },
          }
        }

        // Find the user's active subscription.
        const subscription =
          await prisma.vpnSubscription.findFirst({
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

        // Generate session token.
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

        // Generate refresh token.
        const refreshToken = crypto.randomUUID()
        const refreshExp = new Date(
          now().getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000
        )

        // Store refresh token (hashed) in DB.
        const refreshTokenHash = crypto
          .createHash("sha256")
          .update(refreshToken)
          .digest("hex")

        // Use a simple key-value approach — store in a generic
        // token table or metadata. For now, store in device record
        // metadata via a separate mechanism.
        // For simplicity in this phase, we return the refresh token
        // without persistence (server-side refresh validation will be
        // added in a follow-up). The PRD specifies this as a 30-day
        // refresh with rotation.

        return {
          token,
          refreshToken,
          expiresAt: new Date(exp * 1000).toISOString(),
          user: {
            id: auth.user.id,
            organizationId: auth.organizationId,
          },
          subscription: subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                currentPeriodEnd:
                  subscription.currentPeriodEnd.toISOString(),
              }
            : null,
        }
      },
      {
        body: t.Object({
          deviceName: t.String({ minLength: 1 }),
          deviceFingerprint: t.String({ minLength: 1 }),
          platform: t.String({ minLength: 1 }),
        }),
      }
    )
    .post(
      "/vpn/mobile/auth/refresh",
      async ({ body, set }) => {
        // Validate refresh token.
        if (!body.refreshToken || body.refreshToken.length < 10) {
          set.status = 401
          return {
            error: {
              code: "TOKEN_INVALID" as const,
              message:
                "Invalid or expired refresh token.",
              details: {},
            },
          }
        }

        // In a full implementation, we'd look up the hashed refresh
        // token in DB, validate it, then rotate. For this phase,
        // return a new token pair.
        // The mobile app will call refresh when it gets a 401.

        const iat = Math.floor(now().getTime() / 1000)
        const exp = iat + ACCESS_TOKEN_TTL_SECONDS
        const newRefreshToken = crypto.randomUUID()

        // Without a persisted session, we return a limited-scope
        // response. Full refresh token rotation will be implemented
        // in Phase 8 (security hardening).

        return {
          token: "", // Placeholder — full implementation in Phase 8
          refreshToken: newRefreshToken,
          expiresAt: new Date(exp * 1000).toISOString(),
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
