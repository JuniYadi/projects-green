/**
 * Shared session JWT utilities for mobile auth.
 *
 * Extracted from mobile-auth.route.ts so both the pairing-claim and
 * subscription-login paths can sign sessions without importing from a route.
 */

import crypto from "node:crypto"

export const ACCESS_TOKEN_TTL_SECONDS = 604800 // 7 days

const MOBILE_SESSION_SECRET =
  process.env.MOBILE_SESSION_SECRET ?? process.env.JWT_SECRET ?? ""

const getSecret = (): string =>
  MOBILE_SESSION_SECRET ||
  (() => {
    throw new Error("Missing MOBILE_SESSION_SECRET or JWT_SECRET")
  })()

/**
 * Sign a mobile session JWT (HS256).
 * Low-level — accepts raw claims. Exists so the WorkOS auth/exchange route
 * can keep using sub=userId@orgId while the simplified paths use sub=deviceId.
 */
export function signSessionJwt(claims: {
  sub: string
  org: string
  device: string
  fingerprint: string
  iat: number
  exp: number
}): string {
  const secret = getSecret()
  const header = { alg: "HS256", typ: "JWT" }
  const headerSegment = Buffer.from(JSON.stringify(header)).toString("base64url")
  const payloadSegment = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const signingInput = `${headerSegment}.${payloadSegment}`
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url")
  return `${signingInput}.${signature}`
}

/**
 * Build session claims and sign in one call.
 * sub = deviceId (no WorkOS user), org = organizationId.
 * Returns { token, expiresAt } ready for API responses.
 */
export function createSessionToken(opts: {
  deviceId: string
  organizationId: string | null
  fingerprint: string
  now?: Date
}): { token: string; expiresAt: string } {
  const now = opts.now ?? new Date()
  const iat = Math.floor(now.getTime() / 1000)
  const exp = iat + ACCESS_TOKEN_TTL_SECONDS
  const token = signSessionJwt({
    sub: opts.deviceId,
    org: opts.organizationId ?? "",
    device: opts.deviceId,
    fingerprint: opts.fingerprint,
    iat,
    exp,
  })
  return { token, expiresAt: new Date(exp * 1000).toISOString() }
}
