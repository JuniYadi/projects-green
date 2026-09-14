import { Elysia } from "elysia"

import { listUsersQuerySchema } from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { toWorkosError } from "@/modules/admin/api/admin.errors"
import { listAdminUsers, getAdminUser } from "@/modules/admin/admin.service"

export type AdminUsersRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  listAdminUsers?: typeof listAdminUsers
  getAdminUser?: typeof getAdminUser
}

export const createAdminUsersRoutes = (deps: AdminUsersRouteDeps = {}) => {
  const {
    requireSuperAdmin: guard = requireSuperAdmin,
    listAdminUsers: listUsers = listAdminUsers,
    getAdminUser: getUser = getAdminUser,
  } = deps

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
          const isFiltering = Boolean(search)
          // ponytail: WorkOS User Management API does not support partial text / name search.
          // Fetch up to a ceiling of 50 to maximize chances of filling the requested limit after in-memory filtering.
          const fetchLimit = isFiltering ? Math.max(limit, 50) : limit

          const result = await listUsers({
            limit: fetchLimit,
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

          if (isFiltering && users.length > limit) {
            users = users.slice(0, limit)
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
        const user = await getUser(params.id)
        return {
          ok: true,
          data: user,
        }
      } catch (error) {
        return toWorkosError(set, error)
      }
    })
}
