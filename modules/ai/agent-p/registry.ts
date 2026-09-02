import { tool, type Tool } from "ai"

import { billingBurnRateTool } from "./tools/billing/billing-burn-rate.tool"
import { invoiceExplainTool } from "./tools/billing/invoice-explain.tool"
import { broadcastPreflightTool } from "./tools/whatsapp/broadcast-preflight.tool"
import { contactNormalizeTool } from "./tools/whatsapp/contact-normalize.tool"
import { deviceDiagnoseTool } from "./tools/whatsapp/device-diagnose.tool"
import { inboxSuggestReplyTool } from "./tools/whatsapp/inbox-suggest-reply.tool"
import { inboxSummarizeTool } from "./tools/whatsapp/inbox-summarize.tool"

import type { AgentPContext, AgentPTool } from "./types"

export type AgentPToolExecutor = <TInput, TOutput>(
  toolDefinition: AgentPTool<TInput, TOutput>,
  input: unknown,
  context: AgentPContext
) => Promise<unknown>

export class AgentPToolRegistry {
  private readonly tools = new Map<string, AgentPTool<unknown, unknown>>()

  register<TInput, TOutput>(toolDefinition: AgentPTool<TInput, TOutput>): this {
    if (this.tools.has(toolDefinition.name)) {
      throw new Error(`Agent P tool already registered: ${toolDefinition.name}`)
    }

    this.tools.set(
      toolDefinition.name,
      toolDefinition as AgentPTool<unknown, unknown>
    )
    return this
  }

  get(name: string): AgentPTool<unknown, unknown> | undefined {
    return this.tools.get(name)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  list(): AgentPTool<unknown, unknown>[] {
    return Array.from(this.tools.values())
  }

  toAiTools(
    context: AgentPContext,
    execute: AgentPToolExecutor
  ): Record<string, Tool> {
    return Object.fromEntries(
      this.list().map((toolDefinition) => {
        const sanitizedName = toolDefinition.name.replace(/\./g, "_")
        return [
          sanitizedName,
          tool({
            description: toolDefinition.description,
            inputSchema: toolDefinition.inputSchema,
            execute: (input) => execute(toolDefinition, input, context),
          }),
        ]
      })
    )
  }
}

export const agentPRegistry = new AgentPToolRegistry()

agentPRegistry
  .register(inboxSummarizeTool)
  .register(inboxSuggestReplyTool)
  .register(broadcastPreflightTool)
  .register(deviceDiagnoseTool)
  .register(contactNormalizeTool)
  .register(billingBurnRateTool)
  .register(invoiceExplainTool)
