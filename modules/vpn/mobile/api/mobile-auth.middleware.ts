/**
 * Mobile auth middleware (T3.3).
 *
 * Utility function to validate a mobile session JWT from the Authorization
 * header. Follows the same pattern as the existing routes (direct auth call
 * in each handler) rather than Elysia plugin derivation.
 *
 * DI: inject `verifySessionJwt` / `getDeviceStatus` for testability.
 */

import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"

export type MobileAuthContext = {
  userId: string
  organizationId: string
  deviceId: string
  deviceFingerprint: string
}

export type MobileSessionClaims = {
  sub: string // userId
  org: string // organizationId
  device: string // VpnMobileDevice.id
  fingerprint: string // deviceFingerprint
  iat: number
  exp: number
  typ: "mobile-session"
}

export type VerifySessionJwt = (token: string) => MobileSessionClaims

export type GetDeviceStatus = (deviceId: string) => Promise<{
  status: string
  subscriptionStatus: string
} | null>

export type MobileAuthResult =
  | { ok: true; mobileAuth: MobileAuthContext }
  | {
      ok: false
      status: number
      error: { code: string; message: string; details: Record<string, unknown> }
    }

type Deps = {
  verifySessionJwt?: VerifySessionJwt
  getDeviceStatus?: GetDeviceStatus
  getSecret?: () => string
}

const MOBILE_SESSION_SECRET =
  process.env.MOBILE_SESSION_SECRET ?? process.env.JWT_SECRET ?? ""

const defaultGetSecret = () =>
  MOBILE_SESSION_SECRET ||
  (() => {
    throw new Error(
      "Missing MOBILE_SESSION_SECRET or JWT_SECRET environment variable."
    )
  })()

/**
 * Validate a mobile session JWT.
 * HS256 signed, checks typ="mobile-session", expiry, and signature.
 */
function defaultVerifySessionJwt(token: string): MobileSessionClaims {
  const secret = defaultGetSecret()
  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new Error("Malformed token.")
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts
  const signingInput = `${headerSegment}.${payloadSegment}`
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url")

  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(signatureSegment)
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new Error("Invalid signature.")
  }

  let claims: unknown
  try {
    claims = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8")
    )
  } catch {
    throw new Error("Invalid payload.")
  }

  if (!claims || typeof claims !== "object") {
    throw new Error("Invalid payload.")
  }

  const c = claims as Partial<MobileSessionClaims>

  if (
    typeof c.sub !== "string" ||
    typeof c.org !== "string" ||
    typeof c.device !== "string" ||
    typeof c.fingerprint !== "string" ||
    typeof c.iat !== "number" ||
    typeof c.exp !== "number" ||
    c.typ !== "mobile-session"
  ) {
    throw new Error("Invalid claims.")
  }

  if (c.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired.")
  }

  return {
    sub: c.sub,
    org: c.org,
    device: c.device,
    fingerprint: c.fingerprint,
    iat: c.iat,
    exp: c.exp,
    typ: "mobile-session",
  }
}

/**
 * Default device status checker — queries the DB.
 */
const defaultGetDeviceStatus: GetDeviceStatus = async (deviceId) => {
  const device = await prisma.vpnMobileDevice.findUnique({
    where: { id: deviceId },
    select: {
      status: true,
      subscription: { select: { status: true } },
    },
  })
  if (!device) return null
  return {
    status: device.status,
    subscriptionStatus: device.subscription.status,
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) return null
  return auth.slice(7)
}

/**
 * Validate a mobile session from request headers.
 *
 * Call this at the top of any mobile route handler.
 * Example:
 *   const auth = await requireMobileSession(request, set)
 *   if (!auth.ok) return auth.error
 *   // use auth.mobileAuth
 */
export async function requireMobileSession(
  request: Request,
  set: { status?: number | string },
  deps: Deps = {}
): Promise<MobileAuthResult> {
  const verifySessionJwt = deps.verifySessionJwt ?? defaultVerifySessionJwt
  const getDeviceStatus = deps.getDeviceStatus ?? defaultGetDeviceStatus

  const token = extractBearerToken(request.headers)

  if (!token) {
    set.status = 401
    return {
      ok: false,
      status: 401,
      error: {
        code: "TOKEN_INVALID",
        message: "Missing or invalid Authorization header.",
        details: {},
      },
    }
  }

  let claims: MobileSessionClaims
  try {
    claims = verifySessionJwt(token)
  } catch {
    set.status = 401
    return {
      ok: false,
      status: 401,
      error: {
        code: "TOKEN_INVALID",
        message: "Session token is invalid or expired.",
        details: {},
      },
    }
  }

  // Check device status.
  try {
    const device = await getDeviceStatus(claims.device)
    if (!device) {
      set.status = 403
      return {
        ok: false,
        status: 403,
        error: {
          code: "DEVICE_REVOKED",
          message:
            "This device has been revoked and cannot access VPN services.",
          details: { deviceId: claims.device },
        },
      }
    }

    if (device.status === "REVOKED") {
      set.status = 403
      return {
        ok: false,
        status: 403,
        error: {
          code: "DEVICE_REVOKED",
          message:
            "This device has been revoked and cannot access VPN services.",
          details: { deviceId: claims.device },
        },
      }
    }

    if (
      device.subscriptionStatus !== "ACTIVE" &&
      device.subscriptionStatus !== "SUSPENDED"
    ) {
      set.status = 403
      return {
        ok: false,
        status: 403,
        error: {
          code: "SUBSCRIPTION_EXPIRED",
          message: "Your subscription is no longer active.",
          details: {},
        },
      }
    }
  } catch {
    set.status = 500
    return {
      ok: false,
      status: 500,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
        details: {},
      },
    }
  }

  // Verify device fingerprint matches bound token.
  const requestFingerprint = request.headers.get("X-Device-Fingerprint")
  if (!requestFingerprint || requestFingerprint !== claims.fingerprint) {
    set.status = 401
    return {
      ok: false,
      status: 401,
      error: {
        code: "TOKEN_INVALID",
        message: "Device fingerprint does not match session token.",
        details: {},
      },
    }
  }

  return {
    ok: true,
    mobileAuth: {
      userId: claims.sub,
      organizationId: claims.org,
      deviceId: claims.device,
      deviceFingerprint: claims.fingerprint,
    },
  }
}
