/**
 * @deprecated This module is DEPRECATED. Use `@/lib/workos-directory` instead.
 *
 * This file is kept for backward compatibility only. All WorkOS name
 * resolution should go through the centralized directory service:
 *
 *   import { getCachedUser, getCachedOrganization } from "@/lib/workos-directory"
 *
 * See AGENTS.md for the centralized WorkOS directory pattern.
 */

import {
  getCachedUser,
  getCachedOrganization,
} from "@/lib/workos-directory"
import type {
  WorkOSDirectoryUser,
  WorkOSDirectoryOrg,
} from "@/lib/workos-directory"

// Re-export types for backward compatibility
export type CachedUser = WorkOSDirectoryUser
export type CachedOrg = WorkOSDirectoryOrg

/**
 * @deprecated Use getCachedUser from "@/lib/workos-directory" instead.
 */
export const workosCacheService = {
  async getUser(
    userId: string | null | undefined
  ): Promise<CachedUser | null> {
    if (!userId) return null
    return getCachedUser(userId)
  },

  async getOrg(
    orgId: string | null | undefined
  ): Promise<CachedOrg | null> {
    if (!orgId) return null
    return getCachedOrganization(orgId)
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async invalidateUser(_userId: string): Promise<void> {
    // No-op — Redis cache handles TTL automatically
    console.warn(
      "[workos-cache] invalidateUser is deprecated. Cache invalidation is handled by TTL."
    )
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async invalidateOrg(_orgId: string): Promise<void> {
    // No-op — Redis cache handles TTL automatically
    console.warn(
      "[workos-cache] invalidateOrg is deprecated. Cache invalidation is handled by TTL."
    )
  },
}
