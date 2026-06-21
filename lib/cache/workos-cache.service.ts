import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { getOrFetch, del } from "@/lib/cache"

export interface CachedUser {
  id: string
  name: string
  email: string
}

export interface CachedOrg {
  id: string
  name: string
  slug: string // Will be the org.id as fallback
}

const USER_TTL = Number(process.env.WORKOS_CACHE_TTL_USER ?? "3600")
const ORG_TTL = Number(process.env.WORKOS_CACHE_TTL_ORG ?? "3600")

const USER_PREFIX = "workos:user:"
const ORG_PREFIX = "workos:org:"

async function fetchUser(userId: string): Promise<CachedUser> {
  const workos = getWorkOS()
  const user = await workos.userManagement.getUser(userId)
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email?.split("@")[0] ||
    "Unknown User"

  return { id: user.id, name, email: user.email ?? "" }
}

async function fetchOrg(orgId: string): Promise<CachedOrg> {
  const workos = getWorkOS()
  const org = await workos.organizations.getOrganization(orgId)
  return {
    id: org.id,
    name: org.name || org.id,
    // WorkOS Organization type doesn't have slug — fall back to id
    slug: org.id,
  }
}

export const workosCacheService = {
  async getUser(
    userId: string | null | undefined
  ): Promise<CachedUser | null> {
    if (!userId) return null

    try {
      return await getOrFetch(
        `${USER_PREFIX}${userId}`,
        () => fetchUser(userId),
        USER_TTL
      )
    } catch (err) {
      console.warn("[workos-cache] Failed to fetch user", userId, err)
      return null
    }
  },

  async getOrg(
    orgId: string | null | undefined
  ): Promise<CachedOrg | null> {
    if (!orgId) return null

    try {
      return await getOrFetch(
        `${ORG_PREFIX}${orgId}`,
        () => fetchOrg(orgId),
        ORG_TTL
      )
    } catch (err) {
      console.warn("[workos-cache] Failed to fetch org", orgId, err)
      return null
    }
  },

  async invalidateUser(userId: string): Promise<void> {
    await del(`${USER_PREFIX}${userId}`)
  },

  async invalidateOrg(orgId: string): Promise<void> {
    await del(`${ORG_PREFIX}${orgId}`)
  },
}
