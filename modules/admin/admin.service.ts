import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { getCachedOrganization } from "@/lib/workos-directory"

export type AdminOrganizationSummary = {
  id: string
  name: string
  externalId: string | null
  domains: string[]
  allowProfilesOutsideOrganization: boolean
  memberCount?: number
  createdAt: string
  updatedAt: string
}

export type AdminInvitationSummary = {
  id: string
  email: string
  state: string
  organizationId: string | null
  organizationName?: string | null
  roleSlug: string | null
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

export type AdminUserSummary = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  emailVerified: boolean
  profilePictureUrl: string | null
  lastSignInAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminUserMembership = {
  id: string
  organizationId: string
  organizationName: string | null
  status: string
  roleSlug: string
  createdAt: string
  updatedAt: string
}

export type AdminUserDetail = AdminUserSummary & {
  memberships: AdminUserMembership[]
}

type WorkOSUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  emailVerified: boolean
  profilePictureUrl?: string | null
  lastSignInAt?: string | null
  createdAt: string
  updatedAt: string
}

type WorkOSOrganization = {
  id: string
  name: string
  externalId?: string | null
  domains?: Array<{ domain: string; state: string }>
  allowProfilesOutsideOrganization?: boolean
  createdAt: string
  updatedAt: string
}

type WorkOSMembership = {
  id: string
  userId: string
  organizationId: string
  status: string
  role?: { slug?: string | null } | null
  user?: {
    email?: string | null
    firstName?: string | null
    lastName?: string | null
  } | null
  createdAt: string
  updatedAt: string
}

type WorkOSInvitation = {
  id: string
  email: string
  state: string
  organizationId?: string | null
  inviterUserId?: string | null
  acceptedUserId?: string | null
  roleSlug?: string | null
  createdAt: string
  expiresAt: string
  acceptedAt?: string | null
}

const toOrganizationSummary = (
  org: WorkOSOrganization
): AdminOrganizationSummary => ({
  id: org.id,
  name: org.name,
  externalId: org.externalId ?? null,
  domains: org.domains?.map((d) => d.domain) ?? [],
  allowProfilesOutsideOrganization:
    org.allowProfilesOutsideOrganization ?? false,
  createdAt: org.createdAt,
  updatedAt: org.updatedAt,
})

const toInvitationSummary = (
  inv: WorkOSInvitation
): AdminInvitationSummary => ({
  id: inv.id,
  email: inv.email,
  state: inv.state,
  organizationId: inv.organizationId ?? null,
  roleSlug: inv.roleSlug ?? null,
  createdAt: inv.createdAt,
  expiresAt: inv.expiresAt,
  acceptedAt: inv.acceptedAt ?? null,
})

const toUserSummary = (user: WorkOSUser): AdminUserSummary => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName ?? null,
  lastName: user.lastName ?? null,
  emailVerified: user.emailVerified ?? false,
  profilePictureUrl: user.profilePictureUrl ?? null,
  lastSignInAt: user.lastSignInAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

export const createAdminOrganization = async (params: {
  name: string
  domains?: string[]
  externalId?: string
}): Promise<AdminOrganizationSummary> => {
  const workos = getWorkOS()

  const domainData = params.domains?.map((domain) => ({
    domain,
    state: "pending",
  })) as { domain: string; state: string }[] | undefined

  const org = await workos.organizations.createOrganization({
    name: params.name,
    // @ts-expect-error - WorkOS SDK types may not match
    domainData,
    externalId: params.externalId,
  })

  return toOrganizationSummary(org as WorkOSOrganization)
}

export const sendAdminInvitation = async (params: {
  email: string
  organizationId: string
  inviterUserId: string
  roleSlug: string
  expiresInDays?: number
}): Promise<AdminInvitationSummary> => {
  const workos = getWorkOS()

  const invitation = await workos.userManagement.sendInvitation({
    email: params.email,
    organizationId: params.organizationId,
    inviterUserId: params.inviterUserId,
    roleSlug: params.roleSlug,
    expiresInDays: params.expiresInDays,
  })

  return toInvitationSummary(invitation as WorkOSInvitation)
}

export type ListOrganizationsParams = {
  limit?: number
  before?: string
  after?: string
}

export type ListOrganizationsResult = {
  organizations: AdminOrganizationSummary[]
  listMetadata?: {
    before?: string
    after?: string
  }
}

export type AdminMembershipSummary = {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  roleSlug: string
  joinedAt: string
}

export type AdminInvitationPendingSummary = {
  id: string
  email: string
  roleSlug: string
  createdAt: string
  expiresAt: string
}

export type ListOrganizationMembersResult = {
  memberships: AdminMembershipSummary[]
  pendingInvitations: AdminInvitationPendingSummary[]
}

export const listAdminOrganizationMembers = async (
  organizationId: string
): Promise<ListOrganizationMembersResult> => {
  const workos = getWorkOS()

  const [membershipsResult, invitationsResult] = await Promise.all([
    workos.userManagement.listOrganizationMemberships({ organizationId }),
    workos.userManagement.listInvitations({ organizationId }),
  ])

  const memberships: AdminMembershipSummary[] = (
    membershipsResult.data as unknown as WorkOSMembership[]
  ).map((m) => ({
    id: m.id,
    userId: m.userId,
    email: m.user?.email ?? "",
    firstName: m.user?.firstName ?? null,
    lastName: m.user?.lastName ?? null,
    roleSlug: m.role?.slug ?? "member",
    joinedAt: m.createdAt,
  }))

  const pendingInvitations: AdminInvitationPendingSummary[] = (
    invitationsResult.data as unknown as WorkOSInvitation[]
  )
    .filter((inv) => inv.state === "pending")
    .map((inv) => ({
      id: inv.id,
      email: inv.email,
      roleSlug: inv.roleSlug ?? "member",
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    }))

  return { memberships, pendingInvitations }
}

export const listAdminOrganizations = async (
  params: ListOrganizationsParams = {}
): Promise<ListOrganizationsResult> => {
  const workos = getWorkOS()

  const result = await workos.organizations.listOrganizations({
    limit: params.limit,
    before: params.before,
    after: params.after,
  })

  return {
    organizations: result.data.map(toOrganizationSummary),
    listMetadata: result.listMetadata
      ? {
          before: result.listMetadata.before ?? undefined,
          after: result.listMetadata.after ?? undefined,
        }
      : undefined,
  }
}

export type ListUsersParams = {
  limit?: number
  before?: string
  after?: string
  email?: string
  organizationId?: string
}

export type ListUsersResult = {
  users: AdminUserSummary[]
  listMetadata?: {
    before?: string
    after?: string
  }
}

export const listAdminUsers = async (
  params: ListUsersParams = {}
): Promise<ListUsersResult> => {
  const workos = getWorkOS()

  const result = await workos.userManagement.listUsers({
    limit: params.limit,
    before: params.before,
    after: params.after,
    email: params.email,
    organizationId: params.organizationId,
  })

  return {
    users: (result.data as unknown as WorkOSUser[]).map(toUserSummary),
    listMetadata: result.listMetadata
      ? {
          before: result.listMetadata.before ?? undefined,
          after: result.listMetadata.after ?? undefined,
        }
      : undefined,
  }
}

export const getAdminUser = async (
  userId: string
): Promise<AdminUserDetail> => {
  const workos = getWorkOS()

  const [user, membershipsResult] = await Promise.all([
    workos.userManagement.getUser(userId),
    workos.userManagement.listOrganizationMemberships({ userId }),
  ])

  const membershipsData =
    membershipsResult.data as unknown as WorkOSMembership[]

  const memberships: AdminUserMembership[] = await Promise.all(
    membershipsData.map(async (m) => {
      const org = await getCachedOrganization(m.organizationId)
      return {
        id: m.id,
        organizationId: m.organizationId,
        organizationName: org?.name ?? null,
        status: m.status,
        roleSlug: m.role?.slug ?? "member",
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }
    })
  )

  return {
    ...toUserSummary(user as unknown as WorkOSUser),
    memberships,
  }
}

export type ListInvitationsParams = {
  limit?: number
  before?: string
  after?: string
  organizationId?: string
}

export type ListInvitationsResult = {
  invitations: AdminInvitationSummary[]
  listMetadata?: {
    before?: string
    after?: string
  }
}

export const listAdminInvitations = async (
  params: ListInvitationsParams = {}
): Promise<ListInvitationsResult> => {
  const workos = getWorkOS()

  const result = await workos.userManagement.listInvitations({
    limit: params.limit,
    before: params.before,
    after: params.after,
    organizationId: params.organizationId,
  })

  const rawInvitations = result.data as unknown as WorkOSInvitation[]

  const invitations: AdminInvitationSummary[] = await Promise.all(
    rawInvitations.map(async (inv) => {
      const org = inv.organizationId
        ? await getCachedOrganization(inv.organizationId)
        : null

      return {
        ...toInvitationSummary(inv),
        organizationName: org?.name ?? null,
      }
    })
  )

  return {
    invitations,
    listMetadata: result.listMetadata
      ? {
          before: result.listMetadata.before ?? undefined,
          after: result.listMetadata.after ?? undefined,
        }
      : undefined,
  }
}

export const revokeAdminInvitation = async (
  invitationId: string
): Promise<AdminInvitationSummary> => {
  const workos = getWorkOS()
  const result = await workos.userManagement.revokeInvitation(invitationId)
  return toInvitationSummary(result as unknown as WorkOSInvitation)
}
