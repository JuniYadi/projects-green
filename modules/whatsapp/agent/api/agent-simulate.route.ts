import { Elysia } from "elysia"
import {
  requireConsoleOrgAuth,
} from "@/modules/ai/api/console-ai-providers.route"
import {
  simulateAgentInference,
  agentSimulateBodySchema,
  type AgentSimulateInput,
} from "../agent-simulation.service"

export const agentSimulateRoutes = new Elysia({ prefix: "/agent" }).post(
  "/simulate",
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
