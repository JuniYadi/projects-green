import { Elysia } from "elysia"

import {
  isTenantApiError,
  type RouteSet,
  toNotFoundError,
  toPolicyError,
  toWorkosApiError,
} from "@/modules/tenants/api/tenants.errors"
import { promotePayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantApiError,
  TenantMemberRemoveResponse,
  TenantMembersResponse,
  TenantMembershipMutationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import {
  deleteTenantMembershipSafely,
  demoteTenantMembershipSafely,
  getTenantMembershipById,
  listTenantMemberships,
  updateTenantMembershipRole,
} from "@/modules/tenants/services/tenant-workos.service"
import {
  canDemoteFromRole,
  canManageTenant,
  canPromoteToRole,
} from "@/modules/tenants/tenant-policy"

type TenantsMembershipRouteDeps = {
  requireTenantActor: (
    set: RouteSet
  ) => Promise<TenantActorContext | TenantApiError>
  ensureTenantContextAccess: (
    orgId: string,
    actor: TenantActorContext,
    set: RouteSet
  ) => true | TenantApiError | Promise<true | TenantApiError>
  listTenantMemberships: typeof listTenantMemberships
  getTenantMembershipById: typeof getTenantMembershipById
  updateTenantMembershipRole: typeof updateTenantMembershipRole
  demoteTenantMembershipSafely: typeof demoteTenantMembershipSafely
  deleteTenantMembershipSafely: typeof deleteTenantMembershipSafely
  canManageTenant: typeof canManageTenant
  canPromoteToRole: typeof canPromoteToRole
  canDemoteFromRole: typeof canDemoteFromRole
}

const defaultRequireTenantActor: TenantsMembershipRouteDeps["requireTenantActor"] =
  async (set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.requireTenantActor(set)
  }

const defaultEnsureTenantContextAccess: TenantsMembershipRouteDeps["ensureTenantContextAccess"] =
  async (orgId, actor, set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.ensureTenantContextAccess(orgId, actor, set)
  }

const defaultTenantsMembershipRouteDeps: TenantsMembershipRouteDeps = {
  requireTenantActor: defaultRequireTenantActor,
  ensureTenantContextAccess: defaultEnsureTenantContextAccess,
  listTenantMemberships,
  getTenantMembershipById,
  updateTenantMembershipRole,
  demoteTenantMembershipSafely,
  deleteTenantMembershipSafely,
  canManageTenant,
  canPromoteToRole,
  canDemoteFromRole,
}

export const createTenantsMembershipRoutes = (
  deps: Partial<TenantsMembershipRouteDeps> = {}
) => {
  const {
    requireTenantActor,
    ensureTenantContextAccess,
    listTenantMemberships,
    getTenantMembershipById,
    updateTenantMembershipRole,
    demoteTenantMembershipSafely,
    deleteTenantMembershipSafely,
    canManageTenant,
    canPromoteToRole,
    canDemoteFromRole,
  } = {
    ...defaultTenantsMembershipRouteDeps,
    ...deps,
  }

  return new Elysia()
    .get("/tenants/:orgId/members", async ({ params, set }) => {
      const actorResult = await requireTenantActor(set)
      if (isTenantApiError(actorResult)) {
        return actorResult
      }

      const hasContextAccess = await ensureTenantContextAccess(
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

      try {
        const memberships = await listTenantMemberships(params.orgId)

        return {
          ok: true,
          orgId: params.orgId,
          members: memberships,
        } satisfies TenantMembersResponse
      } catch (error) {
        return toWorkosApiError(set, error, {
          fallbackError: "TENANT_MEMBERS_LIST_FAILED",
          fallbackMessage: "Unable to load tenant members right now.",
        })
      }
    })
    .post(
      "/tenants/:orgId/members/:memberId/promote",
      async ({ params, body, set }) => {
        const actorResult = await requireTenantActor(set)
        if (isTenantApiError(actorResult)) {
          return actorResult
        }

        const hasContextAccess = await ensureTenantContextAccess(
          params.orgId,
          actorResult,
          set
        )
        if (hasContextAccess !== true) {
          return hasContextAccess
        }

        try {
          const targetMembership = await getTenantMembershipById(
            params.memberId
          )
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

          const updated = await updateTenantMembershipRole(
            targetMembership.id,
            body.targetRole
          )

          return {
            ok: true,
            membership: updated,
          } satisfies TenantMembershipMutationResponse
        } catch (error) {
          return toWorkosApiError(set, error, {
            fallbackError: "TENANT_MEMBER_PROMOTE_FAILED",
            fallbackMessage: "Unable to promote this member right now.",
          })
        }
      },
      {
        body: promotePayloadSchema,
      }
    )
    .post(
      "/tenants/:orgId/members/:memberId/demote",
      async ({ params, set }) => {
        const actorResult = await requireTenantActor(set)
        if (isTenantApiError(actorResult)) {
          return actorResult
        }

        const hasContextAccess = await ensureTenantContextAccess(
          params.orgId,
          actorResult,
          set
        )
        if (hasContextAccess !== true) {
          return hasContextAccess
        }

        try {
          const targetMembership = await getTenantMembershipById(
            params.memberId
          )
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

          const demoteResult = await demoteTenantMembershipSafely({
            membershipId: targetMembership.id,
            organizationId: params.orgId,
            targetMembership,
            actorUserId: actorResult.userId,
          })

          if (!demoteResult.success) {
            const errorMap = {
              SELF_DEMOTION_BLOCKED: {
                code: "SELF_DEMOTION_BLOCKED" as const,
                message:
                  "Self-demotion is blocked because this would remove the last owner.",
              },
              LAST_OWNER_PROTECTED: {
                code: "LAST_OWNER_PROTECTED" as const,
                message: "Cannot demote the last active owner in this tenant.",
              },
            }
            const err = errorMap[demoteResult.reason]
            return toPolicyError(set, err.code, err.message)
          }

          return {
            ok: true,
            membership: demoteResult.membership,
          } satisfies TenantMembershipMutationResponse
        } catch (error) {
          return toWorkosApiError(set, error, {
            fallbackError: "TENANT_MEMBER_DEMOTE_FAILED",
            fallbackMessage: "Unable to demote this member right now.",
          })
        }
      }
    )
    .post(
      "/tenants/:orgId/members/:memberId/remove",
      async ({ params, set }) => {
        const actorResult = await requireTenantActor(set)
        if (isTenantApiError(actorResult)) {
          return actorResult
        }

        const hasContextAccess = await ensureTenantContextAccess(
          params.orgId,
          actorResult,
          set
        )
        if (hasContextAccess !== true) {
          return hasContextAccess
        }

        try {
          const targetMembership = await getTenantMembershipById(
            params.memberId
          )
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

          const isSelfLeave = targetMembership.userId === actorResult.userId

          if (
            !isSelfLeave &&
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

          const currentRole = targetMembership.role

          // Reject removals when roleSlug exists but doesn't map to a known role
          if (!currentRole && targetMembership.roleSlug) {
            return toPolicyError(
              set,
              "REMOVE_FORBIDDEN",
              "Cannot remove a user with an unmapped role."
            )
          }

          if (
            !isSelfLeave &&
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
            actorUserId: actorResult.userId,
          })

          if (!deleteResult.success) {
            const errorMap = {
              SELF_LEAVE_BLOCKED: {
                code: "SELF_LEAVE_BLOCKED" as const,
                message:
                  "You cannot leave this tenant because you are the last active owner.",
              },
              LAST_OWNER_PROTECTED: {
                code: "LAST_OWNER_PROTECTED" as const,
                message: "Cannot remove the last active owner in this tenant.",
              },
            }
            const err = errorMap[deleteResult.reason]
            return toPolicyError(set, err.code, err.message)
          }

          return {
            ok: true,
            removedMemberId: targetMembership.id,
          } satisfies TenantMemberRemoveResponse
        } catch (error) {
          return toWorkosApiError(set, error, {
            fallbackError: "TENANT_MEMBER_REMOVE_FAILED",
            fallbackMessage: "Unable to remove this member right now.",
          })
        }
      }
    )
}

export const tenantsMembershipRoutes = createTenantsMembershipRoutes()
export type App = ReturnType<typeof createTenantsMembershipRoutes>
