import { Elysia } from "elysia"

import {
  adminSendInvitationSchema,
  listInvitationsQuerySchema,
} from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { toWorkosError } from "@/modules/admin/api/admin.errors"
import {
  sendAdminInvitation,
  listAdminInvitations,
  revokeAdminInvitation,
} from "@/modules/admin/admin.service"

export type AdminInvitationsRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  sendAdminInvitation?: typeof sendAdminInvitation
  listAdminInvitations?: typeof listAdminInvitations
  revokeAdminInvitation?: typeof revokeAdminInvitation
}

export const createAdminInvitationsRoutes = (
  deps: AdminInvitationsRouteDeps = {}
) => {
  const {
    requireSuperAdmin: guard = requireSuperAdmin,
    sendAdminInvitation: sendInvite = sendAdminInvitation,
    listAdminInvitations: listInvites = listAdminInvitations,
    revokeAdminInvitation: revokeInvite = revokeAdminInvitation,
  } = deps

  return new Elysia()
    .get(
      "/admin/invitations",
      async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const { limit, before, after, organizationId, status, search } = query
          const isFiltering = Boolean((status && status !== "all") || search)
          // ponytail: WorkOS User Management API does not support filtering invitations
          // by status or free-text search. Fetch up to a ceiling of 50 to maximize chances
          // of filling the requested limit after in-memory filtering.
          const fetchLimit = isFiltering ? Math.max(limit, 50) : limit

          const result = await listInvites({
            limit: fetchLimit,
            before,
            after,
            organizationId,
          })

          let invitations = result.invitations

          if (status && status !== "all") {
            const statusLower = status.toLowerCase()
            invitations = invitations.filter(
              (inv) => inv.state.toLowerCase() === statusLower
            )
          }

          if (search) {
            const searchLower = search.toLowerCase()
            invitations = invitations.filter(
              (inv) =>
                inv.email.toLowerCase().includes(searchLower) ||
                inv.organizationName?.toLowerCase().includes(searchLower) ||
                inv.roleSlug?.toLowerCase().includes(searchLower)
            )
          }

          if (isFiltering && invitations.length > limit) {
            invitations = invitations.slice(0, limit)
          }

          return {
            ok: true,
            data: {
              invitations,
              listMetadata: result.listMetadata,
            },
          }
        } catch (error) {
          return toWorkosError(set, error)
        }
      },
      { query: listInvitationsQuerySchema }
    )
    .post(
      "/admin/invitations",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const invitation = await sendInvite({
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
    .delete("/admin/invitations/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        const invitation = await revokeInvite(params.id)
        return {
          ok: true,
          invitation,
        }
      } catch (error) {
        return toWorkosError(set, error)
      }
    })
}
