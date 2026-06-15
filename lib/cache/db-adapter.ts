import { prisma } from "@/lib/prisma"
import type { CacheStore } from "@/lib/cache/types"

export class DbCacheAdapter implements CacheStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = await prisma.cacheEntry.findUnique({ where: { key } })
      if (!entry) return null

      if (entry.expiresAt && entry.expiresAt <= new Date()) {
        await prisma.cacheEntry
          .delete({ where: { id: entry.id } })
          .catch(() => {})
        return null
      }

      return JSON.parse(entry.value) as T
    } catch (err) {
      console.error("[DbCacheAdapter] get error:", err)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000)
      const stringValue = JSON.stringify(value)

      await prisma.cacheEntry.upsert({
        where: { key },
        create: { key, value: stringValue, expiresAt },
        update: { value: stringValue, expiresAt },
      })
    } catch (err) {
      console.error("[DbCacheAdapter] set error:", err)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await prisma.cacheEntry.delete({ where: { key } })
    } catch (err) {
      // Eintity not found is expected — ignore
      console.error("[DbCacheAdapter] del error:", err)
    }
  }
}
