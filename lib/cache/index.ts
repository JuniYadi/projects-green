import { getOrFetch as gateGetOrFetch } from "@/lib/cache/gate"
import type { CacheConfig } from "@/lib/cache/types"
import { RedisCacheAdapter } from "@/lib/cache/redis-adapter"
import { DbCacheAdapter } from "@/lib/cache/db-adapter"

const DEFAULT_TTL = Number(process.env.CACHE_TTL_SECONDS ?? "3600")

const redisAdapter = new RedisCacheAdapter()
const dbAdapter = new DbCacheAdapter()

export async function getOrFetch<T>(
  key: string,
  fetch: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL
): Promise<T> {
  const config: CacheConfig = { ttl: ttlSeconds }
  return gateGetOrFetch(key, fetch, config)
}

export async function del(key: string): Promise<void> {
  await Promise.all([redisAdapter.del(key), dbAdapter.del(key)])
}

export type { CacheConfig, CacheStore, GateStore } from "@/lib/cache/types"
export { RedisCacheAdapter } from "@/lib/cache/redis-adapter"
export { DbCacheAdapter } from "@/lib/cache/db-adapter"
export { getOrFetch as gateGetOrFetch } from "@/lib/cache/gate"
