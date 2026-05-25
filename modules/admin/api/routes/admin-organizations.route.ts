import { Elysia } from "elysia"

import { adminCreateOrganizationSchema } from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { toWorkosError } from "@/modules/admin/api/admin.errors"
import { createAdminOrganization } from "@/modules/admin/admin.service"

export const createAdminOrganizationsRoutes = (deps = {}) => {
  const { requireSuperAdmin: guard = requireSuperAdmin } = { ...deps }

  return new Elysia().post(
    "/admin/organizations",
    async ({ body, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        const org = await createAdminOrganization({
          name: body.name.trim(),
          domains: body.domains?.map((d) => d.trim()),
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
}