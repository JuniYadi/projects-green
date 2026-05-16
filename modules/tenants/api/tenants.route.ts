import { Elysia } from "elysia"
import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs"
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
  const memberships = await getWorkOS().userManagement
    .listOrganizationMemberships({
      organizationId,
      statuses: ["active", "inactive", "pending"],
    })
    .then((result) => result.autoPagination())

  return memberships.map(toMembershipSummary)
}

const getMembershipById = async (membershipId: string) => {
  const membership = await getWorkOS().userManagement.getOrganizationMembership(
    membershipId
  )

  return toMembershipSummary(membership)
}

export const tenantsRoutes = new Elysia()
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

    const invitations = await getWorkOS().userManagement
      .listInvitations({
        organizationId: params.orgId,
      })
      .then((result) => result.autoPagination())

    return {
      ok: true as const,
      orgId: params.orgId,
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        state: invitation.state,
        organizationId: invitation.organizationId,
        inviterUserId: invitation.inviterUserId,
        acceptedUserId: invitation.acceptedUserId,
        roleSlug: invitation.roleSlug,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      })),
    }
  })
  .post(
    "/tenants/:orgId/invitations",
    async ({ params, body, set }) => {
      const actor = await getActorContext()

      if (!actor) {
        return toUnauthorizedError(set)
      }

      const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
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
        roleSlug: body.targetRole,
      })

      set.status = 201

      return {
        ok: true as const,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          state: invitation.state,
          organizationId: invitation.organizationId,
          roleSlug: invitation.roleSlug,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
        },
      }
    },
    {
      body: invitationPayloadSchema,
    }
  )
  .post(
    "/tenants/:orgId/members/:memberId/promote",
    async ({ params, body, set }) => {
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

      if (body.targetRole === "owner" && actor.platformRole !== "super_admin" && actor.tenantRole !== "owner") {
        return toPolicyError(
          set,
          "OWNER_PROMOTION_FORBIDDEN",
          "Only owner can promote members to owner."
        )
      }

      const updated = await getWorkOS().userManagement.updateOrganizationMembership(
        targetMembership.id,
        {
          roleSlug: body.targetRole,
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

    const updated = await getWorkOS().userManagement.updateOrganizationMembership(
      targetMembership.id,
      {
        roleSlug: "member",
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

      const hasContextAccess = ensureTenantContextAccess(params.orgId, actor, set)
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

      const targetMembership = await getMembershipById(body.newOwnerMembershipId)

      if (targetMembership.organizationId !== params.orgId) {
        return toPolicyError(
          set,
          "MEMBERSHIP_ORG_MISMATCH",
          "Target membership does not belong to the requested tenant."
        )
      }

      const promoted = await getWorkOS().userManagement.updateOrganizationMembership(
        targetMembership.id,
        {
          roleSlug: "owner",
        }
      )

      if (actor.platformRole !== "super_admin" && actor.userId !== targetMembership.userId) {
        const memberships = await listTenantMemberships(params.orgId)
        const actorMembership = memberships.find(
          (membership) => membership.userId === actor.userId
        )

        if (actorMembership?.role === "owner") {
          await getWorkOS().userManagement.updateOrganizationMembership(
            actorMembership.id,
            {
              roleSlug: "admin",
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
