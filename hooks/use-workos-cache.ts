import { cache } from "react"
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
 * Server-safe hook to resolve a WorkOS user ID to a cached user object.
 * Uses React.cache() for deduplication within a single render pass.
 *
 * Returns null for null/undefined input, or when WorkOS fetch fails.
 */
export const useWorkosUser = cache(
  async (userId: string | null | undefined): Promise<CachedUser | null> => {
    if (!userId) return null
    return getCachedUser(userId)
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
    if (!orgId) return null
    return getCachedOrganization(orgId)
  }
)
