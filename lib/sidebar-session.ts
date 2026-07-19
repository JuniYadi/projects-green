import type { User } from "@workos-inc/node"

import type {
  AppSidebarOrganization,
  AppSidebarUser,
} from "@/components/app-sidebar"
import { getCachedUser, getCachedOrganization } from "@/lib/workos-directory"

const normalizeAvatarUrl = (value: string | null) => {
  if (!value) {
    return null
  }

  const candidate = value.trim()
  return candidate || null
}

export const resolveSidebarUser = (user: User): AppSidebarUser => {
  const firstName = user.firstName?.trim() ?? ""
  const lastName = user.lastName?.trim() ?? ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  const email = user.email?.trim() ?? ""
  const emailLocalPart = email.split("@")[0]?.trim() ?? ""
  const name = fullName || emailLocalPart || "User"

  return {
    name,
    email,
    avatarUrl: normalizeAvatarUrl(user.profilePictureUrl),
  }
}

/**
 * Resolve a WorkOS user by ID using the centralized directory service.
 * Falls back to the provided user object if the fetch fails.
 */
export const getLatestWorkOSUser = async (user: User): Promise<User> => {
  try {
    const cached = await getCachedUser(user.id)
    if (!cached) return user

    // Map cached user back to WorkOS User shape for sidebar compatibility
    return {
      ...user,
      firstName: cached.name?.split(" ")[0] ?? user.firstName,
      lastName: cached.name?.split(" ").slice(1).join(" ") ?? user.lastName,
      email: cached.email ?? user.email,
      profilePictureUrl: cached.avatarUrl ?? user.profilePictureUrl,
    } as User
  } catch (error) {
    console.warn(
      "[sidebar-session] Failed to refresh WorkOS user",
      user.id,
      error
    )
    return user
  }
}

/**
 * Resolve an organization by ID using the centralized directory service.
 * Returns { id, name } compatible with AppSidebarOrganization.
 */
export const resolveSidebarOrganization = async (
  organizationId: string | undefined
): Promise<AppSidebarOrganization> => {
  const id = organizationId ?? null
  if (!id) {
    return {
      id: null,
      name: null,
    }
  }

  try {
    const org = await getCachedOrganization(id)
    return {
      id,
      name: org?.name?.trim() ?? null,
    }
  } catch (error) {
    console.warn("[sidebar-session] Failed to resolve organization", id, error)
    return {
      id,
      name: null,
    }
  }
}
