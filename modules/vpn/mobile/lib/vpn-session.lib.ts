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
 * Accepts raw claims so callers can inject via DI for testability.
 */
export function signSessionJwt(claims: {
  sub: string
  org: string
  device: string
  fingerprint: string
  iat: number
  exp: number
  typ: "mobile-session"
}): string {
  const secret = getSecret()
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
