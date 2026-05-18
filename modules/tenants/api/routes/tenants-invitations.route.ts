import { Elysia } from "elysia"

import {
  isTenantApiError,
  type RouteSet,
  toNotFoundError,
  toPolicyError,
  toWorkosApiError,
} from "@/modules/tenants/api/tenants.errors"
import { invitationPayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantApiError,
  TenantInvitationCancelResponse,
  TenantInvitationCreateResponse,
  TenantInvitationResendResponse,
  TenantInvitationRevokeResponse,
  TenantInvitationsResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import {
  cancelTenantInvitation,
  getTenantInvitationById,
  listTenantInvitations,
  resendTenantInvitation,
  revokeTenantInvitation,
  sendTenantInvitation,
} from "@/modules/tenants/services/tenant-workos.service"
import {
  canInviteAsRole,
  canManageTenant,
  normalizeTenantRole,
} from "@/modules/tenants/tenant-policy"

type TenantsInvitationRouteDeps = {
  requireTenantActor: (
    set: RouteSet
  ) => Promise<TenantActorContext | TenantApiError>
  ensureTenantContextAccess: (
    orgId: string,
    actor: TenantActorContext,
    set: RouteSet
  ) => true | TenantApiError | Promise<true | TenantApiError>
  listTenantInvitations: typeof listTenantInvitations
  sendTenantInvitation: typeof sendTenantInvitation
  getTenantInvitationById: typeof getTenantInvitationById
  revokeTenantInvitation: typeof revokeTenantInvitation
  cancelTenantInvitation: typeof cancelTenantInvitation
  resendTenantInvitation: typeof resendTenantInvitation
  canManageTenant: typeof canManageTenant
  canInviteAsRole: typeof canInviteAsRole
  normalizeTenantRole: typeof normalizeTenantRole
}

const defaultRequireTenantActor: TenantsInvitationRouteDeps["requireTenantActor"] =
  async (set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.requireTenantActor(set)
  }

const defaultEnsureTenantContextAccess: TenantsInvitationRouteDeps["ensureTenantContextAccess"] =
  async (orgId, actor, set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.ensureTenantContextAccess(orgId, actor, set)
  }

const defaultTenantsInvitationRouteDeps: TenantsInvitationRouteDeps = {
  requireTenantActor: defaultRequireTenantActor,
  ensureTenantContextAccess: defaultEnsureTenantContextAccess,
  listTenantInvitations,
  sendTenantInvitation,
  getTenantInvitationById,
  revokeTenantInvitation,
  cancelTenantInvitation,
  resendTenantInvitation,
  canManageTenant,
  canInviteAsRole,
  normalizeTenantRole,
}

export const createTenantsInvitationRoutes = (
  deps: Partial<TenantsInvitationRouteDeps> = {}
) => {
  const {
    requireTenantActor,
    ensureTenantContextAccess,
    listTenantInvitations,
    sendTenantInvitation,
    getTenantInvitationById,
    revokeTenantInvitation,
    cancelTenantInvitation,
    resendTenantInvitation,
    canManageTenant,
    canInviteAsRole,
    normalizeTenantRole,
  } = {
    ...defaultTenantsInvitationRouteDeps,
    ...deps,
  }

  return new Elysia()
  .get("/tenants/:orgId/invitations", async ({ params, set }) => {
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
        "You do not have permission to view invitations in this tenant."
      )
    }

    try {
      const invitations = await listTenantInvitations(params.orgId)

      return {
        ok: true,
        orgId: params.orgId,
        invitations,
      } satisfies TenantInvitationsResponse
    } catch (error) {
      return toWorkosApiError(set, error, {
        fallbackError: "TENANT_INVITATIONS_LIST_FAILED",
        fallbackMessage: "Unable to load invitations right now.",
      })
    }
  })
  .post(
    "/tenants/:orgId/invitations",
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

      if (
        !canInviteAsRole(
          {
            platformRole: actorResult.platformRole,
            tenantRole: actorResult.tenantRole,
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

      try {
        const invitation = await sendTenantInvitation({
          email: body.email.trim().toLowerCase(),
          organizationId: params.orgId,
          inviterUserId: actorResult.userId,
          targetRole: body.targetRole,
        })

        set.status = 201

        return {
          ok: true,
          invitation,
        } satisfies TenantInvitationCreateResponse
      } catch (error) {
        return toWorkosApiError(set, error, {
          fallbackError: "TENANT_INVITATION_CREATE_FAILED",
          fallbackMessage: "Unable to send invitation right now.",
        })
      }
    },
    {
      body: invitationPayloadSchema,
    }
  )
  .post(
    "/tenants/:orgId/invitations/:invitationId/revoke",
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

      if (
        !canManageTenant({
          platformRole: actorResult.platformRole,
          tenantRole: actorResult.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "TENANT_MANAGE_REQUIRED",
          "You do not have permission to revoke invitations in this tenant."
        )
      }

      try {
        const invitation = await getTenantInvitationById(params.invitationId)
        if (!invitation) {
          return toNotFoundError(set, "Invitation not found.")
        }
        const invitationRole = normalizeTenantRole(invitation.roleSlug)

        if (invitation.organizationId !== params.orgId) {
          return toPolicyError(
            set,
            "INVITATION_ORG_MISMATCH",
            "Invitation does not belong to the requested tenant."
          )
        }

        if (!invitationRole) {
          return toPolicyError(
            set,
            "INVITATION_INVALID_ROLE",
            "This invitation has an unsupported or invalid role and cannot be processed."
          )
        }

        if (
          !canInviteAsRole(
            {
              platformRole: actorResult.platformRole,
              tenantRole: actorResult.tenantRole,
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

        await revokeTenantInvitation(invitation.id)

        return {
          ok: true,
          revokedInvitationId: invitation.id,
        } satisfies TenantInvitationRevokeResponse
      } catch (error) {
        return toWorkosApiError(set, error, {
          fallbackError: "TENANT_INVITATION_REVOKE_FAILED",
          fallbackMessage: "Unable to revoke this invitation right now.",
        })
      }
    }
  )
  .post(
    "/tenants/:orgId/invitations/:invitationId/cancel",
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

      if (
        !canManageTenant({
          platformRole: actorResult.platformRole,
          tenantRole: actorResult.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "TENANT_MANAGE_REQUIRED",
          "You do not have permission to cancel invitations in this tenant."
        )
      }

      try {
        const invitation = await getTenantInvitationById(params.invitationId)
        if (!invitation) {
          return toNotFoundError(set, "Invitation not found.")
        }
        const invitationRole = normalizeTenantRole(invitation.roleSlug)

        if (invitation.organizationId !== params.orgId) {
          return toPolicyError(
            set,
            "INVITATION_ORG_MISMATCH",
            "Invitation does not belong to the requested tenant."
          )
        }

        if (!invitationRole) {
          return toPolicyError(
            set,
            "INVITATION_INVALID_ROLE",
            "This invitation has an unsupported or invalid role and cannot be processed."
          )
        }

        if (
          !canInviteAsRole(
            {
              platformRole: actorResult.platformRole,
              tenantRole: actorResult.tenantRole,
            },
            invitationRole
          )
        ) {
          return toPolicyError(
            set,
            "INVITATION_CANCEL_FORBIDDEN",
            `You are not allowed to cancel ${invitationRole} invitations.`
          )
        }

        await cancelTenantInvitation(invitation.id)

        return {
          ok: true,
          canceledInvitationId: invitation.id,
        } satisfies TenantInvitationCancelResponse
      } catch (error) {
        return toWorkosApiError(set, error, {
          fallbackError: "TENANT_INVITATION_CANCEL_FAILED",
          fallbackMessage: "Unable to cancel this invitation right now.",
        })
      }
    }
  )
  .post(
    "/tenants/:orgId/invitations/:invitationId/resend",
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

      if (
        !canManageTenant({
          platformRole: actorResult.platformRole,
          tenantRole: actorResult.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "TENANT_MANAGE_REQUIRED",
          "You do not have permission to resend invitations in this tenant."
        )
      }

      try {
        const invitation = await getTenantInvitationById(params.invitationId)
        if (!invitation) {
          return toNotFoundError(set, "Invitation not found.")
        }
        const invitationRole = normalizeTenantRole(invitation.roleSlug)

        if (invitation.organizationId !== params.orgId) {
          return toPolicyError(
            set,
            "INVITATION_ORG_MISMATCH",
            "Invitation does not belong to the requested tenant."
          )
        }

        if (!invitationRole) {
          return toPolicyError(
            set,
            "INVITATION_INVALID_ROLE",
            "This invitation has an unsupported or invalid role and cannot be processed."
          )
        }

        if (
          !canInviteAsRole(
            {
              platformRole: actorResult.platformRole,
              tenantRole: actorResult.tenantRole,
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

        const resent = await resendTenantInvitation(invitation.id)

        return {
          ok: true,
          invitation: resent,
        } satisfies TenantInvitationResendResponse
      } catch (error) {
        return toWorkosApiError(set, error, {
          fallbackError: "TENANT_INVITATION_RESEND_FAILED",
          fallbackMessage: "Unable to resend this invitation right now.",
        })
      }
    }
  )
}

export const tenantsInvitationRoutes = createTenantsInvitationRoutes()
