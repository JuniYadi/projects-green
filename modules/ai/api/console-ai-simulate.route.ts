import { Elysia, t } from "elysia"
import {
  requireConsoleOrgAuth,
} from "@/modules/ai/api/console-ai-providers.route"
import {
  simulateAgentInference,
  type AgentSimulateInput,
} from "@/modules/whatsapp/agent/agent-simulation.service"

const agentSimulateBodySchema = t.Object({
  agentProfileId: t.String(),
  message: t.String(),
  conversationHistory: t.Optional(
    t.Array(
      t.Object({
        role: t.Union([t.Literal("user"), t.Literal("assistant")]),
        content: t.String(),
      })
    )
  ),
  mediaUrl: t.Optional(t.String()),
  mediaType: t.Optional(t.String()),
})

export function createConsoleAiSimulateRoutes() {
  return new Elysia({ prefix: "/console/ai/simulate" })
    .post(
      "/",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const result = await simulateAgentInference(
          body as AgentSimulateInput,
          { orgId: auth.orgId, userId: auth.userId }
        )

        if (!result.ok) {
          set.status = result.status
          return {
            ok: false,
            error: result.error,
            message: result.message,
          }
        }

        return result
      },
      {
        body: agentSimulateBodySchema,
      }
    )
    .post(
      "",
      async ({ body, set }) => {
        const auth = await requireConsoleOrgAuth()
        if ("error" in auth) {
          set.status = auth.status
          return { ok: false, error: auth.error }
        }

        const result = await simulateAgentInference(
          body as AgentSimulateInput,
          { orgId: auth.orgId, userId: auth.userId }
        )

        if (!result.ok) {
          set.status = result.status
          return {
            ok: false,
            error: result.error,
            message: result.message,
          }
        }

        return result
      },
      {
        body: agentSimulateBodySchema,
      }
    )
}
