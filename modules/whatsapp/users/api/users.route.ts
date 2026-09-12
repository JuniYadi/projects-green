import { Elysia, t } from "elysia"

import {
  resolveAuthContext,
  type ResolvedAuth,
} from "@/lib/auth/resolve-proxy-auth"
import {
  listWhatsAppUsers,
  getWhatsAppUser,
  inviteWhatsAppUser,
  updateWhatsAppUserRole,
  removeWhatsAppUser,
  type WhatsAppUser,
} from "../users.service"

const inviteBodySchema = t.Object({
  email: t.String({ format: "email" } as any),
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

const forbidden = (set: { status?: number | string }, message: string) => {
  set.status = 403
  return { ok: false as const, error: "FORBIDDEN" as const, message }
}

// Seats are managed from a WorkOS session only; org API keys never touch them.
const canManageMembers = (auth: ResolvedAuth) =>
  auth.type === "workos" &&
  (auth.platformRole === "super_admin" ||
    auth.orgRole === "admin" ||
    auth.orgRole === "owner")

const isOwner = (auth: ResolvedAuth) =>
  auth.type === "workos" &&
  (auth.platformRole === "super_admin" || auth.orgRole === "owner")

export const usersRoutes = new Elysia({ prefix: "/users" })

  /**
   * GET /api/whatsapp/users
   * List all WhatsApp users (organization members).
   */
  .get("/", async ({ request, set }: any) => {
    const auth = await resolveAuthContext(request)
    if (!auth) {
      set.status = 401
      return {
        ok: false as const,
        error: "UNAUTHORIZED" as const,
        message: "Auth required.",
      }
    }
    if (!auth.organizationId) {
      set.status = 400
      return {
        ok: false as const,
        error: "BAD_REQUEST" as const,
        message: "Organization ID required.",
      }
    }

    const users = await listWhatsAppUsers(auth.organizationId)
    return { ok: true as const, users } satisfies ListUsersResponse
  })

  /**
   * POST /api/whatsapp/users
   * Invite a user to the WhatsApp organization.
   */
  .post(
    "/",
    async ({ request, body, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return {
          ok: false as const,
          error: "UNAUTHORIZED" as const,
          message: "Auth required.",
        }
      }
      if (!canManageMembers(auth)) {
        return forbidden(set, "Admin or owner role required.")
      }
      if (!auth.organizationId) {
        set.status = 400
        return {
          ok: false as const,
          error: "BAD_REQUEST" as const,
          message: "Organization ID required.",
        }
      }

      const invitation = await inviteWhatsAppUser({
        organizationId: auth.organizationId,
        email: (body as any).email,
        role: (body as any).role,
        inviterUserId: auth.type === "workos" ? auth.userId : "system",
      })

      return {
        ok: true as const,
        invitation,
      } satisfies InviteUserResponse
    },
    { body: inviteBodySchema }
  )

  /**
   * GET /api/whatsapp/users/:id
   * Get a single WhatsApp user by membership ID.
   */
  .get("/:id", async ({ request, params: { id }, set }: any) => {
    const auth = await resolveAuthContext(request)
    if (!auth) {
      set.status = 401
      return {
        ok: false as const,
        error: "UNAUTHORIZED" as const,
        message: "Auth required.",
      }
    }
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
      (auth as any).platformRole !== "super_admin" &&
      user.organizationId !== auth.organizationId
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

  /**
   * PATCH /api/whatsapp/users/:id
   * Update the role of a WhatsApp user.
   */
  .patch(
    "/:id",
    async ({ request, params: { id }, body, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return {
          ok: false as const,
          error: "UNAUTHORIZED" as const,
          message: "Auth required.",
        }
      }
      if (!canManageMembers(auth)) {
        return forbidden(set, "Admin or owner role required.")
      }
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
        (auth as any).platformRole !== "super_admin" &&
        user.organizationId !== auth.organizationId
      ) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN" as const,
          message: "Access denied.",
        }
      }

      const role = (body as any).role
      if ((role === "owner" || user.role === "owner") && !isOwner(auth)) {
        return forbidden(
          set,
          "Only an owner can grant or change the owner role."
        )
      }

      const updated = await updateWhatsAppUserRole(id, role)

      return { ok: true as const, user: updated } satisfies UpdateUserResponse
    },
    { body: updateRoleSchema }
  )

  /**
   * DELETE /api/whatsapp/users/:id
   * Remove a user from the WhatsApp organization.
   */
  .delete("/:id", async ({ request, params: { id }, set }: any) => {
    const auth = await resolveAuthContext(request)
    if (!auth) {
      set.status = 401
      return {
        ok: false as const,
        error: "UNAUTHORIZED" as const,
        message: "Auth required.",
      }
    }
    if (!canManageMembers(auth)) {
      return forbidden(set, "Admin or owner role required.")
    }
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
      (auth as any).platformRole !== "super_admin" &&
      user.organizationId !== auth.organizationId
    ) {
      set.status = 403
      return {
        ok: false as const,
        error: "FORBIDDEN" as const,
        message: "Access denied.",
      }
    }

    if (user.role === "owner" && !isOwner(auth)) {
      return forbidden(set, "Only an owner can remove an owner.")
    }

    await removeWhatsAppUser(id)

    return { ok: true as const, message: "User removed." }
  })
