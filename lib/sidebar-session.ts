import { getWorkOS } from "@workos-inc/authkit-nextjs"
import type { User } from "@workos-inc/node"

import type {
  AppSidebarOrganization,
  AppSidebarUser,
} from "@/components/app-sidebar"

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

export const getLatestWorkOSUser = async (user: User): Promise<User> => {
  try {
    return await getWorkOS().userManagement.getUser(user.id)
  } catch (error) {
    console.warn(
      "[dashboard-shell] Failed to load latest WorkOS user profile for sidebar.",
      {
        hasUserId: !!user.id,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }
    )
    return user
  }
}

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
    const organization = await getWorkOS().organizations.getOrganization(id)
    return {
      id,
      name: organization.name?.trim() || null,
    }
  } catch (error) {
    console.warn(
      "[dashboard-shell] Failed to load WorkOS organization for sidebar.",
      {
        hasOrganizationId: !!id,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }
    )
    return {
      id,
      name: null,
    }
  }
}
