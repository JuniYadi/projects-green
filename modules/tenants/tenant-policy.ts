/**
 * Tenant policy — re-exports from lib/auth/org-role.ts for backward compatibility.
 * New code should import directly from @/lib/auth/org-role or @/lib/auth.
 */
export { ORG_ROLES as TENANT_ROLES } from "@/lib/auth/org-role"
export type { OrgRole as TenantRole } from "@/lib/auth/org-role"
export { resolveOrgRole as resolveTenantRole } from "@/lib/auth/org-role"

// Re-export policy functions that remain in this module
export type { PlatformAccessRole } from "@/lib/platform-role"
import type { PlatformAccessRole } from "@/lib/platform-role"
import type { OrgRole } from "@/lib/auth/org-role"

export type ActorRoleContext = {
  platformRole: PlatformAccessRole
  tenantRole: OrgRole | null
}

type ScopedRoleTarget = "admin" | "user"
type ScopedRoleClaim = {
  target: ScopedRoleTarget
  role: OrgRole
}

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

const LEGACY_TENANT_ROLE_ALIASES: Record<string, OrgRole> = {
  owner: "owner",
  admin: "admin",
  member: "member",
  user: "member",
}

const parseScopedRoleClaim = (value: string): ScopedRoleClaim | null => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const legacyRole = LEGACY_TENANT_ROLE_ALIASES[normalized]
  if (legacyRole) {
    return {
      target: "user",
      role: legacyRole,
    }
  }

  const parsed = normalized.match(/^([a-z]+)[/:_-]([a-z]+)$/)
  if (!parsed) {
    return null
  }

  const target = parsed[1]
  const role = parsed[2]
  if (
    (target !== "admin" && target !== "user") ||
    !LEGACY_TENANT_ROLE_ALIASES[role]
  ) {
    return null
  }

  return {
    target,
    role: LEGACY_TENANT_ROLE_ALIASES[role],
  }
}

const toScopedRoleClaims = (
  primaryRole: string | null | undefined,
  roles: string[] | null | undefined
) => {
  const parsedClaims: ScopedRoleClaim[] = []

  for (const raw of [primaryRole, ...(roles ?? [])]) {
    if (!raw) {
      continue
    }

    const scopedClaim = parseScopedRoleClaim(raw)
    if (scopedClaim) {
      parsedClaims.push(scopedClaim)
    }
  }

  return parsedClaims
}

export const resolveScopedRoleTargetFromClaims = (
  primaryRole: string | null | undefined,
  roles: string[] | null | undefined
): ScopedRoleTarget | null => {
  const scopedClaims = toScopedRoleClaims(primaryRole, roles)

  if (scopedClaims.some((claim) => claim.target === "admin")) {
    return "admin"
  }

  if (scopedClaims.some((claim) => claim.target === "user")) {
    return "user"
  }

  return null
}

export const hasScopedSuperAdminClaim = (
  primaryRole: string | null | undefined,
  roles: string[] | null | undefined
) => {
  const normalizedClaims = [primaryRole, ...(roles ?? [])]
    .map((role) => role?.trim().toLowerCase())
    .filter((role): role is string => Boolean(role))

  return (
    normalizedClaims.includes("super_admin") ||
    normalizedClaims.includes("admin_owner")
  )
}

export const normalizeTenantRole = (
  role: string | null | undefined
): OrgRole | null => {
  if (!role) {
    return null
  }

  const scopedClaim = parseScopedRoleClaim(role)
  if (!scopedClaim) {
    return null
  }

  return scopedClaim.role
}

export const resolveTenantRoleFromClaims = (
  primaryRole: string | null | undefined,
  roles: string[] | null | undefined
): OrgRole | null => {
  const normalizedRoles = toScopedRoleClaims(primaryRole, roles)
    .filter((claim) => claim.target === "user")
    .map((claim) => claim.role)

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
  targetRole: OrgRole
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
  targetRole: OrgRole
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
  currentRole: OrgRole
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

export const buildAllowedActions = (
  actor: ActorRoleContext
): TenantAction[] => {
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
