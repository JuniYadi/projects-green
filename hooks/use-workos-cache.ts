import { cache } from "react"
import { workosCacheService } from "@/lib/cache/workos-cache.service"
import type { CachedUser, CachedOrg } from "@/lib/cache/workos-cache.service"

/**
 * Server-safe hook to resolve a WorkOS user ID to a cached user object.
 * Uses React.cache() for deduplication within a single render pass.
 *
 * Returns null for null/undefined input, or when WorkOS fetch fails.
 */
export const useWorkosUser = cache(
  async (userId: string | null | undefined): Promise<CachedUser | null> => {
    return workosCacheService.getUser(userId)
  }
)

/**
 * Server-safe hook to resolve a WorkOS org ID to a cached org object.
 * Uses React.cache() for deduplication within a single render pass.
 *
 * Returns null for null/undefined input, or when WorkOS fetch fails.
 */
export const useWorkosOrg = cache(
  async (orgId: string | null | undefined): Promise<CachedOrg | null> => {
    return workosCacheService.getOrg(orgId)
  }
)
