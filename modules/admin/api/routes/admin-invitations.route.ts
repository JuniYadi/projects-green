import { Elysia } from "elysia"

import { adminSendInvitationSchema } from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { toWorkosError } from "@/modules/admin/api/admin.errors"
import { sendAdminInvitation } from "@/modules/admin/admin.service"

export const createAdminInvitationsRoutes = (deps = {}) => {
  const { requireSuperAdmin: guard = requireSuperAdmin } = { ...deps }

  return new Elysia().post(
    "/admin/invitations",
    async ({ body, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        const invitation = await sendAdminInvitation({
          email: body.email.trim().toLowerCase(),
          organizationId: body.organizationId.trim(),
          inviterUserId: (actor as AdminActorContext).userId,
          roleSlug: body.roleSlug.trim(),
          expiresInDays: body.expiresInDays,
        })

        set.status = 201
        return {
          ok: true,
          invitation,
        }
      } catch (error) {
        return toWorkosError(set, error)
      }
    },
    { body: adminSendInvitationSchema }
  )
}