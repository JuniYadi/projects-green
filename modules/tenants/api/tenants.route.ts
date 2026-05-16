import { Elysia } from "elysia"
import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs"
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"
import { z } from "zod"

import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  buildAllowedActions,
  canDemoteFromRole,
  canInviteAsRole,
  canManageTenant,
  canPromoteToRole,
  canTransferOwnership,
  normalizeTenantRole,
  resolveTenantRoleFromClaims,
  TenantRole,
} from "@/modules/tenants/tenant-policy"

const tenantRoleSchema = z.enum(["owner", "admin", "member"])

const invitationPayloadSchema = z.object({
  email: z.email("Please enter a valid email address."),
  targetRole: tenantRoleSchema.default("member"),
})

const promotePayloadSchema = z.object({
  targetRole: z.enum(["admin", "owner"]).default("admin"),
})

const transferOwnershipPayloadSchema = z.object({
  newOwnerMembershipId: z
    .string()
    .trim()
    .min(1, "newOwnerMembershipId is required."),
})

const bootstrapCreatePayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name must be at most 80 characters."),
})

const organizationUpdatePayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name must be at most 80 characters."),
})

const organizationDeletePayloadSchema = z.object({
  confirmOrganizationName: z
    .string()
    .trim()
    .min(1, "Please enter the organization name to confirm deletion."),
})

const BOOTSTRAP_CREATOR_ROLE_SLUG = "user_owner"
const SCOPED_TENANT_ROLE_SLUG: Record<TenantRole, string> = {
  owner: "user_owner",
  admin: "user_admin",
  member: "user_member",
}

type MembershipSummary = {
  id: string
  organizationId: string
  userId: string
  status: string
  role: TenantRole | null
  roleSlug: string | null
  createdAt: string
  updatedAt: string
}

type InvitationSummary = {
  id: string
  email: string
  state: string
  organizationId: string | null
  inviterUserId: string | null
  acceptedUserId: string | null
  roleSlug: string | null
  createdAt: string
  expiresAt: string
}

type OrganizationSummary = {
  id: string
  name: string
  allowProfilesOutsideOrganization: boolean
  createdAt: string
  updatedAt: string
}

const toMembershipSummary = (membership: {
  id: string
  organizationId: string
  userId: string
  status: string
  createdAt: string
  updatedAt: string
  role?: { slug?: string | null } | null
}) => {
  const roleSlug = membership.role?.slug ?? null
  const normalizedRole = normalizeTenantRole(roleSlug)

  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    status: membership.status,
    role: normalizedRole,
    roleSlug,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  } satisfies MembershipSummary
}

const toInvitationSummary = (invitation: {
  id: string
  email: string
  state: string
  organizationId: string | null
  inviterUserId: string | null
  acceptedUserId: string | null
  roleSlug: string | null
  createdAt: string
  expiresAt: string
}) => {
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
  } satisfies InvitationSummary
}

const toOrganizationSummary = (organization: {
  id: string
  name: string
  allowProfilesOutsideOrganization?: boolean
  createdAt: string
  updatedAt: string
}) => {
  return {
    id: organization.id,
    name: organization.name,
    allowProfilesOutsideOrganization:
      organization.allowProfilesOutsideOrganization ?? false,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  } satisfies OrganizationSummary
}

const isActiveOwner = (membership: MembershipSummary) => {
  return membership.status === "active" && membership.role === "owner"
}

type RouteSet = { status?: number | string }

const toPolicyError = (set: RouteSet, policyCode: string, message: string) => {
  set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    policyCode,
    message,
  }
}

const toUnauthorizedError = (set: RouteSet) => {
  set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to manage tenants.",
  }
}

const getActorContext = async () => {
  const auth = await withAuth()

  if (!auth.user) {
    return null
  }

  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  const tenantRole = resolveTenantRoleFromClaims(auth.role, auth.roles)

  return {
    userId: auth.user.id,
    organizationId: auth.organizationId ?? null,
    platformRole,
    tenantRole,
  }
}

const ensureTenantContextAccess = (
  orgId: string,
  actor: {
    organizationId: string | null
    platformRole: "none" | "super_admin"
    tenantRole: TenantRole | null
  },
  set: RouteSet
) => {
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
    return toPolicyError(
      set,
      "TENANT_ROLE_REQUIRED",
      "No valid tenant role is present for this organization."
    )
  }

  return true
}

const listTenantMemberships = async (organizationId: string) => {
  const memberships = await getWorkOS()
    .userManagement.listOrganizationMemberships({
      organizationId,
      statuses: ["active", "inactive", "pending"],
    })
    .then((result) => result.autoPagination())

  return memberships.map(toMembershipSummary)
}

const getMembershipById = async (membershipId: string) => {
  const membership =
    await getWorkOS().userManagement.getOrganizationMembership(membershipId)

  return toMembershipSummary(membership)
}

const getInvitationById = async (invitationId: string) => {
  const invitation =
    await getWorkOS().userManagement.getInvitation(invitationId)
  return toInvitationSummary(invitation)
}

const getOrganizationById = async (organizationId: string) => {
  const organization =
    await getWorkOS().organizations.getOrganization(organizationId)
  return toOrganizationSummary(organization)
}

const listMembershipsForUser = async (userId: string) => {
  return getWorkOS()
    .userManagement.listOrganizationMemberships({
      userId,
      statuses: ["active", "pending"],
    })
    .then((result) => result.autoPagination())
}

const hasBootstrapCreatorRole = async (organizationId: string) => {
  const roleList =
    await getWorkOS().authorization.listOrganizationRoles(organizationId)
  const roleSlugs = new Set(
    roleList.data
      .map((role) => role.slug?.trim().toLowerCase())
      .filter((role): role is string => Boolean(role))
  )

  return roleSlugs.has(BOOTSTRAP_CREATOR_ROLE_SLUG)
}

const toScopedTenantRoleSlug = (role: TenantRole) => {
  return SCOPED_TENANT_ROLE_SLUG[role]
}

export const tenantsRoutes = new Elysia()
  .get("/tenants/bootstrap", async ({ set }) => {
    const actor = await getActorContext()

    if (!actor) {
      return toUnauthorizedError(set)
    }

    const memberships = await listMembershipsForUser(actor.userId)

    return {
      ok: true as const,
      currentOrganizationId: actor.organizationId,
      memberships: memberships.map((membership) => ({
        organizationId: membership.organizationId,
        organizationName: membership.organizationName,
        status: membership.status,
        roleSlug: membership.role?.slug ?? null,
      })),
    }
  })
  .post(
    "/tenants/bootstrap/create",
    async ({ body, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      if (actor.organizationId) {
        set.status = 409
        return {
          ok: false as const,
          error: "ORGANIZATION_CONTEXT_EXISTS" as const,
          message:
            "You already have an active organization context in this session.",
        }
      }

      const existingMemberships = await listMembershipsForUser(actor.userId)
      const activeMembership = existingMemberships.find(
        (membership) => membership.status === "active"
      )

      if (activeMembership) {
        set.status = 409
        return {
          ok: false as const,
          error: "ACTIVE_MEMBERSHIP_EXISTS" as const,
          message:
            "You already belong to an organization. Select and join it instead.",
        }
      }

      try {
        const organization = await getWorkOS().organizations.createOrganization(
          {
            name: body.name.trim(),
          }
        )

        const creatorRoleIsAvailable = await hasBootstrapCreatorRole(
          organization.id
        )

        if (!creatorRoleIsAvailable) {
          await getWorkOS()
            .organizations.deleteOrganization(organization.id)
            .catch(() => null)
          set.status = 422
          return {
            ok: false as const,
            error: "CREATOR_ROLE_MISSING" as const,
            message:
              "Required WorkOS role 'user_owner' is missing. Run `bun run seed:workos-roles` and retry.",
          }
        }

        await getWorkOS().userManagement.createOrganizationMembership({
          organizationId: organization.id,
          userId: actor.userId,
          roleSlug: BOOTSTRAP_CREATOR_ROLE_SLUG,
        })

        set.status = 201

        return {
          ok: true as const,
          organizationId: organization.id,
        }
      } catch (error) {
        if (error instanceof ConflictException) {
          set.status = 409
          return {
            ok: false as const,
            error: "ORGANIZATION_CONFLICT" as const,
            message:
              "Organization bootstrap could not be completed due to a conflict.",
          }
        }

        if (error instanceof UnprocessableEntityException) {
          set.status = 422
          return {
            ok: false as const,
            error: "ORGANIZATION_BOOTSTRAP_INVALID" as const,
            message: error.message,
          }
        }

        if (error instanceof NotFoundException) {
          set.status = 404
          return {
            ok: false as const,
            error: "ORGANIZATION_BOOTSTRAP_NOT_FOUND" as const,
            message:
              "Organization bootstrap failed because a required WorkOS resource was not found.",
          }
        }

        set.status = 500
        return {
          ok: false as const,
          error: "ORGANIZATION_BOOTSTRAP_FAILED" as const,
          message: "Unable to create organization right now.",
        }
      }
    },
    {
      body: bootstrapCreatePayloadSchema,
    }
  )
  .get("/tenants/:orgId/authorization", async ({ params, set }) => {
    const actor = await getActorContext()

    if (!actor) {
      return toUnauthorizedError(set)
    }

    const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    return {
      ok: true as const,
      orgId: params.orgId,
      effectiveGlobalRole: actor.platformRole,
      effectiveTenantRole: actor.tenantRole,
      allowedActions: buildAllowedActions({
        platformRole: actor.platformRole,
        tenantRole: actor.tenantRole,
      }),
    }
  })
  .get("/tenants/:orgId/members", async ({ params, set }) => {
    const actor = await getActorContext()

    if (!actor) {
      return toUnauthorizedError(set)
    }

    const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    if (
      !canManageTenant({
        platformRole: actor.platformRole,
        tenantRole: actor.tenantRole,
      })
    ) {
      return toPolicyError(
        set,
        "TENANT_MANAGE_REQUIRED",
        "You do not have permission to manage members in this tenant."
      )
    }

    const memberships = await listTenantMemberships(params.orgId)

    return {
      ok: true as const,
      orgId: params.orgId,
      members: memberships,
    }
  })
  .post("/tenants/:orgId/members/:memberId/remove", async ({ params, set }) => {
    const actor = await getActorContext()

    if (!actor) {
      return toUnauthorizedError(set)
    }

    const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    if (
      !canManageTenant({
        platformRole: actor.platformRole,
        tenantRole: actor.tenantRole,
      })
    ) {
      return toPolicyError(
        set,
        "TENANT_MANAGE_REQUIRED",
        "You do not have permission to remove members in this tenant."
      )
    }

    const targetMembership = await getMembershipById(params.memberId)

    if (targetMembership.organizationId !== params.orgId) {
      return toPolicyError(
        set,
        "MEMBERSHIP_ORG_MISMATCH",
        "Membership does not belong to the requested tenant."
      )
    }

    const currentRole = targetMembership.role

    if (
      currentRole &&
      !canDemoteFromRole(
        {
          platformRole: actor.platformRole,
          tenantRole: actor.tenantRole,
        },
        currentRole
      )
    ) {
      return toPolicyError(
        set,
        "REMOVE_FORBIDDEN",
        `You are not allowed to remove a user with role ${currentRole}.`
      )
    }

    const memberships = await listTenantMemberships(params.orgId)
    const activeOwnerCount = memberships.filter(isActiveOwner).length

    if (isActiveOwner(targetMembership) && activeOwnerCount <= 1) {
      return toPolicyError(
        set,
        "LAST_OWNER_PROTECTED",
        "Cannot remove the last active owner in this tenant."
      )
    }

    await getWorkOS().userManagement.deleteOrganizationMembership(
      targetMembership.id
    )

    return {
      ok: true as const,
      removedMemberId: targetMembership.id,
    }
  })
  .get("/tenants/:orgId/invitations", async ({ params, set }) => {
    const actor = await getActorContext()

    if (!actor) {
      return toUnauthorizedError(set)
    }

    const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    if (
      !canManageTenant({
        platformRole: actor.platformRole,
        tenantRole: actor.tenantRole,
      })
    ) {
      return toPolicyError(
        set,
        "TENANT_MANAGE_REQUIRED",
        "You do not have permission to view invitations in this tenant."
      )
    }

    const invitations = await getWorkOS()
      .userManagement.listInvitations({
        organizationId: params.orgId,
      })
      .then((result) => result.autoPagination())

    return {
      ok: true as const,
      orgId: params.orgId,
      invitations: invitations.map(toInvitationSummary),
    }
  })
  .post(
    "/tenants/:orgId/invitations",
    async ({ params, body, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actor,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      if (
        !canInviteAsRole(
          {
            platformRole: actor.platformRole,
            tenantRole: actor.tenantRole,
          },
          body.targetRole
        )
      ) {
        return toPolicyError(
          set,
          "INVITE_ROLE_FORBIDDEN",
          `You are not allowed to invite users as ${body.targetRole}.`
        )
      }

      const invitation = await getWorkOS().userManagement.sendInvitation({
        email: body.email.trim().toLowerCase(),
        organizationId: params.orgId,
        inviterUserId: actor.userId,
        roleSlug: toScopedTenantRoleSlug(body.targetRole),
      })

      set.status = 201

      return {
        ok: true as const,
        invitation: toInvitationSummary(invitation),
      }
    },
    {
      body: invitationPayloadSchema,
    }
  )
  .post(
    "/tenants/:orgId/invitations/:invitationId/revoke",
    async ({ params, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actor,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      if (
        !canManageTenant({
          platformRole: actor.platformRole,
          tenantRole: actor.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "TENANT_MANAGE_REQUIRED",
          "You do not have permission to revoke invitations in this tenant."
        )
      }

      const invitation = await getInvitationById(params.invitationId)
      const invitationRole = normalizeTenantRole(invitation.roleSlug)

      if (invitation.organizationId !== params.orgId) {
        return toPolicyError(
          set,
          "INVITATION_ORG_MISMATCH",
          "Invitation does not belong to the requested tenant."
        )
      }

      if (
        invitationRole &&
        !canInviteAsRole(
          {
            platformRole: actor.platformRole,
            tenantRole: actor.tenantRole,
          },
          invitationRole
        )
      ) {
        return toPolicyError(
          set,
          "INVITATION_REVOKE_FORBIDDEN",
          `You are not allowed to revoke ${invitationRole} invitations.`
        )
      }

      await getWorkOS().userManagement.revokeInvitation(invitation.id)

      return {
        ok: true as const,
        revokedInvitationId: invitation.id,
      }
    }
  )
  .post(
    "/tenants/:orgId/invitations/:invitationId/resend",
    async ({ params, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actor,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      if (
        !canManageTenant({
          platformRole: actor.platformRole,
          tenantRole: actor.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "TENANT_MANAGE_REQUIRED",
          "You do not have permission to resend invitations in this tenant."
        )
      }

      const invitation = await getInvitationById(params.invitationId)
      const invitationRole = normalizeTenantRole(invitation.roleSlug)

      if (invitation.organizationId !== params.orgId) {
        return toPolicyError(
          set,
          "INVITATION_ORG_MISMATCH",
          "Invitation does not belong to the requested tenant."
        )
      }

      if (
        invitationRole &&
        !canInviteAsRole(
          {
            platformRole: actor.platformRole,
            tenantRole: actor.tenantRole,
          },
          invitationRole
        )
      ) {
        return toPolicyError(
          set,
          "INVITATION_RESEND_FORBIDDEN",
          `You are not allowed to resend ${invitationRole} invitations.`
        )
      }

      const resentInvitation =
        await getWorkOS().userManagement.resendInvitation(invitation.id)

      return {
        ok: true as const,
        invitation: toInvitationSummary(resentInvitation),
      }
    }
  )
  .get("/tenants/:orgId/organization", async ({ params, set }) => {
    const actor = await getActorContext()

    if (!actor) {
      return toUnauthorizedError(set)
    }

    const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    if (
      !canManageTenant({
        platformRole: actor.platformRole,
        tenantRole: actor.tenantRole,
      })
    ) {
      return toPolicyError(
        set,
        "TENANT_MANAGE_REQUIRED",
        "You do not have permission to view organization settings."
      )
    }

    const organization = await getOrganizationById(params.orgId)

    return {
      ok: true as const,
      orgId: params.orgId,
      organization,
    }
  })
  .post(
    "/tenants/:orgId/organization/update",
    async ({ params, body, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actor,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      if (
        !canManageTenant({
          platformRole: actor.platformRole,
          tenantRole: actor.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "TENANT_MANAGE_REQUIRED",
          "You do not have permission to update organization settings."
        )
      }

      try {
        const updatedOrganization =
          await getWorkOS().organizations.updateOrganization({
            organization: params.orgId,
            name: body.name.trim(),
          })

        return {
          ok: true as const,
          organization: toOrganizationSummary(updatedOrganization),
        }
      } catch (error) {
        if (error instanceof UnprocessableEntityException) {
          set.status = 422
          return {
            ok: false as const,
            error: "ORGANIZATION_UPDATE_INVALID" as const,
            message: error.message,
          }
        }

        if (error instanceof NotFoundException) {
          set.status = 404
          return {
            ok: false as const,
            error: "ORGANIZATION_NOT_FOUND" as const,
            message: "The organization could not be found.",
          }
        }

        set.status = 500
        return {
          ok: false as const,
          error: "ORGANIZATION_UPDATE_FAILED" as const,
          message: "Unable to update organization settings right now.",
        }
      }
    },
    {
      body: organizationUpdatePayloadSchema,
    }
  )
  .post(
    "/tenants/:orgId/organization/delete",
    async ({ params, body, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actor,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      if (
        !canTransferOwnership({
          platformRole: actor.platformRole,
          tenantRole: actor.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "ORGANIZATION_DELETE_FORBIDDEN",
          "Only owners can delete the organization."
        )
      }

      const organization = await getOrganizationById(params.orgId)
      const expectedName = organization.name.trim()

      if (body.confirmOrganizationName.trim() !== expectedName) {
        set.status = 422
        return {
          ok: false as const,
          error: "ORGANIZATION_DELETE_CONFIRMATION_MISMATCH" as const,
          message:
            "Confirmation does not match the organization name. Deletion cancelled.",
        }
      }

      await getWorkOS().organizations.deleteOrganization(params.orgId)

      return {
        ok: true as const,
        organizationDeleted: true,
        organizationId: params.orgId,
      }
    },
    {
      body: organizationDeletePayloadSchema,
    }
  )
  .post(
    "/tenants/:orgId/members/:memberId/promote",
    async ({ params, body, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actor,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      const targetMembership = await getMembershipById(params.memberId)

      if (targetMembership.organizationId !== params.orgId) {
        return toPolicyError(
          set,
          "MEMBERSHIP_ORG_MISMATCH",
          "Membership does not belong to the requested tenant."
        )
      }

      if (
        !canPromoteToRole(
          {
            platformRole: actor.platformRole,
            tenantRole: actor.tenantRole,
          },
          body.targetRole
        )
      ) {
        return toPolicyError(
          set,
          "PROMOTION_FORBIDDEN",
          `You are not allowed to promote users to ${body.targetRole}.`
        )
      }

      if (
        body.targetRole === "owner" &&
        actor.platformRole !== "super_admin" &&
        actor.tenantRole !== "owner"
      ) {
        return toPolicyError(
          set,
          "OWNER_PROMOTION_FORBIDDEN",
          "Only owner can promote members to owner."
        )
      }

      const updated =
        await getWorkOS().userManagement.updateOrganizationMembership(
          targetMembership.id,
          {
            roleSlug: toScopedTenantRoleSlug(body.targetRole),
          }
        )

      return {
        ok: true as const,
        membership: toMembershipSummary(updated),
      }
    },
    {
      body: promotePayloadSchema,
    }
  )
  .post("/tenants/:orgId/members/:memberId/demote", async ({ params, set }) => {
    const actor = await getActorContext()

    if (!actor) {
      return toUnauthorizedError(set)
    }

    const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    const targetMembership = await getMembershipById(params.memberId)

    if (targetMembership.organizationId !== params.orgId) {
      return toPolicyError(
        set,
        "MEMBERSHIP_ORG_MISMATCH",
        "Membership does not belong to the requested tenant."
      )
    }

    const currentRole = targetMembership.role

    if (!currentRole || currentRole === "member") {
      return toPolicyError(
        set,
        "DEMOTION_NOT_APPLICABLE",
        "Target member is already in member role."
      )
    }

    if (
      !canDemoteFromRole(
        {
          platformRole: actor.platformRole,
          tenantRole: actor.tenantRole,
        },
        currentRole
      )
    ) {
      return toPolicyError(
        set,
        "DEMOTION_FORBIDDEN",
        `You are not allowed to demote a user with role ${currentRole}.`
      )
    }

    const memberships = await listTenantMemberships(params.orgId)
    const activeOwnerCount = memberships.filter(isActiveOwner).length
    const isSelfDemotion = targetMembership.userId === actor.userId

    if (currentRole === "owner" && activeOwnerCount <= 1) {
      return toPolicyError(
        set,
        "LAST_OWNER_PROTECTED",
        "Cannot demote the last active owner in this tenant."
      )
    }

    if (isSelfDemotion && currentRole === "owner" && activeOwnerCount <= 1) {
      return toPolicyError(
        set,
        "SELF_DEMOTION_BLOCKED",
        "Self-demotion is blocked because this would remove the last owner."
      )
    }

    const updated =
      await getWorkOS().userManagement.updateOrganizationMembership(
        targetMembership.id,
        {
          roleSlug: toScopedTenantRoleSlug("member"),
        }
      )

    return {
      ok: true as const,
      membership: toMembershipSummary(updated),
    }
  })
  .post(
    "/tenants/:orgId/ownership/transfer",
    async ({ params, body, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actor,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      if (
        !canTransferOwnership({
          platformRole: actor.platformRole,
          tenantRole: actor.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "OWNERSHIP_TRANSFER_FORBIDDEN",
          "Only owner can transfer tenant ownership."
        )
      }

      const targetMembership = await getMembershipById(
        body.newOwnerMembershipId
      )

      if (targetMembership.organizationId !== params.orgId) {
        return toPolicyError(
          set,
          "MEMBERSHIP_ORG_MISMATCH",
          "Target membership does not belong to the requested tenant."
        )
      }

      const promoted =
        await getWorkOS().userManagement.updateOrganizationMembership(
          targetMembership.id,
          {
            roleSlug: toScopedTenantRoleSlug("owner"),
          }
        )

      if (
        actor.platformRole !== "super_admin" &&
        actor.userId !== targetMembership.userId
      ) {
        const memberships = await listTenantMemberships(params.orgId)
        const actorMembership = memberships.find(
          (membership) => membership.userId === actor.userId
        )

        if (actorMembership?.role === "owner") {
          await getWorkOS().userManagement.updateOrganizationMembership(
            actorMembership.id,
            {
              roleSlug: toScopedTenantRoleSlug("admin"),
            }
          )
        }
      }

      return {
        ok: true as const,
        ownershipTransferred: true,
        membership: toMembershipSummary(promoted),
      }
    },
    {
      body: transferOwnershipPayloadSchema,
    }
  )
