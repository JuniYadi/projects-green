import { Elysia } from "elysia"

import {
  isTenantApiError,
  toNotFoundError,
  toPolicyError,
} from "@/modules/tenants/api/tenants.errors"
import {
  ensureTenantContextAccess,
  requireTenantActor,
} from "@/modules/tenants/api/tenants.guards"
import { promotePayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantMemberRemoveResponse,
  TenantMembersResponse,
  TenantMembershipMutationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import {
  deleteTenantMembershipSafely,
  getTenantMembershipById,
  updateTenantMembershipRole,
} from "@/modules/tenants/services/tenant-workos.service"
import {
  canDemoteFromRole,
  canManageTenant,
  canPromoteToRole,
} from "@/modules/tenants/tenant-policy"

export const tenantsMembershipRoutes = new Elysia()
  .get("/tenants/:orgId/members", async ({ params, set }) => {
    const actorResult = await requireTenantActor(set)
    if (isTenantApiError(actorResult)) {
      return actorResult
    }

    const hasContextAccess = ensureTenantContextAccess(
      params.orgId,
      actorResult,
      set
    )
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    if (
      !canManageTenant({
        platformRole: actorResult.platformRole,
        tenantRole: actorResult.tenantRole,
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
      ok: true,
      orgId: params.orgId,
      members: memberships,
    } satisfies TenantMembersResponse
  })
  .post(
    "/tenants/:orgId/members/:memberId/promote",
    async ({ params, body, set }) => {
      const actorResult = await requireTenantActor(set)
      if (isTenantApiError(actorResult)) {
        return actorResult
      }

      const hasContextAccess = ensureTenantContextAccess(
        params.orgId,
        actorResult,
        set
      )
      if (hasContextAccess !== true) {
        return hasContextAccess
      }

      const targetMembership = await getTenantMembershipById(params.memberId)
      if (!targetMembership) {
        return toNotFoundError(set, "Membership not found.")
      }

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
            platformRole: actorResult.platformRole,
            tenantRole: actorResult.tenantRole,
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
        actorResult.platformRole !== "super_admin" &&
        actorResult.tenantRole !== "owner"
      ) {
        return toPolicyError(
          set,
          "OWNER_PROMOTION_FORBIDDEN",
          "Only owner can promote members to owner."
        )
      }

      const updated = await updateTenantMembershipRole(
        targetMembership.id,
        body.targetRole
      )

      return {
        ok: true,
        membership: updated,
      } satisfies TenantMembershipMutationResponse
    },
    {
      body: promotePayloadSchema,
    }
  )
  .post("/tenants/:orgId/members/:memberId/demote", async ({ params, set }) => {
    const actorResult = await requireTenantActor(set)
    if (isTenantApiError(actorResult)) {
      return actorResult
    }

    const hasContextAccess = ensureTenantContextAccess(
      params.orgId,
      actorResult,
      set
    )
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    const targetMembership = await getTenantMembershipById(params.memberId)
    if (!targetMembership) {
      return toNotFoundError(set, "Membership not found.")
    }

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
          platformRole: actorResult.platformRole,
          tenantRole: actorResult.tenantRole,
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
    const activeOwnerCount = memberships.filter(isActiveOwnerMembership).length
    const isSelfDemotion = targetMembership.userId === actorResult.userId

    if (isSelfDemotion && currentRole === "owner" && activeOwnerCount <= 1) {
      return toPolicyError(
        set,
        "SELF_DEMOTION_BLOCKED",
        "Self-demotion is blocked because this would remove the last owner."
      )
    }

    if (currentRole === "owner" && activeOwnerCount <= 1) {
      return toPolicyError(
        set,
        "LAST_OWNER_PROTECTED",
        "Cannot demote the last active owner in this tenant."
      )
    }

    const updated = await updateTenantMembershipRole(
      targetMembership.id,
      "member"
    )

    return {
      ok: true,
      membership: updated,
    } satisfies TenantMembershipMutationResponse
  })
  .post("/tenants/:orgId/members/:memberId/remove", async ({ params, set }) => {
    const actorResult = await requireTenantActor(set)
    if (isTenantApiError(actorResult)) {
      return actorResult
    }

    const hasContextAccess = ensureTenantContextAccess(
      params.orgId,
      actorResult,
      set
    )
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    if (
      !canManageTenant({
        platformRole: actorResult.platformRole,
        tenantRole: actorResult.tenantRole,
      })
    ) {
      return toPolicyError(
        set,
        "TENANT_MANAGE_REQUIRED",
        "You do not have permission to remove members in this tenant."
      )
    }

    const targetMembership = await getTenantMembershipById(params.memberId)
    if (!targetMembership) {
      return toNotFoundError(set, "Membership not found.")
    }

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
          platformRole: actorResult.platformRole,
          tenantRole: actorResult.tenantRole,
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

    const deleteResult = await deleteTenantMembershipSafely({
      membershipId: targetMembership.id,
      organizationId: params.orgId,
      targetMembership,
    })

    if (!deleteResult.success) {
      return toPolicyError(
        set,
        "LAST_OWNER_PROTECTED",
        "Cannot remove the last active owner in this tenant."
      )
    }

    return {
      ok: true,
      removedMemberId: targetMembership.id,
    } satisfies TenantMemberRemoveResponse
  })
