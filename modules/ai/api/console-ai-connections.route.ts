import { Elysia, t } from "elysia"

import {
  createConnection,
  deleteConnection,
  executeConnectionRequest,
  getConnection,
  listConnections,
  updateConnection,
} from "../connections/connection.service"
import { requireConsoleOrgAuth } from "./console-ai-providers.route"

export function createConsoleAiConnectionsRoutes() {
  return new Elysia({ prefix: "/console/ai/connections" })
    .get("/", async ({ set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const connections = await listConnections(auth.orgId)
      return { ok: true, data: connections }
    })
    .post(
      "/",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        try {
          const connection = await createConnection({
            organizationId: auth.orgId,
            name: body.name,
            description: body.description,
            baseUrl: body.baseUrl,
            headers: body.headers,
            authType: body.authType,
          })
          set.status = 201
          return { ok: true, data: connection }
        } catch (err: unknown) {
          set.status = 400
          return {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to create connection",
          }
        }
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1 }),
          description: t.Optional(t.String()),
          baseUrl: t.String({ minLength: 1 }),
          headers: t.Optional(t.Record(t.String(), t.String())),
          authType: t.Optional(t.String()),
        }),
      }
    )
    .get("/:id", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const connection = await getConnection(params.id, auth.orgId)
      if (!connection) {
        set.status = 404
        return { ok: false, error: "Connection not found" }
      }

      return { ok: true, data: connection }
    })
    .patch(
      "/:id",
      async ({ params, body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        try {
          const updated = await updateConnection(params.id, auth.orgId, {
            name: body.name,
            description: body.description,
            baseUrl: body.baseUrl,
            headers: body.headers,
            authType: body.authType,
            isActive: body.isActive,
          })
          return { ok: true, data: updated }
        } catch (err: unknown) {
          set.status = 400
          return {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to update connection",
          }
        }
      },
      {
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          baseUrl: t.Optional(t.String()),
          headers: t.Optional(t.Record(t.String(), t.String())),
          authType: t.Optional(t.String()),
          isActive: t.Optional(t.Boolean()),
        }),
      }
    )
    .delete("/:id", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const deleted = await deleteConnection(params.id, auth.orgId)
      if (!deleted) {
        set.status = 404
        return { ok: false, error: "Connection not found" }
      }

      return { ok: true }
    })
    .post(
      "/:id/test",
      async ({ params, body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const result = await executeConnectionRequest({
          connectionId: params.id,
          organizationId: auth.orgId,
          subpath: body?.subpath ?? "",
          method: "GET",
          timeoutMs: 5000,
        })
        return { ok: result.status < 400, data: result }
      },
      {
        body: t.Optional(
          t.Object({
            subpath: t.Optional(t.String()),
          })
        ),
      }
    )
}
