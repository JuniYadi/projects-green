import { PlatformAccessRole } from "@/lib/platform-role"

export const TENANT_ROLES = ["owner", "admin", "member"] as const
export type TenantRole = (typeof TENANT_ROLES)[number]

export const TENANT_ACTIONS = [
  "manage_tenant",
  "invite_member",
  "invite_admin",
  "invite_owner",
  "promote_member",
  "promote_owner",
  "demote_admin",
  "demote_owner",
  "transfer_ownership",
] as const

export type TenantAction = (typeof TENANT_ACTIONS)[number]

export type ActorRoleContext = {
  platformRole: PlatformAccessRole
  tenantRole: TenantRole | null
}

export const normalizeTenantRole = (
  role: string | null | undefined
): TenantRole | null => {
  const normalized = role?.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized === "user") {
    return "member"
  }

  if (
    normalized === "owner" ||
    normalized === "admin" ||
    normalized === "member"
  ) {
    return normalized
  }

  return null
}

export const resolveTenantRoleFromClaims = (
  primaryRole: string | null | undefined,
  roles: string[] | null | undefined
): TenantRole | null => {
  const normalizedRoles = [primaryRole, ...(roles ?? [])]
    .map((value) => normalizeTenantRole(value))
    .filter((value): value is TenantRole => Boolean(value))

  if (normalizedRoles.includes("owner")) {
    return "owner"
  }

  if (normalizedRoles.includes("admin")) {
    return "admin"
  }

  if (normalizedRoles.includes("member")) {
    return "member"
  }

  return null
}

export const canManageTenant = (actor: ActorRoleContext) => {
  if (actor.platformRole === "super_admin") {
    return true
  }

  return actor.tenantRole === "owner" || actor.tenantRole === "admin"
}

export const canInviteAsRole = (
  actor: ActorRoleContext,
  targetRole: TenantRole
) => {
  if (actor.platformRole === "super_admin") {
    return true
  }

  if (targetRole === "member") {
    return actor.tenantRole === "owner" || actor.tenantRole === "admin"
  }

  return actor.tenantRole === "owner"
}

export const canPromoteToRole = (
  actor: ActorRoleContext,
  targetRole: TenantRole
) => {
  if (actor.platformRole === "super_admin") {
    return true
  }

  if (targetRole === "admin") {
    return actor.tenantRole === "owner" || actor.tenantRole === "admin"
  }

  if (targetRole === "owner") {
    return actor.tenantRole === "owner"
  }

  return false
}

export const canDemoteFromRole = (
  actor: ActorRoleContext,
  currentRole: TenantRole
) => {
  if (actor.platformRole === "super_admin") {
    return true
  }

  if (currentRole === "admin") {
    return actor.tenantRole === "owner" || actor.tenantRole === "admin"
  }

  if (currentRole === "owner") {
    return actor.tenantRole === "owner"
  }

  return false
}

export const canTransferOwnership = (actor: ActorRoleContext) => {
  if (actor.platformRole === "super_admin") {
    return true
  }

  return actor.tenantRole === "owner"
}

export const buildAllowedActions = (actor: ActorRoleContext): TenantAction[] => {
  if (actor.platformRole === "super_admin") {
    return [...TENANT_ACTIONS]
  }

  const actions = new Set<TenantAction>()

  if (actor.tenantRole === "owner") {
    actions.add("manage_tenant")
    actions.add("invite_member")
    actions.add("invite_admin")
    actions.add("invite_owner")
    actions.add("promote_member")
    actions.add("promote_owner")
    actions.add("demote_admin")
    actions.add("demote_owner")
    actions.add("transfer_ownership")
  }

  if (actor.tenantRole === "admin") {
    actions.add("manage_tenant")
    actions.add("invite_member")
    actions.add("promote_member")
    actions.add("demote_admin")
  }

  return [...actions]
}
