import { Elysia, t } from "elysia"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { listAdminDeployments } from "@/modules/deploy/admin-deployments.service"

export type AdminDeploymentsRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  listAdminDeployments?: typeof listAdminDeployments
}

export const createAdminDeploymentsRoutes = (
  deps: AdminDeploymentsRouteDeps = {}
) => {
  const {
    requireSuperAdmin: guard = requireSuperAdmin,
    listAdminDeployments: listDeployments = listAdminDeployments,
  } = deps

  return new Elysia().get(
    "/admin/deployments",
    async ({ query, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        const result = await listDeployments({
          page: query.page,
          limit: query.limit,
          organizationId: query.organizationId,
          query: query.query,
          status: query.status,
        })

        return {
          ok: true as const,
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        }
      } catch (error) {
        console.error("[admin-deployments] route error:", error)
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_ERROR",
          message: "Failed to list admin deployments",
        }
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        organizationId: t.Optional(t.String()),
        query: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    }
  )
}
