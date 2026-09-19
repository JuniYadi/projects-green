import { Elysia } from "elysia"
import {
  requireConsoleOrgAuth,
} from "@/modules/ai/api/console-ai-providers.route"
import {
  simulateAgentInference,
  agentSimulateBodySchema,
  type AgentSimulateInput,
} from "@/modules/whatsapp/agent/agent-simulation.service"

const handleSimulate = async ({
  body,
  set,
}: {
  body: AgentSimulateInput
  set: { status?: number | string }
}) => {
  const auth = await requireConsoleOrgAuth()
  if ("error" in auth) {
    set.status = auth.status
    return { ok: false, error: auth.error }
  }

  const result = await simulateAgentInference(body, {
    orgId: auth.orgId,
    userId: auth.userId,
  })

  if (!result.ok) {
    set.status = result.status
    return {
      ok: false,
      error: result.error,
      message: result.message,
    }
  }

  return result
}

export function createConsoleAiSimulateRoutes() {
  return new Elysia({ prefix: "/console/ai/simulate" }).post(
    "/",
    handleSimulate,
    {
      body: agentSimulateBodySchema,
    }
  )
}
