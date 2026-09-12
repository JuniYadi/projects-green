import { Elysia, t } from "elysia"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  listClustersQuerySchema,
  createClusterBodySchema,
  updateClusterBodySchema,
  updateClusterStatusBodySchema,
  upsertIntegrationBodySchema,
  updateIntegrationStatusBodySchema,
  upsertClusterEndpointBodySchema,
  clusterIntegrationsImportSchema,
  INTEGRATION_TYPES,
  integrationMetaJsonSchemas,
  integrationSecretPatchSchemas,
} from "@/modules/admin/api/admin.schema"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  getClusterEndpoint,
  upsertClusterEndpoint,
  EdgeNotFoundError,
  EdgeValidationError,
} from "@/modules/deploy/app-hosting-edge.service"
import { testIntegrationConnection } from "@/modules/deploy/cluster-integration-tester.service"
import {
  CLUSTER_OPERATION_VIEWS,
  type ClusterOperationView,
} from "@/modules/deploy/cluster-operations.dto"
import {
  ClusterOperationsNotFoundError,
  getClusterOperations,
} from "@/modules/deploy/cluster-operations.service"
import {
  listClusters,
  getClusterById,
  createCluster,
  updateCluster,
  updateClusterStatus,
  upsertClusterIntegration,
  getExistingClusterIntegrationConfig,
  recordClusterIntegrationTest,
  updateClusterIntegrationStatus,
  deleteClusterIntegration,
  exportClusterIntegrations,
  importClusterIntegrations,
  ClusterIntegrationValidationError,
} from "@/modules/deploy/cluster-management.service"

type IntegrationType = (typeof INTEGRATION_TYPES)[number]

const clusterOperationsQuery = t.Optional(
  t.Object({
    source: t.Optional(
      t.Union([t.Literal("all"), t.Literal("application"), t.Literal("http")])
    ),
    q: t.Optional(t.String()),
    level: t.Optional(t.String()),
    service: t.Optional(t.String()),
    from: t.Optional(t.String()),
    to: t.Optional(t.String()),
    range: t.Optional(
      t.Union([t.Literal("1h"), t.Literal("6h"), t.Literal("24h")])
    ),
  })
)

const clusterOperationsParams = t.Object({
  id: t.String(),
  view: t.Union(CLUSTER_OPERATION_VIEWS.map((view) => t.Literal(view))),
})

function isIntegrationType(value: string): value is IntegrationType {
  return (INTEGRATION_TYPES as readonly string[]).includes(value)
}

function clusterError(
  set: { status?: number | string },
  error: unknown
): AdminApiError {
  console.error("[admin-clusters] route error:", error)
  if (error instanceof ClusterOperationsNotFoundError) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: error.message }
  }
  if (error instanceof ClusterIntegrationValidationError) {
    set.status = 422
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: fieldErrorMapFromIssues(error.issues),
    }
  }
  if (error instanceof EdgeNotFoundError) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: error.message }
  }
  if (error instanceof EdgeValidationError) {
    set.status = 422
    return { ok: false, error: "VALIDATION_ERROR", message: error.message }
  }

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

export type AdminClusterRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
}

export const createAdminAppHostingClusterRoutes = (
  deps: AdminClusterRouteDeps = {}
) => {
  const { requireSuperAdmin: guard = requireSuperAdmin } = deps
  return (
    new Elysia()
      .get(
        "/admin/app-hosting/clusters/:id/operations/:view",
        async ({ params, query, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const data = await getClusterOperations(
              params.id,
              params.view as ClusterOperationView,
              query ?? {}
            )
            return { ok: true as const, data }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { params: clusterOperationsParams, query: clusterOperationsQuery }
      )
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
      // ── GET/PUT edge endpoint ────────────────────
      .get(
        "/admin/app-hosting/clusters/:id/endpoint",
        async ({ params, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const endpoint = await getClusterEndpoint(params.id)
            return { ok: true as const, data: endpoint }
          } catch (error) {
            return clusterError(set, error)
          }
        }
      )
      .put(
        "/admin/app-hosting/clusters/:id/endpoint",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const endpoint = await upsertClusterEndpoint(params.id, body)
            return { ok: true as const, data: endpoint }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: upsertClusterEndpointBodySchema }
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

          const metaJsonSchema = integrationMetaJsonSchemas[params.type]
          const parsed = metaJsonSchema.safeParse(body.metaJson ?? {})

          if (!parsed.success) {
            set.status = 422
            return {
              ok: false,
              error: "VALIDATION_ERROR",
              message: "Please fix the highlighted fields and try again.",
              fieldErrors: fieldErrorMapFromIssues(
                parsed.error.issues.map((issue) => ({
                  ...issue,
                  path: ["metaJson", ...issue.path],
                }))
              ),
            }
          }

          const secretParsed = integrationSecretPatchSchemas[
            params.type
          ].safeParse(body.secrets ?? {})

          if (!secretParsed.success) {
            set.status = 422
            return {
              ok: false,
              error: "VALIDATION_ERROR",
              message: "Please fix the highlighted fields and try again.",
              fieldErrors: fieldErrorMapFromIssues(
                secretParsed.error.issues.map((issue) => ({
                  ...issue,
                  path: ["secrets", ...issue.path],
                }))
              ),
            }
          }

          try {
            const integration = await upsertClusterIntegration(
              params.id,
              params.type,
              {
                metaJson: parsed.data as Record<string, unknown>,
                secrets: secretParsed.data as Record<string, unknown>,
              }
            )
            return { ok: true as const, data: integration }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: upsertIntegrationBodySchema }
      )
      // ── POST integration test connection ────────
      .post(
        "/admin/app-hosting/clusters/:id/integrations/:type/test",
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

          const inputMeta = (body?.metaJson ?? {}) as Record<string, unknown>
          const inputSecrets = (body?.secrets ?? {}) as Record<string, unknown>

          try {
            // Reading the stored config can throw on a key-version mismatch,
            // which outside this block escapes as a raw Elysia 500.
            const existing = await getExistingClusterIntegrationConfig(
              params.id,
              params.type
            )

            const meta = {
              ...(existing?.meta ?? {}),
              ...inputMeta,
            }
            const secrets = {
              ...(existing?.secrets ?? {}),
            }
            for (const [k, v] of Object.entries(inputSecrets)) {
              if (v !== undefined && v !== "") {
                secrets[k] = v
              }
            }

            const result = await testIntegrationConnection(
              params.type,
              meta,
              secrets
            )
            await recordClusterIntegrationTest(params.id, params.type, result)
            return { ok: true as const, data: result }
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
      // ── DELETE integration ───────────────────────
      .delete(
        "/admin/app-hosting/clusters/:id/integrations/:type",
        async ({ params, set }) => {
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
            const result = await deleteClusterIntegration(
              params.id,
              params.type
            )
            return { ok: true as const, data: result }
          } catch (error) {
            return clusterError(set, error)
          }
        }
      )
      // ── GET export cluster integrations (JSON) ──
      .get(
        "/admin/app-hosting/clusters/:id/integrations/export",
        async ({ params, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          try {
            const exportData = await exportClusterIntegrations(params.id)
            return { ok: true as const, data: exportData }
          } catch (error) {
            return clusterError(set, error)
          }
        }
      )
      // ── POST import cluster integrations (JSON) ──
      .post(
        "/admin/app-hosting/clusters/:id/integrations/import",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const parsed = clusterIntegrationsImportSchema.safeParse(body)
          if (!parsed.success) {
            set.status = 422
            return {
              ok: false,
              error: "VALIDATION_ERROR",
              message:
                "Invalid import format. Please fix the errors and try again.",
              fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
            }
          }

          try {
            const result = await importClusterIntegrations(
              params.id,
              parsed.data
            )
            return { ok: true as const, data: result }
          } catch (error) {
            return clusterError(set, error)
          }
        },
        { body: clusterIntegrationsImportSchema }
      )
  )
}
