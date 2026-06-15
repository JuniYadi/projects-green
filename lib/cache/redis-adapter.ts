import { redis } from "@/lib/redis"
import type { CacheStore, GateStore } from "@/lib/cache/types"

const GATE_PREFIX = "cache:gate:"

export class RedisCacheAdapter implements CacheStore, GateStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch (err) {
      console.error("[RedisCacheAdapter] get error:", err)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttl)
    } catch (err) {
      console.error("[RedisCacheAdapter] set error:", err)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (err) {
      console.error("[RedisCacheAdapter] del error:", err)
    }
  }

  async acquireLock(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await redis.set(
        `${GATE_PREFIX}${key}`,
        "1",
        "EX",
        ttl,
        "NX"
      )
      return result === "OK"
    } catch (err) {
      console.error("[RedisCacheAdapter] acquireLock error:", err)
      return false
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await redis.del(`${GATE_PREFIX}${key}`)
    } catch (err) {
      console.error("[RedisCacheAdapter] releaseLock error:", err)
    }
  }

  async checkLockExists(lockKey: string): Promise<boolean> {
    try {
      const result = await redis.exists(lockKey)
      return result === 1
    } catch (err) {
      console.error("[RedisCacheAdapter] checkLockExists error:", err)
      return true // Assume lock exists on error to avoid thundering herd
    }
  }
}
