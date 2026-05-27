import { Elysia, t } from "elysia"

import {
  whatsappAuthPlugin,
  guardTenantAdmin,
  guardTenantMember,
  type WhatsAppAuthContext,
} from "@/lib/whatsapp/auth"
import {
  listWhatsAppUsers,
  getWhatsAppUser,
  inviteWhatsAppUser,
  updateWhatsAppUserRole,
  removeWhatsAppUser,
  type WhatsAppUser,
} from "../users.service"

const inviteBodySchema = t.Object({
  email: t.String({ format: "email" }),
  role: t.Enum({ admin: "admin", member: "member" }),
})

const updateRoleSchema = t.Object({
  role: t.Enum({ admin: "admin", member: "member", owner: "owner" }),
})

// Response type for list API
type ListUsersResponse = {
  ok: true
  users: WhatsAppUser[]
}

// Response type for single user
type GetUserResponse = {
  ok: true
  user: WhatsAppUser
}

// Response type for invite
type InviteUserResponse = {
  ok: true
  invitation: {
    id: string
    email: string
    roleSlug: string
  }
}

// Response type for update
type UpdateUserResponse = {
  ok: true
  user: WhatsAppUser
}

export const usersRoutes = new Elysia({ prefix: "/users" })
  .use(whatsappAuthPlugin)

  /**
   * GET /api/whatsapp/users
   * List all WhatsApp users (organization members).
   */
  .get(
    "/",
    guardTenantMember(async ({ whatsappAuth, set }: { whatsappAuth: any, set: any }) => {
      if (!whatsappAuth.organizationId) {
        set.status = 400
        return {
          ok: false as const,
          error: "BAD_REQUEST" as const,
          message: "Organization ID required.",
        }
      }

      const users = await listWhatsAppUsers(whatsappAuth.organizationId)
      return { ok: true as const, users } satisfies ListUsersResponse
    })
  )

  /**
   * POST /api/whatsapp/users
   * Invite a user to the WhatsApp organization.
   */
  .post(
    "/",
    guardTenantAdmin(async ({
      body,
      whatsappAuth,
      set,
    }: {
      body: any
      whatsappAuth: any
      set: any
    }) => {
      if (!whatsappAuth.organizationId) {
        set.status = 400
        return {
          ok: false as const,
          error: "BAD_REQUEST" as const,
          message: "Organization ID required.",
        }
      }

      const invitation = await inviteWhatsAppUser({
        organizationId: whatsappAuth.organizationId,
        email: body.email,
        role: body.role,
        inviterUserId: whatsappAuth.userId,
      })

      return {
        ok: true as const,
        invitation,
      } satisfies InviteUserResponse
    }),
    { body: inviteBodySchema }
  )

  /**
   * GET /api/whatsapp/users/:id
   * Get a single WhatsApp user by membership ID.
   */
  .get(
    "/:id",
    guardTenantMember(async ({
      params: { id },
      whatsappAuth,
      set,
    }: {
      params: { id: string }
      whatsappAuth: any
      set: any
    }) => {
      const user = await getWhatsAppUser(id)

      if (!user) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "User not found.",
        }
      }

      // Ensure user belongs to the caller's organization
      if (
        whatsappAuth.organizationId &&
        user.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          message: "Access denied.",
        }
      }

      return { ok: true as const, user } satisfies GetUserResponse
    })
  )

  /**
   * PATCH /api/whatsapp/users/:id
   * Update the role of a WhatsApp user.
   */
  .patch(
    "/:id",
    guardTenantAdmin(async ({
      params: { id },
      body,
      whatsappAuth,
      set,
    }: {
      params: { id: string }
      body: any
      whatsappAuth: any
      set: any
    }) => {
      // Verify user belongs to caller's organization
      const user = await getWhatsAppUser(id)

      if (!user) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "User not found.",
        }
      }

      if (
        whatsappAuth.organizationId &&
        user.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          message: "Access denied.",
        }
      }

      const updated = await updateWhatsAppUserRole(id, body.role)

      return { ok: true as const, user: updated } satisfies UpdateUserResponse
    }),
    { body: updateRoleSchema }
  )

  /**
   * DELETE /api/whatsapp/users/:id
   * Remove a user from the WhatsApp organization.
   */
  .delete(
    "/:id",
    guardTenantAdmin(async ({
      params: { id },
      whatsappAuth,
      set,
    }: {
      params: { id: string }
      whatsappAuth: any
      set: any
    }) => {
      // Verify user membership exists
      const user = await getWhatsAppUser(id)

      if (!user) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "User not found.",
        }
      }

      if (
        whatsappAuth.organizationId &&
        user.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          message: "Access denied.",
        }
      }

      await removeWhatsAppUser(id)

      return { ok: true as const, message: "User removed." }
    })
  )
