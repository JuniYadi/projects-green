/**
 * CENTRALIZED WorkOS directory resolver.
 *
 * This is the SINGLE source of truth for resolving WorkOS user/org IDs
 * to human-readable names. All WorkOS name resolution should go through
 * this module.
 *
 * Wraps WorkOS userManagement.getUser / organizations.getOrganization
 * with a Redis-backed cache so repeated lookups (voucher claim tables,
 * admin member lists, org pickers, sidebar) don't hammer the WorkOS API.
 *
 * Cache key pattern:
 *   workos:user:{id}  → { id, name, email, avatarUrl }
 *   workos:org:{id}   → { id, name }
 * TTL: 1 hour — user/org names rarely change in WorkOS.
 *
 * Usage:
 *   import { getCachedUser, getCachedOrganization } from "@/lib/workos-directory"
 *
 *   const user = await getCachedUser(userId)  // { id, name, email, avatarUrl }
 *   const org = await getCachedOrganization(orgId)  // { id, name }
 */

import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { redis } from "@/lib/redis"

const CACHE_TTL_SECONDS = 60 * 60 // 1 hour

export type WorkOSDirectoryUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

export type WorkOSDirectoryOrg = {
  id: string
  name: string | null
  slug: string
}

// ─── Cache helpers ──────────────────────────────────────────────────────────

const tryCacheGet = async <T>(key: string): Promise<T | null> => {
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // cache read failure is non-fatal
  }
  return null
}

const tryCacheSet = (key: string, value: unknown): void => {
  if (!redis) return
  redis.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS).catch(() => {
    /* non-fatal */
  })
}

// ─── Single resolvers ───────────────────────────────────────────────────────

/**
 * Fetch a WorkOS user by ID, with Redis cache.
 * Returns null if the user doesn't exist or the API call fails.
 */
export async function getCachedUser(
  workosUserId: string
): Promise<WorkOSDirectoryUser | null> {
  if (!workosUserId) return null

  const cacheKey = `workos:user:${workosUserId}`

  // 1. Try cache
  const cached = await tryCacheGet<WorkOSDirectoryUser>(cacheKey)
  if (cached) return cached

  // 2. Fetch from WorkOS
  try {
    const workos = getWorkOS()
    const user = await workos.userManagement.getUser(workosUserId)

    const result: WorkOSDirectoryUser = {
      id: user.id,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.email?.split("@")[0]?.trim() ||
        "Unknown User",
      email: user.email?.trim() || "",
      avatarUrl: user.profilePictureUrl?.trim() || null,
    }

    // 3. Seed cache (fire-and-forget)
    tryCacheSet(cacheKey, result)

    return result
  } catch (err) {
    console.warn(
      "[workos-directory] Failed to fetch user %s: %s",
      workosUserId,
      err instanceof Error ? err.message : "Unknown error"
    )
    return null
  }
}

/**
 * Fetch a WorkOS organization by ID, with Redis cache.
 * Returns null if the org doesn't exist or the API call fails.
 */
export async function getCachedOrganization(
  workosOrgId: string
): Promise<WorkOSDirectoryOrg | null> {
  if (!workosOrgId) return null

  const cacheKey = `workos:org:${workosOrgId}`

  // 1. Try cache
  const cached = await tryCacheGet<WorkOSDirectoryOrg>(cacheKey)
  if (cached) return cached

  // 2. Fetch from WorkOS
  try {
    const workos = getWorkOS()
    const org = await workos.organizations.getOrganization(workosOrgId)

    const result: WorkOSDirectoryOrg = {
      id: org.id,
      name: org.name?.trim() || null,
      slug: org.id,
    }

    // 3. Seed cache
    tryCacheSet(cacheKey, result)

    return result
  } catch (err) {
    console.warn(
      "[workos-directory] Failed to fetch org %s: %s",
      workosOrgId,
      err instanceof Error ? err.message : "Unknown error"
    )
    return null
  }
}

// ─── Batch resolvers ────────────────────────────────────────────────────────

/**
 * Resolve multiple WorkOS user IDs in parallel, deduplicated.
 * map.get(id) returns the user entry or undefined.
 */
export async function getCachedUsers(
  ids: string[]
): Promise<Map<string, WorkOSDirectoryUser>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const results = new Map<string, WorkOSDirectoryUser>()

  await Promise.all(
    unique.map(async (id) => {
      const user = await getCachedUser(id)
      if (user) results.set(id, user)
    })
  )

  return results
}

/**
 * Resolve multiple WorkOS org IDs in parallel, deduplicated.
 */
export async function getCachedOrganizations(
  ids: string[]
): Promise<Map<string, WorkOSDirectoryOrg>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const results = new Map<string, WorkOSDirectoryOrg>()

  await Promise.all(
    unique.map(async (id) => {
      const org = await getCachedOrganization(id)
      if (org) results.set(id, org)
    })
  )

  return results
}
