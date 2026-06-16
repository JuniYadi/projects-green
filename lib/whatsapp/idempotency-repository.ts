import Redis from "ioredis"
import { getWhatsAppBroadcastRedisConnection } from "@/lib/queue/whatsapp-broadcast"

const IDEMPOTENCY_TTL_SECONDS = 86_400
const IDEMPOTENCY_KEY_PREFIX = "wa:idempotency:"
const IDEMPOTENCY_KEY_PATTERN = `${IDEMPOTENCY_KEY_PREFIX}*`
const MAX_FALLBACK_SIZE = 10_000

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
