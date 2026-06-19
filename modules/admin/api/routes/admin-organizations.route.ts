import { Elysia } from "elysia"

import {
  adminCreateOrganizationSchema,
  listOrganizationsQuerySchema,
} from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { toWorkosError } from "@/modules/admin/api/admin.errors"
import {
  createAdminOrganization,
  listAdminOrganizations,
  listAdminOrganizationMembers,
} from "@/modules/admin/admin.service"

export const createAdminOrganizationsRoutes = (deps = {}) => {
  const { requireSuperAdmin: guard = requireSuperAdmin } = { ...deps }

  return new Elysia()
    .get(
      "/admin/organizations",
      async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const { limit, before, after, search } = query
          const result = await listAdminOrganizations({
            limit,
            before,
            after,
          })

          let organizations = result.organizations
          if (search) {
            const searchLower = search.toLowerCase()
            organizations = organizations.filter((org) =>
              org.name.toLowerCase().includes(searchLower)
            )
          }

          return {
            ok: true,
            data: {
              organizations,
              listMetadata: result.listMetadata,
            },
          }
        } catch (error) {
          return toWorkosError(set, error)
        }
      },
      { query: listOrganizationsQuerySchema }
    )
    .post(
      "/admin/organizations",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const org = await createAdminOrganization({
            name: body.name.trim(),
            domains: body.domains?.map((d: string) => d.trim()),
            externalId: body.externalId?.trim(),
          })

          set.status = 201
          return {
            ok: true,
            organization: org,
          }
        } catch (error) {
          return toWorkosError(set, error)
        }
      },
      { body: adminCreateOrganizationSchema }
    )
    .get("/admin/organizations/:id/members", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        const result = await listAdminOrganizationMembers(params.id)
        return {
          ok: true,
          data: result,
        }
      } catch (error) {
        return toWorkosError(set, error)
      }
    })
}
