import { prisma } from "@/lib/prisma"

import type { AgentPContext, AgentPTool, AgentPToolResult } from "./types"

export type AgentPAuditRecord = {
  organizationId: string
  userId: string
  toolName: string
  status: "SUCCESS" | "ERROR"
  input?: unknown
  error?: string
}

type AuditClient = {
  create: (args: { data: AgentPAuditRecord }) => Promise<unknown>
}

const getAuditClient = (): AuditClient | undefined => {
  const client = prisma as unknown as { aiUsageAudit?: AuditClient }
  return client.aiUsageAudit
}

export async function executeAgentPTool<TInput, TOutput>(
  toolDefinition: AgentPTool<TInput, TOutput>,
  input: unknown,
  context: AgentPContext
): Promise<AgentPToolResult<TOutput>> {
  let status: AgentPAuditRecord["status"] = "SUCCESS"
  let result: AgentPToolResult<TOutput> = {
    success: false,
    error: "Tool execution did not produce a result",
  }

  try {
    const parsedInput = toolDefinition.inputSchema.parse(input)
    const output = await toolDefinition.execute(parsedInput, context)
    const parsedOutput = toolDefinition.outputSchema.parse(output)
    result = { success: true, data: parsedOutput }
  } catch (error) {
    status = "ERROR"
    result = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    const auditClient = getAuditClient()
    if (auditClient) {
      try {
        await auditClient.create({
          data: {
            organizationId: context.session.organizationId,
            userId: context.session.userId,
            toolName: toolDefinition.name,
            status,
            input,
            ...(status === "ERROR" && !result.success
              ? { error: result.error }
              : {}),
          },
        })
      } catch {
        // Audit persistence must not change the tool's observable result.
      }
    }
  }

  return result
}

export const createAgentPExecutor = () => executeAgentPTool
