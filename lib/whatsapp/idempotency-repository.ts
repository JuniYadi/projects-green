import Redis from "ioredis"
import { getWhatsAppBroadcastRedisConnection } from "@/lib/queue/whatsapp-broadcast"

const IDEMPOTENCY_TTL_SECONDS = 86_400
const IDEMPOTENCY_KEY_PREFIX = "wa:idempotency:"
const IDEMPOTENCY_KEY_PATTERN = `${IDEMPOTENCY_KEY_PREFIX}*`
const MAX_FALLBACK_SIZE = 10_000

// ponytail: synchronous Map check/set stays atomic within one event loop; fallback is process-local, so Redis remains required for cross-instance claims and TTL.
const fallbackEventIds = new Map<string, number>()
let redisClient: Redis | null = null

const getIdempotencyKey = (eventId: string) => {
  return `${IDEMPOTENCY_KEY_PREFIX}${eventId}`
}

const warnAndUseFallback = (action: string, err: unknown) => {
  console.warn(
    `[whatsapp-idempotency] Redis unavailable during ${action}; using in-memory fallback`,
    err
  )
}

const getRedisClient = () => {
  if (redisClient) {
    return redisClient
  }

  try {
    redisClient = new Redis({
      ...getWhatsAppBroadcastRedisConnection(),
      connectTimeout: 1_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
    return redisClient
  } catch (err) {
    warnAndUseFallback("connect", err)
    return null
  }
}

const getAvailableRedisClient = async () => {
  const redis = getRedisClient()

  if (!redis) {
    return null
  }

  try {
    if (redis.status === "wait") {
      await redis.connect()
    }
    return redis
  } catch (err) {
    warnAndUseFallback("connect", err)
    return null
  }
}

export async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const redis = await getAvailableRedisClient()

  if (!redis) {
    return fallbackEventIds.has(eventId)
  }

  try {
    const value = await redis.get(getIdempotencyKey(eventId))
    return value !== null
  } catch (err) {
    warnAndUseFallback("get", err)
    return fallbackEventIds.has(eventId)
  }
}

export async function markEventProcessed(eventId: string): Promise<void> {
  const redis = await getAvailableRedisClient()

  if (!redis) {
    if (fallbackEventIds.size >= MAX_FALLBACK_SIZE) {
      const now = Date.now()
      const cutoff = now - IDEMPOTENCY_TTL_SECONDS * 1000
      for (const [key, ts] of fallbackEventIds) {
        if (ts < cutoff) fallbackEventIds.delete(key)
      }
    }
    fallbackEventIds.set(eventId, Date.now())
    return
  }

  try {
    await redis.set(
      getIdempotencyKey(eventId),
      "1",
      "EX",
      IDEMPOTENCY_TTL_SECONDS
    )
  } catch (err) {
    warnAndUseFallback("set", err)
    if (fallbackEventIds.size >= MAX_FALLBACK_SIZE) {
      const now = Date.now()
      const cutoff = now - IDEMPOTENCY_TTL_SECONDS * 1000
      for (const [key, ts] of fallbackEventIds) {
        if (ts < cutoff) fallbackEventIds.delete(key)
      }
    }
    fallbackEventIds.set(eventId, Date.now())
  }
}
export async function claimProcessedEvent(eventId: string): Promise<boolean> {
  const redis = await getAvailableRedisClient()

  if (!redis) {
    if (fallbackEventIds.has(eventId)) return false
    fallbackEventIds.set(eventId, Date.now())
    return true
  }

  try {
    const result = await redis.set(
      getIdempotencyKey(eventId),
      "1",
      "EX",
      IDEMPOTENCY_TTL_SECONDS,
      "NX"
    )
    return result !== null
  } catch (err) {
    warnAndUseFallback("claim", err)
    if (fallbackEventIds.has(eventId)) return false
    fallbackEventIds.set(eventId, Date.now())
    return true
  }
}

/**
 * Acquires a short-lived "processing" claim on an arbitrary key (SET NX EX).
 * Unlike `claimProcessedEvent`, the caller supplies the full key and TTL, so
 * a single in-flight attempt can be claimed with a TTL shorter than a
 * permanent idempotency marker — long enough to cover one attempt, short
 * enough that a crashed process can't block a later retry forever.
 */
export async function acquireProcessingClaim(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  const redis = await getAvailableRedisClient()

  if (!redis) {
    if (fallbackEventIds.has(key)) return false
    fallbackEventIds.set(key, Date.now())
    return true
  }

  try {
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX")
    return result !== null
  } catch (err) {
    warnAndUseFallback("claim", err)
    if (fallbackEventIds.has(key)) return false
    fallbackEventIds.set(key, Date.now())
    return true
  }
}

/**
 * Releases a claim taken by `acquireProcessingClaim`, so a failed attempt
 * (one that threw before an outcome was delivered) can be retried instead
 * of being blocked by its own stale claim.
 */
export async function releaseProcessingClaim(key: string): Promise<void> {
  fallbackEventIds.delete(key)

  const redis = await getAvailableRedisClient()
  if (!redis) {
    return
  }

  try {
    await redis.del(key)
  } catch (err) {
    warnAndUseFallback("release", err)
  }
}

/**
 * Checks whether an arbitrary key marker (e.g. a "done" marker written by
 * `markClaimDone`) is set.
 */
export async function hasClaimMarker(key: string): Promise<boolean> {
  const redis = await getAvailableRedisClient()

  if (!redis) {
    return fallbackEventIds.has(key)
  }

  try {
    const value = await redis.get(key)
    return value !== null
  } catch (err) {
    warnAndUseFallback("get", err)
    return fallbackEventIds.has(key)
  }
}

/**
 * Writes a "done" marker for an arbitrary key with a caller-chosen TTL,
 * recording that an outcome was already delivered so a later retry of the
 * same key can be recognized as a duplicate.
 */
export async function markClaimDone(
  key: string,
  ttlSeconds: number
): Promise<void> {
  const redis = await getAvailableRedisClient()

  if (!redis) {
    fallbackEventIds.set(key, Date.now())
    return
  }

  try {
    await redis.set(key, "1", "EX", ttlSeconds)
  } catch (err) {
    warnAndUseFallback("set", err)
    fallbackEventIds.set(key, Date.now())
  }
}

export async function resetIdempotencyStore(): Promise<void> {
  fallbackEventIds.clear()

  const redis = await getAvailableRedisClient()
  if (!redis) {
    return
  }

  try {
    let cursor = "0"

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        IDEMPOTENCY_KEY_PATTERN,
        "COUNT",
        100
      )
      cursor = nextCursor

      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== "0")
  } catch (err) {
    warnAndUseFallback("reset", err)
  }
}

export const __testing = {
  getIdempotencyKey,
  resetRedisClient() {
    redisClient = null
  },
}
