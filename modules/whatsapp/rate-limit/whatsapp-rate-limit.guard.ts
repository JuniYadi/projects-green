import { Elysia } from "elysia"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { getClientIp } from "@/lib/rate-limit"
import { redis } from "@/lib/redis"
export type RedisClient = typeof redis

export type WhatsappRateLimitTier =
  "messaging" | "standard" | "heavy" | "anonymous" | "read"

export type RateLimitTierConfig = {
  windowMs: number
  max: number
  name: string
}

export const WHATSAPP_RATE_LIMIT_TIERS: Record<
  WhatsappRateLimitTier,
  RateLimitTierConfig
> = {
  read: {
    windowMs: 60_000,
    max: 300,
    name: "WhatsApp Read Operations",
  },
  messaging: {
    windowMs: 60_000,
    max: 120,
    name: "WhatsApp Messaging",
  },
  standard: {
    windowMs: 60_000,
    max: 60,
    name: "WhatsApp Standard API",
  },
  heavy: {
    windowMs: 60_000,
    max: 30,
    name: "WhatsApp Meta Operations",
  },
  anonymous: {
    windowMs: 60_000,
    max: 15,
    name: "WhatsApp Anonymous Access",
  },
}

export type RateLimitEvaluationResult = {
  allowed: boolean
  remaining: number
  resetMs: number
  limit: number
  tier: WhatsappRateLimitTier
}

// In-memory fallback sliding window store
const memoryStore = new Map<string, number[]>()
let cleanupCounter = 0
let testingRedisClient: typeof redis | null | undefined = undefined

export function setTestingRedisClient(
  client: typeof redis | null | undefined
): void {
  testingRedisClient = client
}

export function resetWhatsappRateLimitStore(): void {
  memoryStore.clear()
  cleanupCounter = 0
  testingRedisClient = undefined
}

/**
 * Atomic sliding-window rate limit evaluation.
 * Uses Redis sorted sets when available; falls back to in-memory sliding window.
 */
export async function evaluateWhatsappRateLimit(
  key: string,
  tier: WhatsappRateLimitTier,
  customConfig?: RateLimitTierConfig
): Promise<RateLimitEvaluationResult> {
  const config = customConfig ?? WHATSAPP_RATE_LIMIT_TIERS[tier]
  const { windowMs, max } = config
  const now = Date.now()
  const windowStart = now - windowMs

  const activeRedis =
    testingRedisClient !== undefined ? testingRedisClient : redis

  // 1. Try Redis sliding-window if available
  if (activeRedis && activeRedis.status === "ready") {
    try {
      const redisKey = `ratelimit:wa:${key}`
      const member = `${now}:${Math.random().toString(36).slice(2, 8)}`

      // Sliding window using Redis multi/pipeline
      const pipeline = activeRedis.pipeline()
      pipeline.zremrangebyscore(redisKey, 0, windowStart)
      pipeline.zcard(redisKey)
      pipeline.zadd(redisKey, now, member)
      pipeline.pexpire(redisKey, windowMs)

      const results = await pipeline.exec()
      const currentCount = Number(results?.[1]?.[1] ?? 0)

      if (currentCount >= max) {
        // Rollback this request member so we don't inflate counts
        await activeRedis.zrem(redisKey, member).catch(() => {})
        return {
          allowed: false,
          remaining: 0,
          resetMs: now + windowMs,
          limit: max,
          tier,
        }
      }

      return {
        allowed: true,
        remaining: Math.max(0, max - currentCount - 1),
        resetMs: now + windowMs,
        limit: max,
        tier,
      }
    } catch {
      // Fall through to memoryStore on any Redis failure
    }
  }

  // 2. In-memory sliding window fallback
  let timestamps = memoryStore.get(key)
  if (timestamps) {
    timestamps = timestamps.filter((t) => t > windowStart)
    if (timestamps.length === 0) {
      memoryStore.delete(key)
    } else {
      memoryStore.set(key, timestamps)
    }
  }

  // Periodic cleanup of stale entries
  cleanupCounter++
  if (cleanupCounter % 100 === 0) {
    for (const [k, ts] of memoryStore) {
      const active = ts.filter((t) => t > windowStart)
      if (active.length === 0) memoryStore.delete(k)
      else memoryStore.set(k, active)
    }
  }

  if (!timestamps || timestamps.length === 0) {
    memoryStore.set(key, [now])
    return {
      allowed: true,
      remaining: max - 1,
      resetMs: now + windowMs,
      limit: max,
      tier,
    }
  }

  if (timestamps.length >= max) {
    const oldest = timestamps[0]!
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldest + windowMs,
      limit: max,
      tier,
    }
  }

  timestamps.push(now)
  memoryStore.set(key, timestamps)
  const oldest = timestamps[0]!

  return {
    allowed: true,
    remaining: max - timestamps.length,
    resetMs: oldest + windowMs,
    limit: max,
    tier,
  }
}

/**
 * Classify incoming route and method into appropriate rate-limit tier.
 */
export function classifyWhatsappRouteTier(
  path: string,
  method: string,
  hasOrgAuth: boolean
): WhatsappRateLimitTier | "exempt" {
  // Normalize path by stripping /api prefix (if present) and trailing slash
  let normalized = path.replace(/^\/api(?=\/|$)/, "")
  if (normalized.endsWith("/") && normalized.length > 1) {
    normalized = normalized.slice(0, -1)
  }
  // 1. Exempt routes (Webhooks from Meta, internal health/status)
  if (
    normalized.startsWith("/whatsapp/webhooks") ||
    normalized.startsWith("/whatsapp/meta-webhook") ||
    normalized === "/whatsapp/rate-limit/status"
  ) {
    return "exempt"
  }

  // 2. Unauthenticated / Anonymous callers are strictly capped at 15 RPM
  if (!hasOrgAuth) {
    return "anonymous"
  }

  const upperMethod = method.toUpperCase()

  // 3. Heavy Meta Graph operations (30 RPM)
  if (
    (normalized.startsWith("/whatsapp/media") && upperMethod === "POST") ||
    (normalized.startsWith("/whatsapp/templates") &&
      (upperMethod === "POST" || upperMethod === "DELETE")) ||
    (normalized.startsWith("/whatsapp/devices") &&
      normalized.includes("/profile") &&
      (upperMethod === "POST" || upperMethod === "PATCH")) ||
    (normalized.startsWith("/whatsapp/devices") &&
      (normalized.includes("/token") ||
        normalized.includes("/register") ||
        normalized.includes("/deregister"))) ||
    (normalized.startsWith("/whatsapp/broadcasts") && upperMethod === "POST")
  ) {
    return "heavy"
  }

  // 4. Messaging Tier (120 RPM)
  if (
    (normalized === "/whatsapp/messages" ||
      normalized.startsWith("/whatsapp/messages/") ||
      normalized.startsWith("/whatsapp/workflow/")) &&
    upperMethod === "POST"
  ) {
    return "messaging"
  }
  // 5. Read-only Tier (300 RPM)
  if (upperMethod === "GET" || upperMethod === "HEAD") {
    return "read"
  }

  // 6. Standard CRUD Tier (60 RPM)
  return "standard"
}

export const whatsappRateLimitPlugin = new Elysia({
  name: "whatsapp.rate-limit",
}).onBeforeHandle({ as: "scoped" }, async ({ request, set, path }) => {
  const auth = await resolveAuthContext(request)
  const hasOrg = Boolean(auth?.organizationId)
  const tier = classifyWhatsappRouteTier(path, request.method, hasOrg)

  if (tier === "exempt") {
    return
  }

  const rateKey = hasOrg
    ? `${tier}:org:${auth!.organizationId}`
    : `anon:ip:${getClientIp(request)}`

  const result = await evaluateWhatsappRateLimit(rateKey, tier)

  // Append standard rate-limiting response headers
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.resetMs - Date.now()) / 1000)
  )

  set.headers["X-RateLimit-Limit"] = String(result.limit)
  set.headers["X-RateLimit-Remaining"] = String(result.remaining)
  set.headers["X-RateLimit-Reset"] = String(result.resetMs)

  if (!result.allowed) {
    set.status = 429
    set.headers["Retry-After"] = String(retryAfterSeconds)

    return {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        details: {
          tier: result.tier,
          limit: result.limit,
          windowSeconds: 60,
          retryAfterSeconds,
        },
      },
    }
  }
})
