import { getWorkOS } from "@workos-inc/authkit-nextjs"

import type {
  TenantBootstrapMembership,
  TenantInvitationCreatedSummary,
  TenantInvitationSummary,
  TenantMembershipSummary,
} from "@/modules/tenants/contracts/tenant-api.contract"
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

const toTenantMembershipSummary = (
  membership: WorkOSMembership
): TenantMembershipSummary => {
  const roleSlug = membership.role?.slug ?? null

  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    status: membership.status,
    role: normalizeTenantRole(roleSlug),
    roleSlug,
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
): Promise<TenantMembershipSummary> => {
  const membership =
    await getWorkOS().userManagement.getOrganizationMembership(membershipId)

  return toTenantMembershipSummary(membership as WorkOSMembership)
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
  const roles = await getWorkOS()
    .authorization.listOrganizationRoles(organizationId)
    .then((result) => result.autoPagination())
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

export const isActiveOwnerMembership = (
  membership: TenantMembershipSummary
) => {
  return membership.status === "active" && membership.role === "owner"
}
