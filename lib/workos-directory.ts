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

import { createWorkOS, WorkOS } from "@workos-inc/node"
import { redis } from "@/lib/redis"

const CACHE_TTL_SECONDS = 60 * 60 // 1 hour
let _workos: WorkOS | null = null

const getWorkOSClient = () => {
  if (!_workos) {
    _workos = createWorkOS({
      apiKey: process.env.WORKOS_API_KEY ?? "",
      clientId: process.env.WORKOS_CLIENT_ID ?? "",
    })
  }
  return _workos
}

export type WorkOSDirectoryUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  lastSignInAt: string | null
  createdAt: string | null
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
    const workos = getWorkOSClient()
    const user = await workos.userManagement.getUser(workosUserId)
    const result: WorkOSDirectoryUser = {
      id: user.id,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.email?.split("@")[0]?.trim() ||
        "Unknown User",
      email: user.email?.trim() || "",
      avatarUrl: user.profilePictureUrl?.trim() || null,
      lastSignInAt: user.lastSignInAt?.trim() || null,
      createdAt: user.createdAt?.trim() || null,
    }
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
    const workos = getWorkOSClient()
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

/**
 * List every WorkOS organization and warm the same directory cache used by
 * point lookups. This is intended for cross-tenant admin inventory views.
 */
export async function listCachedOrganizations(): Promise<WorkOSDirectoryOrg[]> {
  const workos = getWorkOSClient()
  const organizations: WorkOSDirectoryOrg[] = []
  let after: string | undefined

  do {
    const page = await workos.organizations.listOrganizations({
      limit: 100,
      after,
    })

    for (const organization of page.data) {
      const entry: WorkOSDirectoryOrg = {
        id: organization.id,
        name: organization.name?.trim() || null,
        slug: organization.id,
      }
      organizations.push(entry)
      tryCacheSet(`workos:org:${entry.id}`, entry)
    }

    after = page.listMetadata?.after ?? undefined
  } while (after)

  return organizations
}
// ─── Organization metadata (owner + member count) ───────────────────────────

type WorkOSDirectoryMembership = {
  userId: string
  status?: string | null
  role?: { slug?: string | null } | null
  user?: {
    email?: string | null
    firstName?: string | null
    lastName?: string | null
  } | null
}

export type WorkOSOrgMetadata = {
  organizationId: string
  ownerUserId: string | null
  ownerName: string | null
  ownerEmail: string | null
  memberCount: number
  refreshedAt: string
}

const orgMetadataCacheKey = (orgId: string) => `workos:org-meta:${orgId}`

const isOwnerMembership = (membership: WorkOSDirectoryMembership) =>
  ["user_owner", "owner"].includes(membership.role?.slug ?? "")

const toDisplayName = (membership: WorkOSDirectoryMembership) =>
  [membership.user?.firstName, membership.user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() ||
  membership.user?.email?.trim() ||
  membership.userId

export async function getCachedOrganizationMetadata(
  workosOrgId: string
): Promise<WorkOSOrgMetadata | null> {
  if (!workosOrgId) return null

  const cacheKey = orgMetadataCacheKey(workosOrgId)

  // 1. Try cache
  const cached = await tryCacheGet<WorkOSOrgMetadata>(cacheKey)
  if (cached) return cached

  // 2. Fetch from WorkOS
  try {
    const workos = getWorkOSClient()
    const result = await workos.userManagement.listOrganizationMemberships({
      organizationId: workosOrgId,
    })

    const memberships = result.data as WorkOSDirectoryMembership[]
    const ownerMembership = memberships.find(isOwnerMembership) ?? null

    const metadata: WorkOSOrgMetadata = {
      organizationId: workosOrgId,
      ownerUserId: ownerMembership?.userId ?? null,
      ownerName: ownerMembership ? toDisplayName(ownerMembership) : null,
      ownerEmail: ownerMembership?.user?.email?.trim() ?? null,
      memberCount: memberships.length,
      refreshedAt: new Date().toISOString(),
    }

    // 3. Seed cache
    tryCacheSet(cacheKey, metadata)

    return metadata
  } catch (err) {
    console.warn(
      "[workos-directory] Failed to fetch org metadata %s: %s",
      workosOrgId,
      err instanceof Error ? err.message : "Unknown error"
    )
    return null
  }
}

export async function getCachedOrganizationsMetadata(
  ids: string[]
): Promise<Map<string, WorkOSOrgMetadata>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const results = new Map<string, WorkOSOrgMetadata>()

  await Promise.all(
    unique.map(async (id) => {
      const meta = await getCachedOrganizationMetadata(id)
      if (meta) results.set(id, meta)
    })
  )

  return results
}

export async function refreshCachedOrganizationsMetadata(
  ids: string[]
): Promise<Map<string, WorkOSOrgMetadata>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()

  if (redis) {
    try {
      await redis.del(...unique.map(orgMetadataCacheKey))
    } catch {
      // non-fatal: continue even if delete fails
    }
  }

  return getCachedOrganizationsMetadata(unique)
}
