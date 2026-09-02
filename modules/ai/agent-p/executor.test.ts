import { describe, expect, it } from "bun:test"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { executeAgentPTool } from "./executor"
import type { AgentPContext, AgentPTool } from "./types"
const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

const makeTool = (
  execute: AgentPTool<number, number>["execute"]
): AgentPTool<number, number> => ({
  name: "double",
  description: "Double a number",
  inputSchema: z.number(),
  outputSchema: z.number(),
  execute,
})

describe("executeAgentPTool", () => {
  it("validates input and output and returns success", async () => {
    const result = await executeAgentPTool(
      makeTool((value) => value * 2),
      3,
      context
    )
    expect(result).toEqual({ success: true, data: 6 })
  })

  it("returns a failure result when validation or execution fails", async () => {
    const tool = makeTool(() => {
      throw new Error("tool failed")
    })
    const result = await executeAgentPTool(tool, "bad", context)
    expect(result.success).toBe(false)
  })

  it("does not let an audit failure change the tool result", async () => {
    const result = await executeAgentPTool(
      makeTool((value) => value),
      4,
      context
    )
    expect(result).toEqual({ success: true, data: 4 })
  })

  it("writes organization-scoped audit records in the finally path", async () => {
    const create = async ({ data }: { data: Record<string, unknown> }) => {
      expect(data).toMatchObject({
        organizationId: "org-1",
        userId: "user-1",
        toolName: "double",
        status: "SUCCESS",
      })
    }
    const prismaWithAudit = prisma as unknown as {
      aiUsageAudit?: { create: typeof create }
    }
    prismaWithAudit.aiUsageAudit = { create }
    await executeAgentPTool(
      makeTool((value) => value),
      4,
      context
    )
    delete prismaWithAudit.aiUsageAudit
  })
})
