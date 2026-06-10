import type { PlatformAccessRole } from "@/lib/platform-role"
import type { TenantAction, TenantRole } from "@/modules/tenants/tenant-policy"

export type TenantApiError = {
  ok: false
  error: string
  message: string
  policyCode?: string
}

export const isTenantApiError = (value: unknown): value is TenantApiError => {
  const candidate = value as {
    ok?: boolean
    error?: unknown
    message?: unknown
  }

  return Boolean(
    value &&
    typeof value === "object" &&
    "ok" in value &&
    candidate.ok === false &&
    "error" in value &&
    typeof candidate.error === "string" &&
    "message" in value &&
    typeof candidate.message === "string"
  )
}

export type TenantBootstrapMembership = {
  organizationId: string
  organizationName: string
  status: string
  roleSlug: string | null
}

export type TenantBootstrapResponse = {
  ok: true
  currentOrganizationId: string | null
  memberships: TenantBootstrapMembership[]
}

export type TenantBillingCurrency = "IDR" | "USD"

export type TenantBootstrapCreateResponse = {
  ok: true
  organizationId: string
}

export type TenantOrganizationCreateResponse = TenantBootstrapCreateResponse

export type TenantMembershipSummary = {
  id: string
  organizationId: string
  userId: string
  displayName: string
  email: string | null
  avatarUrl: string | null
  status: string
  role: TenantRole | null
  roleSlug: string | null
  profile: {
    email: string | null
    firstName: string | null
    lastName: string | null
    profilePictureUrl: string | null
    displayName: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export type TenantInvitationSummary = {
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

export type TenantInvitationCreatedSummary = {
  id: string
  email: string
  state: string
  organizationId: string
  roleSlug: string | null
  createdAt: string
  expiresAt: string
}

export type TenantAuthorizationResponse = {
  ok: true
  orgId: string
  effectiveGlobalRole: PlatformAccessRole
  effectiveTenantRole: TenantRole | null
  allowedActions: TenantAction[]
}

export type TenantMembersResponse = {
  ok: true
  orgId: string
  members: TenantMembershipSummary[]
}

export type TenantInvitationsResponse = {
  ok: true
  orgId: string
  invitations: TenantInvitationSummary[]
}

export type TenantInvitationCreateResponse = {
  ok: true
  invitation: TenantInvitationCreatedSummary
}

export type TenantMembershipMutationResponse = {
  ok: true
  membership: TenantMembershipSummary
}

export type TenantOwnershipTransferResponse = {
  ok: true
  ownershipTransferred: true
  membership: TenantMembershipSummary
}

export type TenantMemberRemoveResponse = {
  ok: true
  removedMemberId: string
}

export type TenantInvitationRevokeResponse = {
  ok: true
  revokedInvitationId: string
}

export type TenantInvitationCancelResponse = {
  ok: true
  canceledInvitationId: string
}

export type TenantInvitationResendResponse = {
  ok: true
  invitation: TenantInvitationSummary
}

export type TenantOrganizationSummary = {
  id: string
  name: string
  metadata: Record<string, string>
  allowProfilesOutsideOrganization: boolean
  createdAt: string
  updatedAt: string
}

export type TenantOrganizationResponse = {
  ok: true
  orgId: string
  organization: TenantOrganizationSummary
}

export type TenantOrganizationUpdateResponse = {
  ok: true
  organization: TenantOrganizationSummary
}

export type TenantOrganizationDeleteResponse = {
  ok: true
  organizationDeleted: true
  organizationId: string
}
