import { getWorkOS } from "@workos-inc/authkit-nextjs"

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
  roleSlug: string | null
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
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

const toOrganizationSummary = (org: WorkOSOrganization): AdminOrganizationSummary => ({
  id: org.id,
  name: org.name,
  externalId: org.externalId ?? null,
  domains: org.domains?.map((d) => d.domain) ?? [],
  allowProfilesOutsideOrganization: org.allowProfilesOutsideOrganization ?? false,
  createdAt: org.createdAt,
  updatedAt: org.updatedAt,
})

const toInvitationSummary = (inv: WorkOSInvitation): AdminInvitationSummary => ({
  id: inv.id,
  email: inv.email,
  state: inv.state,
  organizationId: inv.organizationId ?? null,
  roleSlug: inv.roleSlug ?? null,
  createdAt: inv.createdAt,
  expiresAt: inv.expiresAt,
  acceptedAt: inv.acceptedAt ?? null,
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