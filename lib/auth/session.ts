import { createWorkOS } from "@workos-inc/node"
import type { User } from "@workos-inc/node"
import { unsealData } from "iron-session"

import { prisma } from "@/lib/prisma"
import type { ApiKeyEnvironment } from "@prisma/client"
import { hashApiKey } from "@/lib/whatsapp/crypto"
import type { PlatformScope } from "./types"

// ─── WorkOS session resolver ─────────────────────────────────────────────────

export const getWorkOSSession = async (
  request: Request
): Promise<User | null> => {
  const authHeader = request.headers.get("Authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null

  if (bearerToken) {
    if (bearerToken.startsWith("wos_")) {
      try {
        const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD?.trim()
        if (!cookiePassword) return null
        const sessionPayload = await unsealData(bearerToken, {
          password: cookiePassword,
        })
        if (
          sessionPayload &&
          typeof sessionPayload === "object" &&
          "user" in sessionPayload
        ) {
          return (sessionPayload as { user: User }).user
        }
      } catch {
        return null
      }
    }
  }

  const cookieName =
    process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session"
  const rawCookies = request.headers.get("Cookie") ?? ""
  const cookies = Object.fromEntries(
    rawCookies.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=")
      return [k, v.join("=")]
    })
  )
  const sealedSession = cookies[cookieName]
  if (!sealedSession) return null

  try {
    const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD?.trim()
    if (!cookiePassword) return null
    const sessionPayload = await unsealData(sealedSession, {
      password: cookiePassword,
    })
    if (
      sessionPayload &&
      typeof sessionPayload === "object" &&
      "user" in sessionPayload
    ) {
      return (sessionPayload as { user: User }).user ?? null
    }
    return null
  } catch {
    return null
  }
}

// ─── API key resolver ──────────────────────────────────────────────────────────

const API_KEY_HASH_SALT = () =>
  process.env.API_KEY_HASH_SALT?.trim() ?? "dev-salt-change-me"

const API_KEY_PREFIXES = {
  SANDBOX: "test_",
  LIVE: "live_",
} as const

export const resolveApiKey = async (
  rawKey: string,
  clientIp?: string
): Promise<PlatformScope | null> => {
  let environment: ApiKeyEnvironment = "LIVE"
  let normalizedKey = rawKey

  if (rawKey.startsWith(API_KEY_PREFIXES.SANDBOX)) {
    environment = "SANDBOX"
    normalizedKey = rawKey.slice(API_KEY_PREFIXES.SANDBOX.length)
  } else if (rawKey.startsWith(API_KEY_PREFIXES.LIVE)) {
    normalizedKey = rawKey.slice(API_KEY_PREFIXES.LIVE.length)
  }

  const salt = API_KEY_HASH_SALT()
  const keyHash = await hashApiKey(normalizedKey, salt)

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      environment: environment,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  if (!apiKey) return null

  prisma.apiKey
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
    environment: apiKey.environment as ApiKeyEnvironment,
    scopes: apiKey.scopes as string[],
  }
}

export const extractBearerToken = (request: Request): string | null => {
  const auth = request.headers.get("Authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  return token || null
}
