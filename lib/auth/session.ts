import { createWorkOS } from "@workos-inc/node"
import type { User } from "@workos-inc/node"

import { prisma } from "@/lib/prisma"
import type { AuthApiKeyEnvironment } from "@prisma/client"
import { hashApiKey } from "@/lib/whatsapp/crypto"
import type { PlatformScope } from "./types"

// ─── WorkOS session resolver ─────────────────────────────────────────────────
//
// The sealed session cookie ("wos-session" by default, configurable via
// WORKOS_COOKIE_NAME) is created by the WorkOS AuthKit middleware in
// proxy.ts and by modules/auth/auth.service.ts during login flows.
// This module validates it; it does NOT create it.

let _workos: ReturnType<typeof createWorkOS> | null = null

const getWorkOSClient = () => {
  if (!_workos) {
    _workos = createWorkOS({
      apiKey: process.env.WORKOS_API_KEY ?? "",
      clientId: process.env.WORKOS_CLIENT_ID ?? "",
    })
  }
  return _workos
}

/**
 * Resolve a WorkOS user from a request by calling the WorkOS SDK's
 * `authenticateWithSessionCookie` — the single source of truth for
 * session validation.
 *
 * Flow:
 *  1. Extract the sealed session cookie from the request.
 *  2. Call workos.userManagement.authenticateWithSessionCookie() which
 *     internally unseals, verifies the JWT against WorkOS JWKS, and
 *     optionally refreshes the session.
 *  3. If authenticated, return the WorkOS User object.
 *
 * Also handles Bearer "wos_xxx" tokens (sealed session passed via
 * Authorization header) for API clients.
 */
export const getWorkOSSession = async (
  request: Request
): Promise<User | null> => {
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD?.trim()
  if (!cookiePassword) return null

  // 1. Extract sealed session data from cookie or Bearer header
  const authHeader = request.headers.get("Authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null

  let sessionData: string | null = null

  if (bearerToken && bearerToken.startsWith("wos_")) {
    // Sealed session passed as Bearer token
    sessionData = bearerToken
  } else {
    // Sealed session from cookie
    const cookieName = process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session"
    const rawCookies = request.headers.get("Cookie") ?? ""
    const cookies = Object.fromEntries(
      rawCookies.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=")
        return [k, v.join("=")]
      })
    )
    sessionData = cookies[cookieName] ?? null
  }

  if (!sessionData) return null

  // 2. Validate via WorkOS SDK
  try {
    const workos = getWorkOSClient()
    const result = await workos.userManagement.authenticateWithSessionCookie({
      sessionData,
      cookiePassword,
    })

    if (!result.authenticated) return null

    return result.user as User
  } catch {
    return null
  }
}

// ─── API key resolver ──────────────────────────────────────────────────────────

const API_KEY_HASH_SALT = () =>
  process.env.API_KEY_HASH_SALT?.trim() || DEFAULT_SALT

const API_KEY_PREFIXES = {
  SANDBOX: "test_",
  LIVE: "live_",
} as const

const DEFAULT_SALT = "dev-salt-change-me"

function isDefaultSalt(): boolean {
  const salt = process.env.API_KEY_HASH_SALT?.trim()
  return !salt || salt === DEFAULT_SALT
}

export const resolveApiKey = async (
  rawKey: string,
  clientIp?: string
): Promise<PlatformScope | null> => {
  if (process.env.NODE_ENV === "production" && isDefaultSalt()) {
    console.error(
      "[api-key] CRITICAL: API_KEY_HASH_SALT must be set in production. Refusing to resolve API key."
    )
    return null
  }

  let environment: AuthApiKeyEnvironment = "LIVE"
  let normalizedKey = rawKey

  if (rawKey.startsWith(API_KEY_PREFIXES.SANDBOX)) {
    environment = "SANDBOX"
    normalizedKey = rawKey.slice(API_KEY_PREFIXES.SANDBOX.length)
  } else if (rawKey.startsWith(API_KEY_PREFIXES.LIVE)) {
    normalizedKey = rawKey.slice(API_KEY_PREFIXES.LIVE.length)
  }

  const salt = API_KEY_HASH_SALT()
  const keyHash = await hashApiKey(normalizedKey, salt)

  const apiKey = await prisma.authApiKey.findFirst({
    where: {
      keyHash,
      environment: environment,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  if (!apiKey) return null

  prisma.authApiKey
    .update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: clientIp ?? null,
      },
    })
    .catch(() => {})

  return {
    type: "platform",
    keyId: apiKey.id,
    keyName: apiKey.name,
    organizationId: apiKey.organizationId,
    environment: apiKey.environment as AuthApiKeyEnvironment,
    scopes: apiKey.scopes as string[],
  }
}

export const extractBearerToken = (request: Request): string | null => {
  const auth = request.headers.get("Authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  return token || null
}
