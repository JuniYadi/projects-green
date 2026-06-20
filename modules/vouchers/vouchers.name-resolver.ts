import { getWorkOS } from "@workos-inc/authkit-nextjs"

export type ResolvedName = {
  id: string
  name: string
}

const EMPTY_NAME: ResolvedName = { id: "", name: "" }

/**
 * Resolve a WorkOS user's display name from their userId.
 * Returns `{ id, name }` where `name` is the best available display name.
 */
export const resolveUser = async (
  userId: string | null
): Promise<ResolvedName> => {
  if (!userId) return EMPTY_NAME

  try {
    const user = await getWorkOS().userManagement.getUser(userId)
    const firstName = user.firstName?.trim() ?? ""
    const lastName = user.lastName?.trim() ?? ""
    const fullName = [firstName, lastName].filter(Boolean).join(" ")
    const displayName = fullName || user.email || userId

    return { id: userId, name: displayName }
  } catch {
    return { id: userId, name: userId }
  }
}

/**
 * Resolve a WorkOS organization's name from its organizationId.
 * Returns `{ id, name }` where `name` is the organization name or the ID as fallback.
 */
export const resolveOrganization = async (
  organizationId: string | null
): Promise<ResolvedName> => {
  if (!organizationId) return EMPTY_NAME

  try {
    const org = await getWorkOS().organizations.getOrganization(organizationId)

    return { id: organizationId, name: org.name || organizationId }
  } catch {
    return { id: organizationId, name: organizationId }
  }
}

/**
 * Resolve multiple WorkOS users in parallel, deduplicating by userId.
 */
export const resolveUsers = async (
  userIds: Array<string | null>
): Promise<Map<string, ResolvedName>> => {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => !!id))]

  const results = await Promise.all(uniqueIds.map(resolveUser))

  const map = new Map<string, ResolvedName>()
  for (const result of results) {
    map.set(result.id, result)
  }

  return map
}

/**
 * Resolve multiple WorkOS organizations in parallel, deduplicating by organizationId.
 */
export const resolveOrganizations = async (
  organizationIds: Array<string | null>
): Promise<Map<string, ResolvedName>> => {
  const uniqueIds = [
    ...new Set(organizationIds.filter((id): id is string => !!id)),
  ]

  const results = await Promise.all(uniqueIds.map(resolveOrganization))

  const map = new Map<string, ResolvedName>()
  for (const result of results) {
    map.set(result.id, result)
  }

  return map
}
