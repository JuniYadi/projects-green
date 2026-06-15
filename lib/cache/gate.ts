import { RedisCacheAdapter } from "@/lib/cache/redis-adapter"
import { DbCacheAdapter } from "@/lib/cache/db-adapter"
import type { CacheConfig } from "@/lib/cache/types"

const redisAdapter = new RedisCacheAdapter()
const dbAdapter = new DbCacheAdapter()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function retryRedisGet<T>(
  key: string,
  maxAttempts: number,
  delayMs: number
): Promise<T | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await redisAdapter.get<T>(key)
    if (result !== null) return result
    if (i < maxAttempts - 1) await sleep(delayMs)
  }
  return null
}

async function waitForLock(
  key: string,
  timeoutMs: number,
  pollMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const locked = await redisAdapter.acquireLock(key, timeoutMs / 1000)
    if (locked) return true
    await sleep(pollMs)
  }
  return false
}

export async function getOrFetch<T>(
  key: string,
  fetch: () => Promise<T>,
  config: CacheConfig
): Promise<T> {
  // 1. Try Redis GET
  const redisHit = await redisAdapter.get<T>(key)
  if (redisHit !== null) return redisHit

  // 2. Try gate lock
  const lockAcquired = await redisAdapter.acquireLock(key, config.ttl)

  if (lockAcquired) {
    try {
      // 2a. Call origin
      const value = await fetch()

      // 2b. Save to Redis
      await redisAdapter.set(key, value, config.ttl)

      // 2c. Save to DB
      await dbAdapter.set(key, value, config.ttl)

      // 2d. Return result
      return value
    } finally {
      // 2e. Release lock
      await redisAdapter.releaseLock(key)
    }
  }

  // 3. Lock not acquired — fallback strategies

  // 3a. Try DB GET — serve stale if not expired
  const dbHit = await dbAdapter.get<T>(key)
  if (dbHit !== null) return dbHit

  // 3b. Retry Redis GET (max 3, 100ms delay)
  const retryHit = await retryRedisGet<T>(key, 3, 100)
  if (retryHit !== null) return retryHit

  // 3c. Wait for lock (max 2s, poll 200ms)
  const lockObtained = await waitForLock(key, 2000, 200)
  if (lockObtained) {
    try {
      // Another worker may have populated cache — try Redis again
      const afterLockHit = await redisAdapter.get<T>(key)
      if (afterLockHit !== null) return afterLockHit

      // Then fetch origin
      const value = await fetch()
      await redisAdapter.set(key, value, config.ttl)
      await dbAdapter.set(key, value, config.ttl)
      return value
    } finally {
      await redisAdapter.releaseLock(key)
    }
  }

  // 4. Last resort: fetch origin (Redis likely down)
  const value = await fetch()
  await redisAdapter.set(key, value, config.ttl).catch(() => {})
  await dbAdapter.set(key, value, config.ttl).catch(() => {})
  return value
}
