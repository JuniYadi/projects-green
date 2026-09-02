import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { executeAgentPTool } from "@/modules/ai/agent-p/executor"
import { agentPRegistry } from "@/modules/ai/agent-p/registry"

async function requireAgentPAuth() {
  const auth = await withAuth()
  if (!auth.user) return { error: "UNAUTHORIZED", status: 401 as const }
  if (!auth.organizationId) return { error: "FORBIDDEN", status: 403 as const }
  return { orgId: auth.organizationId, userId: auth.user.id }
}
export function createConsoleAiAgentPRoutes() {
  return new Elysia({ prefix: "/console/ai/agent-p" }).post(
    "/execute",
    async ({ body, set }) => {
      const auth = await requireAgentPAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { success: false, error: auth.error }
      }
      const tool = agentPRegistry.get(body.toolName)
      if (!tool) {
        set.status = 404
        return { success: false, error: "TOOL_NOT_FOUND" }
      }
      const result = await executeAgentPTool(tool, body.input, {
        session: {
          organizationId: auth.orgId,
          userId: auth.userId,
          role: "console",
        },
      })
      if (!result.success) set.status = 400
      return result
    },
    {
      body: t.Object({
        toolName: t.String({ minLength: 1 }),
        input: t.Unknown(),
      }),
    }
  )
}
