import { Elysia, t } from "elysia"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  importManagedStock,
  listManagedStocks,
  updateManagedStockStatus,
} from "@/modules/deploy/app-managed-stock.service"
import { toManagedStockDTO } from "@/modules/deploy/app-managed-stock.dto"

const serviceTypes = t.Union([
  t.Literal("MYSQL"),
  t.Literal("POSTGRESQL"),
  t.Literal("REDIS"),
])

const importManagedStockBody = t.Object({
  clusterId: t.String(),
  serviceType: serviceTypes,
  label: t.Optional(t.String()),
  endpointHost: t.String(),
  endpointPort: t.Number(),
  databaseName: t.String(),
  username: t.String(),
  password: t.String(),
  connectionUrl: t.Optional(t.String()),
  tlsEnabled: t.Optional(t.Boolean()),
})

const managedStockQuery = t.Object({
  clusterId: t.Optional(t.String()),
  serviceType: t.Optional(t.String()),
  status: t.Optional(t.String()),
})

function routeError(set: { status?: number | string }, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const notFound =
    message.includes("NOT_FOUND") || /cluster .*not found/i.test(message)
  set.status = notFound ? 404 : 400
  return { ok: false as const, error: message }
}

export const createManagedStockRoutes = () =>
  new Elysia({ prefix: "/admin/managed-stocks" })
    .post(
      "/import",
      async ({ body, set }) => {
        const actor = await requireSuperAdmin(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const row = await importManagedStock(body)
          return { ok: true as const, ...toManagedStockDTO(row) }
        } catch (error) {
          return routeError(set, error)
        }
      },
      { body: importManagedStockBody }
    )
    .get(
      "/",
      async ({ query, set }) => {
        const actor = await requireSuperAdmin(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const rows = await listManagedStocks(query.clusterId)
          return {
            ok: true as const,
            data: rows.map(toManagedStockDTO),
          }
        } catch (error) {
          return routeError(set, error)
        }
      },
      { query: managedStockQuery }
    )
    .delete("/:id", async ({ params, set }) => {
      const actor = await requireSuperAdmin(set)
      if ("ok" in actor && !actor.ok) {
        return actor as AdminApiError
      }

      try {
        await updateManagedStockStatus(params.id, "MAINTENANCE")
        return { ok: true as const }
      } catch (error) {
        return routeError(set, error)
      }
    })
