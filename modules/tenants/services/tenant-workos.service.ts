import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { NotFoundException } from "@workos-inc/node"

import type {
  TenantBootstrapMembership,
  TenantInvitationCreatedSummary,
  TenantInvitationSummary,
  TenantMembershipSummary,
  TenantOrganizationSummary,
} from "@/modules/tenants/contracts/tenant-api.contract"
import { withOwnershipLock } from "@/modules/tenants/services/tenant-ownership-lock"
import {
  normalizeTenantRole,
  type TenantRole,
} from "@/modules/tenants/tenant-policy"

const BOOTSTRAP_CREATOR_ROLE_SLUG = "user_owner"

const SCOPED_TENANT_ROLE_SLUG: Record<TenantRole, string> = {
  owner: "user_owner",
  admin: "user_admin",
  member: "user_member",
}

type WorkOSMembership = {
  id: string
  organizationId: string
  organizationName: string
  userId: string
  status: string
  createdAt: string
  updatedAt: string
  role?: { slug?: string | null } | null
  user?: {
    email?: string | null
    firstName?: string | null
    lastName?: string | null
    profilePictureUrl?: string | null
  } | null
}

type WorkOSInvitation = {
  id: string
  email: string
  state: string
  organizationId: string
  inviterUserId: string | null
  acceptedUserId: string | null
  roleSlug: string | null
  createdAt: string
  expiresAt: string
}

type WorkOSOrganization = {
  id: string
  name: string
  metadata?: unknown
  allowProfilesOutsideOrganization?: boolean
  createdAt: string
  updatedAt: string
}

export class TenantWorkOSOperationUnsupportedError extends Error {
  readonly operation: string

  constructor(operation: string) {
    super(`WorkOS operation '${operation}' is not supported by this SDK.`)
    this.name = "TenantWorkOSOperationUnsupportedError"
    this.operation = operation
  }
}

const normalizeNullableString = (value: string | null | undefined) => {
  const normalized = value?.trim()

  return normalized ? normalized : null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isLikelyEmail = (value: string | null) => {
  if (!value) {
    return false
  }

  return EMAIL_PATTERN.test(value)
}

const toMembershipProfile = (
  membership: WorkOSMembership
): TenantMembershipSummary["profile"] => {
  if (!membership.user) {
    return null
  }

  const firstName = normalizeNullableString(membership.user.firstName)
  const lastName = normalizeNullableString(membership.user.lastName)
  const email = normalizeNullableString(membership.user.email)
  const profilePictureUrl = normalizeNullableString(
    membership.user.profilePictureUrl
  )
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email

  return {
    email,
    firstName,
    lastName,
    profilePictureUrl,
    displayName: displayName || null,
  }
}

const toTenantOrganizationMetadata = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const metadata: Record<string, string> = {}

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      metadata[key] = item
    }
  }

  return metadata
}

const toTenantMembershipSummary = (
  membership: WorkOSMembership
): TenantMembershipSummary => {
  const roleSlug = membership.role?.slug ?? null
  const profile = toMembershipProfile(membership)
  const normalizedUserId = normalizeNullableString(membership.userId)
  const email = profile?.email ?? (isLikelyEmail(normalizedUserId)
    ? normalizedUserId
    : null)
  const displayName =
    profile?.displayName ?? email ?? normalizedUserId ?? membership.id
  const avatarUrl = profile?.profilePictureUrl ?? null

  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    displayName,
    email,
    avatarUrl,
    status: membership.status,
    role: normalizeTenantRole(roleSlug),
    roleSlug,
    profile,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  }
}

const toTenantInvitationSummary = (
  invitation: WorkOSInvitation
): TenantInvitationSummary => {
  return {
    id: invitation.id,
    email: invitation.email,
    state: invitation.state,
    organizationId: invitation.organizationId,
    inviterUserId: invitation.inviterUserId,
    acceptedUserId: invitation.acceptedUserId,
    roleSlug: invitation.roleSlug,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  }
}

const toTenantInvitationCreatedSummary = (
  invitation: WorkOSInvitation
): TenantInvitationCreatedSummary => {
  return {
    id: invitation.id,
    email: invitation.email,
    state: invitation.state,
    organizationId: invitation.organizationId,
    roleSlug: invitation.roleSlug,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  }
}

const toTenantOrganizationSummary = (
  organization: WorkOSOrganization
): TenantOrganizationSummary => {
  return {
    id: organization.id,
    name: organization.name,
    metadata: toTenantOrganizationMetadata(organization.metadata),
    allowProfilesOutsideOrganization:
      organization.allowProfilesOutsideOrganization ?? false,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  }
}

export const toScopedTenantRoleSlug = (role: TenantRole) => {
  return SCOPED_TENANT_ROLE_SLUG[role]
}

export const getBootstrapCreatorRoleSlug = () => {
  return BOOTSTRAP_CREATOR_ROLE_SLUG
}

export const listTenantMemberships = async (
  organizationId: string
): Promise<TenantMembershipSummary[]> => {
  const memberships = await getWorkOS()
    .userManagement.listOrganizationMemberships({
      organizationId,
      statuses: ["active", "inactive", "pending"],
    })
    .then((result) => result.autoPagination())

  return memberships.map((membership) =>
    toTenantMembershipSummary(membership as WorkOSMembership)
  )
}

export const getTenantMembershipById = async (
  membershipId: string
): Promise<TenantMembershipSummary | null> => {
  try {
    const membership =
      await getWorkOS().userManagement.getOrganizationMembership(membershipId)

    return toTenantMembershipSummary(membership as WorkOSMembership)
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null
    }

    throw error
  }
}

export const listTenantBootstrapMembershipsForUser = async (
  userId: string
): Promise<TenantBootstrapMembership[]> => {
  const memberships = await getWorkOS()
    .userManagement.listOrganizationMemberships({
      userId,
      statuses: ["active", "pending"],
    })
    .then((result) => result.autoPagination())

  return memberships.map((membership) => {
    const typedMembership = membership as WorkOSMembership

    return {
      organizationId: typedMembership.organizationId,
      organizationName: typedMembership.organizationName,
      status: typedMembership.status,
      roleSlug: typedMembership.role?.slug ?? null,
    }
  })
}

export const hasBootstrapCreatorRole = async (organizationId: string) => {
  const rolesResult = (await getWorkOS().authorization.listOrganizationRoles(
    organizationId
  )) as {
    autoPagination?: () => Promise<Array<{ slug?: string | null }>>
    data?: Array<{ slug?: string | null }>
  }
  // Compatibility with multiple WorkOS SDK shapes from getWorkOS():
  // newer responses expose rolesResult.autoPagination(), while older
  // responses expose rolesResult.data. Normalize both before mapping
  // roleSlugs and checking BOOTSTRAP_CREATOR_ROLE_SLUG.
  const roles =
    typeof rolesResult.autoPagination === "function"
      ? await rolesResult.autoPagination()
      : (rolesResult.data ?? [])

  const roleSlugs = new Set(
    roles
      .map((role) => role.slug?.trim().toLowerCase())
      .filter((role): role is string => Boolean(role))
  )

  return roleSlugs.has(BOOTSTRAP_CREATOR_ROLE_SLUG)
}

export const createTenantOrganization = async (name: string) => {
  return getWorkOS().organizations.createOrganization({
    name,
  })
}

export const deleteTenantOrganization = async (organizationId: string) => {
  return getWorkOS().organizations.deleteOrganization(organizationId)
}

export const createTenantMembership = async (params: {
  organizationId: string
  userId: string
  roleSlug: string
}) => {
  return getWorkOS().userManagement.createOrganizationMembership(params)
}

export const listTenantInvitations = async (
  organizationId: string
): Promise<TenantInvitationSummary[]> => {
  const invitations = await getWorkOS()
    .userManagement.listInvitations({
      organizationId,
    })
    .then((result) => result.autoPagination())

  return invitations.map((invitation) =>
    toTenantInvitationSummary(invitation as WorkOSInvitation)
  )
}

export const sendTenantInvitation = async (params: {
  email: string
  organizationId: string
  inviterUserId: string
  targetRole: TenantRole
}): Promise<TenantInvitationCreatedSummary> => {
  const invitation = await getWorkOS().userManagement.sendInvitation({
    email: params.email,
    organizationId: params.organizationId,
    inviterUserId: params.inviterUserId,
    roleSlug: toScopedTenantRoleSlug(params.targetRole),
  })

  return toTenantInvitationCreatedSummary(invitation as WorkOSInvitation)
}

export const getTenantInvitationById = async (
  invitationId: string
): Promise<TenantInvitationSummary | null> => {
  try {
    const invitation =
      await getWorkOS().userManagement.getInvitation(invitationId)

    return toTenantInvitationSummary(invitation as WorkOSInvitation)
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null
    }

    throw error
  }
}

export const revokeTenantInvitation = async (
  invitationId: string
): Promise<TenantInvitationSummary> => {
  return cancelTenantInvitation(invitationId)
}

export const cancelTenantInvitation = async (
  invitationId: string
): Promise<TenantInvitationSummary> => {
  const userManagement = getWorkOS().userManagement as {
    revokeInvitation?: (id: string) => Promise<unknown>
  }

  if (typeof userManagement.revokeInvitation !== "function") {
    throw new TenantWorkOSOperationUnsupportedError("revokeInvitation")
  }

  const invitation = await userManagement.revokeInvitation(invitationId)
  return toTenantInvitationSummary(invitation as WorkOSInvitation)
}

export const resendTenantInvitation = async (
  invitationId: string
): Promise<TenantInvitationSummary> => {
  const userManagement = getWorkOS().userManagement as {
    resendInvitation?: (id: string) => Promise<unknown>
  }

  if (typeof userManagement.resendInvitation !== "function") {
    throw new TenantWorkOSOperationUnsupportedError("resendInvitation")
  }

  const invitation = await userManagement.resendInvitation(invitationId)

  return toTenantInvitationSummary(invitation as WorkOSInvitation)
}

export const updateTenantMembershipRole = async (
  membershipId: string,
  targetRole: TenantRole
): Promise<TenantMembershipSummary> => {
  const updated = await getWorkOS().userManagement.updateOrganizationMembership(
    membershipId,
    {
      roleSlug: toScopedTenantRoleSlug(targetRole),
    }
  )

  return toTenantMembershipSummary(updated as WorkOSMembership)
}

export const deleteTenantMembership = async (membershipId: string) => {
  await getWorkOS().userManagement.deleteOrganizationMembership(membershipId)
}

export const demoteTenantMembershipSafely = async (params: {
  membershipId: string
  organizationId: string
  targetMembership: TenantMembershipSummary
  actorUserId: string
}): Promise<
  | { success: true; membership: TenantMembershipSummary }
  | {
      success: false
      reason: "LAST_OWNER_PROTECTED" | "SELF_DEMOTION_BLOCKED"
    }
> => {
  // Non-owner demotions don't affect the last-owner invariant
  if (!isActiveOwnerMembership(params.targetMembership)) {
    const updated = await updateTenantMembershipRole(
      params.membershipId,
      "member"
    )
    return { success: true, membership: updated }
  }

  // Owner demotion — serialize via per-org lock to prevent the race
  // where two concurrent requests both see count > 1 then both demote.
  return withOwnershipLock(params.organizationId, async () => {
    // Re-fetch the membership to ensure we have the latest state
    const freshMembership = await getTenantMembershipById(params.membershipId)
    if (!freshMembership) {
      return { success: false, reason: "LAST_OWNER_PROTECTED" as const }
    }

    const memberships = await listTenantMemberships(params.organizationId)
    const activeOwnerCount = memberships.filter(isActiveOwnerMembership).length
    const isSelfDemotion = freshMembership.userId === params.actorUserId

    if (isSelfDemotion && activeOwnerCount <= 1) {
      return { success: false, reason: "SELF_DEMOTION_BLOCKED" as const }
    }

    if (activeOwnerCount <= 1) {
      return { success: false, reason: "LAST_OWNER_PROTECTED" as const }
    }

    const updated = await updateTenantMembershipRole(
      params.membershipId,
      "member"
    )
    return { success: true, membership: updated }
  })
}

export const deleteTenantMembershipSafely = async (params: {
  membershipId: string
  organizationId: string
  targetMembership: TenantMembershipSummary
  actorUserId?: string
}): Promise<
  | { success: true }
  | {
      success: false
      reason: "LAST_OWNER_PROTECTED" | "SELF_LEAVE_BLOCKED"
    }
> => {
  // Non-owners can be deleted without the ownership lock
  if (!isActiveOwnerMembership(params.targetMembership)) {
    await deleteTenantMembership(params.membershipId)
    return { success: true }
  }

  // Target is an active owner — serialize via a per-org lock so two
  // concurrent requests cannot both pass the "count > 1" check before
  // either delete executes.
  return withOwnershipLock(params.organizationId, async () => {
    // Re-fetch the membership to ensure we have the latest state
    const freshMembership = await getTenantMembershipById(params.membershipId)
    if (!freshMembership) {
      return { success: false, reason: "LAST_OWNER_PROTECTED" as const }
    }

    const memberships = await listTenantMemberships(params.organizationId)
    const activeOwnerCount = memberships.filter(isActiveOwnerMembership).length
    const isSelfLeave = freshMembership.userId === params.actorUserId

    if (isSelfLeave && activeOwnerCount <= 1) {
      return { success: false, reason: "SELF_LEAVE_BLOCKED" as const }
    }

    if (activeOwnerCount <= 1) {
      return { success: false, reason: "LAST_OWNER_PROTECTED" as const }
    }

    await deleteTenantMembership(params.membershipId)
    return { success: true }
  })
}

export const getTenantOrganizationById = async (
  organizationId: string
): Promise<TenantOrganizationSummary | null> => {
  try {
    const organization =
      await getWorkOS().organizations.getOrganization(organizationId)

    return toTenantOrganizationSummary(organization as WorkOSOrganization)
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null
    }

    throw error
  }
}

export const updateTenantOrganization = async (params: {
  organizationId: string
  name?: string
  metadata?: Record<string, string>
}): Promise<TenantOrganizationSummary> => {
  const organizationUpdateInput: {
    organization: string
    name?: string
    metadata?: Record<string, string>
  } = {
    organization: params.organizationId,
  }

  if (params.name !== undefined) {
    organizationUpdateInput.name = params.name
  }

  if (params.metadata !== undefined) {
    organizationUpdateInput.metadata = params.metadata
  }

  const organization =
    await getWorkOS().organizations.updateOrganization(organizationUpdateInput)

  return toTenantOrganizationSummary(organization as WorkOSOrganization)
}

export const isActiveOwnerMembership = (
  membership: TenantMembershipSummary
) => {
  return membership.status === "active" && membership.role === "owner"
}
