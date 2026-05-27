/**
 * WhatsApp Users Service
 *
 * Provides operations for managing WhatsApp users (organization members)
 * via WorkOS organization memberships.
 */

import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { NotFoundException } from "@workos-inc/node"

import { toScopedTenantRoleSlug } from "@/modules/tenants/services/tenant-workos.service"
import type { TenantRole } from "@/modules/tenants/tenant-policy"
import { normalizeTenantRole } from "@/modules/tenants/tenant-policy"

export type WhatsAppUser = {
  id: string
  organizationId: string
  userId: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  role: TenantRole | null
  roleSlug: string | null
  status: "active" | "inactive" | "pending"
  createdAt: string
  updatedAt: string
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

const toWhatsAppUser = (membership: WorkOSMembership): WhatsAppUser => {
  const firstName = membership.user?.firstName?.trim() ?? null
  const lastName = membership.user?.lastName?.trim() ?? null
  const email = membership.user?.email?.trim() ?? null
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || email || null

  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    email,
    displayName,
    avatarUrl: membership.user?.profilePictureUrl?.trim() ?? null,
    role: normalizeTenantRole(membership.role?.slug ?? null),
    roleSlug: membership.role?.slug ?? null,
    status: membership.status as WhatsAppUser["status"],
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  }
}

/**
 * List all WhatsApp users (organization members) for a given organization.
 */
export const listWhatsAppUsers = async (
  organizationId: string
): Promise<WhatsAppUser[]> => {
  const memberships = await getWorkOS()
    .userManagement.listOrganizationMemberships({
      organizationId,
      statuses: ["active", "inactive", "pending"],
    })
    .then((result) => result.autoPagination())

  return memberships.map((m) => toWhatsAppUser(m as WorkOSMembership))
}

/**
 * Get a single WhatsApp user by membership ID.
 */
export const getWhatsAppUser = async (
  membershipId: string
): Promise<WhatsAppUser | null> => {
  try {
    const membership = await getWorkOS()
      .userManagement.getOrganizationMembership(membershipId)

    return toWhatsAppUser(membership as WorkOSMembership)
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null
    }
    throw error
  }
}

/**
 * Invite a user to join the WhatsApp organization.
 */
export const inviteWhatsAppUser = async (params: {
  organizationId: string
  email: string
  role: TenantRole
  inviterUserId: string
}): Promise<{ id: string; email: string; roleSlug: string }> => {
  const invitation = await getWorkOS().userManagement.sendInvitation({
    email: params.email,
    organizationId: params.organizationId,
    inviterUserId: params.inviterUserId,
    roleSlug: toScopedTenantRoleSlug(params.role),
  })

  const typed = invitation as WorkOSInvitation

  return {
    id: typed.id,
    email: typed.email,
    roleSlug: typed.roleSlug ?? toScopedTenantRoleSlug(params.role),
  }
}

/**
 * Update the role of a WhatsApp user.
 */
export const updateWhatsAppUserRole = async (
  membershipId: string,
  role: TenantRole
): Promise<WhatsAppUser> => {
  const updated = await getWorkOS().userManagement.updateOrganizationMembership(
    membershipId,
    { roleSlug: toScopedTenantRoleSlug(role) }
  )

  return toWhatsAppUser(updated as WorkOSMembership)
}

/**
 * Remove a user from the WhatsApp organization (revoke membership).
 */
export const removeWhatsAppUser = async (membershipId: string): Promise<void> => {
  await getWorkOS().userManagement.deleteOrganizationMembership(membershipId)
}
