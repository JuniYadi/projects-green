import type { LanguageModel, Tool } from "ai"
import { z } from "zod"

export type AgentPRole = string

export type AgentPContext = {
  session: {
    organizationId: string
    userId: string
    role: AgentPRole
  }
  metadata?: Record<string, unknown>
}

export type AgentPTool<TInput, TOutput> = {
  name: string
  description: string
  inputSchema: z.ZodType<TInput>
  outputSchema: z.ZodType<TOutput>
  execute: (input: TInput, context: AgentPContext) => Promise<TOutput> | TOutput
}

export type AgentPToolSuccess<TOutput> = {
  success: true
  data: TOutput
}

export type AgentPToolFailure = {
  success: false
  error: string
  code?: string
}

export type AgentPToolResult<TOutput> =
  AgentPToolSuccess<TOutput> | AgentPToolFailure

export type AgentPToolDefinition = Tool

export type AgentPGenerationOptions = {
  organizationId: string
  userId: string
  role: AgentPRole
  providerId?: string
  model?: string
  system?: string
  prompt?: string
  messages?: Array<{
    role: "system" | "user" | "assistant"
    content: string
  }>
}

export type AgentPModel = LanguageModel
