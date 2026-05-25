import { withAuth } from "@workos-inc/authkit-nextjs"

import {
  getPlatformRoleForUser,
  type PlatformAccessRole,
} from "@/lib/platform-role"

export type AdminActorContext = {
  userId: string
  platformRole: PlatformAccessRole
}

export type RouteSet = { status?: number | string }

export type AdminApiError = {
  ok: false
  error: string
  message: string
  policyCode?: string
}

export const toUnauthorizedError = (set: RouteSet): AdminApiError => {
  set.status = 401

  return {
    ok: false,
    error: "UNAUTHORIZED",
    message: "You must be signed in to perform this action.",
  }
}

export const toForbiddenError = (set: RouteSet): AdminApiError => {
  set.status = 403

  return {
    ok: false,
    error: "FORBIDDEN",
    policyCode: "SUPER_ADMIN_REQUIRED",
    message: "This action requires super admin access.",
  }
}

export const getAdminActorContext =
  async (): Promise<AdminActorContext | null> => {
    const auth = await withAuth()

    if (!auth.user) {
      return null
    }

    const platformRole = await getPlatformRoleForUser({
      id: auth.user.id,
      email: auth.user.email,
    })

    return {
      userId: auth.user.id,
      platformRole,
    }
  }

export const requireSuperAdmin = async (
  set: RouteSet
): Promise<AdminActorContext | AdminApiError> => {
  const actor = await getAdminActorContext()

  if (!actor) {
    return toUnauthorizedError(set)
  }

  if (actor.platformRole !== "super_admin") {
    return toForbiddenError(set)
  }

  return actor
}