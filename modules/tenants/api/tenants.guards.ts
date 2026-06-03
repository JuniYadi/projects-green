import { withAuth } from "@workos-inc/authkit-nextjs"

import {
  getPlatformRoleForUser,
  type PlatformAccessRole,
} from "@/lib/platform-role"
import {
  resolveTenantRoleFromClaims,
  type TenantRole,
} from "@/modules/tenants/tenant-policy"
import {
  toPolicyError,
  toUnauthorizedError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import type { TenantApiError } from "@/modules/tenants/contracts/tenant-api.contract"

export type TenantActorContext = {
  userId: string
  organizationId: string | null
  platformRole: PlatformAccessRole
  tenantRole: TenantRole | null
}

export const getTenantActorContext =
  async (): Promise<TenantActorContext | null> => {
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
      organizationId: auth.organizationId ?? null,
      platformRole,
      tenantRole: resolveTenantRoleFromClaims(auth.role, auth.roles),
    }
  }

export const requireTenantActor = async (
  set: RouteSet
): Promise<TenantActorContext | TenantApiError> => {
  const actor = await getTenantActorContext()

  if (!actor) {
    return toUnauthorizedError(set)
  }

  return actor
}

export const ensureTenantContextAccess = (
  orgId: string,
  actor: TenantActorContext,
  set: RouteSet
): true | TenantApiError => {
  if (actor.platformRole === "super_admin") {
    return true
  }

  if (!actor.organizationId) {
    return toPolicyError(
      set,
      "TENANT_CONTEXT_REQUIRED",
      "An active tenant context is required to perform this action."
    )
  }

  if (actor.organizationId !== orgId) {
    return toPolicyError(
      set,
      "TENANT_CONTEXT_MISMATCH",
      "The requested tenant does not match your active organization context."
    )
  }

  if (!actor.tenantRole) {
    // User is a confirmed WorkOS org member but has no mapped role claim.
    // Default to "member" for this request context rather than rejecting.
    return true
  }

  return true
}
