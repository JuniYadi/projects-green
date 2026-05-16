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
import { invitationPayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantInvitationCreateResponse,
  TenantInvitationResendResponse,
  TenantInvitationRevokeResponse,
  TenantInvitationsResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import {
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

export const tenantsInvitationRoutes = new Elysia()
  .get("/tenants/:orgId/invitations", async ({ params, set }) => {
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
        "You do not have permission to view invitations in this tenant."
      )
    }

    const invitations = await listTenantInvitations(params.orgId)

    return {
      ok: true,
      orgId: params.orgId,
      invitations,
    } satisfies TenantInvitationsResponse
  })
  .post(
    "/tenants/:orgId/invitations",
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
          "You do not have permission to revoke invitations in this tenant."
        )
      }

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
    }
  )
  .post(
    "/tenants/:orgId/invitations/:invitationId/resend",
    async ({ params, set }) => {
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
          "You do not have permission to resend invitations in this tenant."
        )
      }

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
    }
  )
