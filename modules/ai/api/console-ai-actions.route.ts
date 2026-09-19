import { Elysia, t } from "elysia"

import {
  createActionIntent,
  deleteActionIntent,
  getActionIntent,
  listActionIntents,
  updateActionIntent,
} from "../actions/ai-action-intent.service"
import { requireConsoleOrgAuth } from "./console-ai-providers.route"

const slotSchema = t.Object({
  name: t.String({ minLength: 1 }),
  type: t.Union([
    t.Literal("STRING"),
    t.Literal("NUMBER"),
    t.Literal("DATE"),
  ]),
  required: t.Boolean(),
  inquiryQuestion: t.String(),
  description: t.Optional(t.String()),
})

export function createConsoleAiActionsRoutes() {
  return new Elysia({ prefix: "/console/ai/actions" })
    .get(
      "/",
      async ({ query, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const actions = await listActionIntents({
          organizationId: auth.orgId,
          agentProfileId: query?.agentProfileId,
        })

        return { ok: true, data: actions }
      },
      {
        query: t.Optional(
          t.Object({
            agentProfileId: t.Optional(t.String()),
          })
        ),
      }
    )
    .post(
      "/",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        try {
          const action = await createActionIntent({
            organizationId: auth.orgId,
            agentProfileId: body.agentProfileId,
            name: body.name,
            description: body.description,
            connectionId: body.connectionId,
            subpath: body.subpath,
            method: body.method,
            slots: body.slots,
            requireCustomerConfirmation: body.requireCustomerConfirmation,
            enableMultimodalVision: body.enableMultimodalVision,
            isActive: body.isActive,
          })
          set.status = 201
          return { ok: true, data: action }
        } catch (err: unknown) {
          set.status = 400
          return {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to create action intent",
          }
        }
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1 }),
          agentProfileId: t.Optional(t.Nullable(t.String())),
          description: t.Optional(t.Nullable(t.String())),
          connectionId: t.Optional(t.Nullable(t.String())),
          subpath: t.Optional(t.String()),
          method: t.Optional(t.String()),
          slots: t.Optional(t.Array(slotSchema)),
          requireCustomerConfirmation: t.Optional(t.Boolean()),
          enableMultimodalVision: t.Optional(t.Boolean()),
          isActive: t.Optional(t.Boolean()),
        }),
      }
    )
    .get("/:id", async ({ params, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const action = await getActionIntent(params.id, auth.orgId)
      if (!action) {
        set.status = 404
        return { ok: false, error: "Action intent not found" }
      }

      return { ok: true, data: action }
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
          const updated = await updateActionIntent(params.id, auth.orgId, {
            name: body.name,
            agentProfileId: body.agentProfileId,
            description: body.description,
            connectionId: body.connectionId,
            subpath: body.subpath,
            method: body.method,
            slots: body.slots,
            requireCustomerConfirmation: body.requireCustomerConfirmation,
            enableMultimodalVision: body.enableMultimodalVision,
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
                : "Failed to update action intent",
          }
        }
      },
      {
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1 })),
          agentProfileId: t.Optional(t.Nullable(t.String())),
          description: t.Optional(t.Nullable(t.String())),
          connectionId: t.Optional(t.Nullable(t.String())),
          subpath: t.Optional(t.String()),
          method: t.Optional(t.String()),
          slots: t.Optional(t.Array(slotSchema)),
          requireCustomerConfirmation: t.Optional(t.Boolean()),
          enableMultimodalVision: t.Optional(t.Boolean()),
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

      const deleted = await deleteActionIntent(params.id, auth.orgId)
      if (!deleted) {
        set.status = 404
        return { ok: false, error: "Action intent not found" }
      }

      return { ok: true }
    })
}
