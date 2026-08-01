import { Elysia } from "elysia"

import {
  listClustersQuerySchema,
  createClusterBodySchema,
  updateClusterBodySchema,
  updateClusterStatusBodySchema,
  upsertIntegrationBodySchema,
  updateIntegrationStatusBodySchema,
} from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  listClusters,
  getClusterById,
  createCluster,
  updateCluster,
  updateClusterStatus,
  upsertClusterIntegration,
  updateClusterIntegrationStatus,
} from "@/modules/deploy/cluster-management.service"

const INTEGRATION_TYPES = [
  "JENKINS",
  "GITOPS",
  "REGISTRY",
  "ARGOCD",
  "KUBECONFIG",
] as const

type IntegrationType = (typeof INTEGRATION_TYPES)[number]

function isIntegrationType(value: string): value is IntegrationType {
  return (INTEGRATION_TYPES as readonly string[]).includes(value)
}

function clusterError(
  set: { status?: number | string },
  error: unknown
): AdminApiError {
  const msg = error instanceof Error ? error.message : String(error)

  if (msg.startsWith("NOT_FOUND")) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: msg }
  }
  if (msg.startsWith("CONFLICT")) {
    set.status = 409
    return { ok: false, error: "CONFLICT", message: msg }
  }
  if (msg.startsWith("INVALID_DEFAULT_TRANSITION")) {
    set.status = 409
    return { ok: false, error: "INVALID_DEFAULT_TRANSITION", message: msg }
  }

  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
  }
}

export const createAdminAppHostingClusterRoutes = (deps = {}) => {
  const { requireSuperAdmin: guard = requireSuperAdmin } = { ...deps }

  return (
    new Elysia()
      // ── GET list ─────────────────────────────────
      .get(
        "/admin/app-hosting/clusters",
        async ({ query, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const { clusters, total } = await listClusters({
              page: query.page,
              limit: query.limit,
            })

            return {
              ok: true as const,
              data: clusters,
              pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
              },
            }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { query: listClustersQuerySchema }
      )

      // ── GET by id ────────────────────────────────
      .get("/admin/app-hosting/clusters/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const cluster = await getClusterById(params.id)
          if (!cluster) {
            set.status = 404
            return {
              ok: false,
              error: "NOT_FOUND",
              message: `Cluster ${params.id} not found`,
            }
          }
          return { ok: true as const, data: cluster }
        } catch (error) {
          return clusterError(set, error)
        }
      })

      // ── POST create ──────────────────────────────
      .post(
        "/admin/app-hosting/clusters",
        async ({ body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const cluster = await createCluster(body)
            set.status = 201
            return { ok: true as const, data: cluster }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: createClusterBodySchema }
      )

      // ── PATCH metadata ───────────────────────────
      .patch(
        "/admin/app-hosting/clusters/:id",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const cluster = await updateCluster(params.id, body)
            return { ok: true as const, data: cluster }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: updateClusterBodySchema }
      )

      // ── PATCH status ─────────────────────────────
      .patch(
        "/admin/app-hosting/clusters/:id/status",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const cluster = await updateClusterStatus(params.id, body.status, {
              isDefault: body.isDefault,
            })
            return { ok: true as const, data: cluster }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: updateClusterStatusBodySchema }
      )

      // ── PUT integration upsert ───────────────────
      .put(
        "/admin/app-hosting/clusters/:id/integrations/:type",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          if (!isIntegrationType(params.type)) {
            set.status = 422
            return {
              ok: false,
              error: "UNPROCESSABLE",
              message: `Invalid integration type: ${params.type}`,
            }
          }

          try {
            const integration = await upsertClusterIntegration(
              params.id,
              params.type,
              {
                metaJson: body.metaJson as Record<string, unknown> | undefined,
                secrets: body.secrets as Record<string, unknown> | undefined,
              }
            )
            return { ok: true as const, data: integration }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: upsertIntegrationBodySchema }
      )

      // ── PATCH integration status ─────────────────
      .patch(
        "/admin/app-hosting/clusters/:id/integrations/:type/status",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          if (!isIntegrationType(params.type)) {
            set.status = 422
            return {
              ok: false,
              error: "UNPROCESSABLE",
              message: `Invalid integration type: ${params.type}`,
            }
          }

          try {
            const integration = await updateClusterIntegrationStatus(
              params.id,
              params.type,
              body.isActive
            )
            return { ok: true as const, data: integration }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: updateIntegrationStatusBodySchema }
      )
  )
}
