import { Elysia } from "elysia"

import {
  isTenantApiError,
  toPolicyError,
} from "@/modules/tenants/api/tenants.errors"
import {
  ensureTenantContextAccess,
  requireTenantActor,
} from "@/modules/tenants/api/tenants.guards"
import { invitationPayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantInvitationCreateResponse,
  TenantInvitationsResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import {
  listTenantInvitations,
  sendTenantInvitation,
} from "@/modules/tenants/services/tenant-workos.service"
import {
  canInviteAsRole,
  canManageTenant,
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
