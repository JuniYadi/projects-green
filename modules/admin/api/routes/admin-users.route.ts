import { Elysia } from "elysia"

import { listUsersQuerySchema } from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { toWorkosError } from "@/modules/admin/api/admin.errors"
import { listAdminUsers, getAdminUser } from "@/modules/admin/admin.service"

export const createAdminUsersRoutes = (deps = {}) => {
  const { requireSuperAdmin: guard = requireSuperAdmin } = { ...deps }

  return new Elysia()
    .get(
      "/admin/users",
      async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const { limit, before, after, email, organizationId, search } = query
          const result = await listAdminUsers({
            limit,
            before,
            after,
            email,
            organizationId,
          })

          let users = result.users
          if (search) {
            const searchLower = search.toLowerCase()
            users = users.filter((u) => {
              const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`
                .trim()
                .toLowerCase()
              return (
                fullName.includes(searchLower) ||
                u.email.toLowerCase().includes(searchLower)
              )
            })
          }

          return {
            ok: true,
            data: {
              users,
              listMetadata: result.listMetadata,
            },
          }
        } catch (error) {
          return toWorkosError(set, error)
        }
      },
      { query: listUsersQuerySchema }
    )
    .get("/admin/users/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        const user = await getAdminUser(params.id)
        return {
          ok: true,
          data: user,
        }
      } catch (error) {
        return toWorkosError(set, error)
      }
    })
}
