import { generateObject, streamText, type LanguageModel } from "ai"
import type { z } from "zod"

import {
  createAiLanguageModel,
  resolveAiProviderConfig,
  type ResolvedAiProvider,
} from "@/modules/ai/ai-provider.factory"
import { executeAgentPTool } from "./executor"
import { agentPRegistry, type AgentPToolRegistry } from "./registry"
import type {
  AgentPContext,
  AgentPGenerationOptions,
  AgentPModel,
} from "./types"

export type AgentPServiceDependencies = {
  registry?: AgentPToolRegistry
  resolveProvider?: typeof resolveAiProviderConfig
  createModel?: (provider: ResolvedAiProvider) => LanguageModel
}

const providerFromEnvironment = (
  provider: ResolvedAiProvider
): ResolvedAiProvider => {
  const selected = process.env.AI_PROVIDER?.trim().toUpperCase()
  if (selected === "OPENROUTER") {
    return { ...provider, providerType: "MANAGED" }
  }
  if (selected === "OPENAI" || selected === "OPENAI_COMPATIBLE") {
    return { ...provider, providerType: "OPENAI_COMPATIBLE" }
  }
  return provider
}

export class AgentPService {
  private readonly registry: AgentPToolRegistry
  private readonly resolveProvider: typeof resolveAiProviderConfig
  private readonly createModel: (provider: ResolvedAiProvider) => LanguageModel

  constructor(dependencies: AgentPServiceDependencies = {}) {
    this.registry = dependencies.registry || agentPRegistry
    this.resolveProvider =
      dependencies.resolveProvider || resolveAiProviderConfig
    this.createModel = dependencies.createModel || createAiLanguageModel
  }

  private async modelFor(
    options: AgentPGenerationOptions
  ): Promise<AgentPModel> {
    const provider = await this.resolveProvider({
      organizationId: options.organizationId,
      providerId: options.providerId,
      modelOverride: options.model,
    })
    return this.createModel(providerFromEnvironment(provider))
  }

  private contextFor(options: AgentPGenerationOptions): AgentPContext {
    return {
      session: {
        organizationId: options.organizationId,
        userId: options.userId,
        role: options.role,
      },
    }
  }

  async stream(options: AgentPGenerationOptions) {
    const context = this.contextFor(options)
    const model = await this.modelFor(options)
    const tools = this.registry.toAiTools(context, executeAgentPTool)
    if (options.messages && options.messages.length > 0) {
      return streamText({
        model,
        system: options.system,
        messages: options.messages,
        tools,
      })
    }
    return streamText({
      model,
      system: options.system,
      prompt: options.prompt ?? "",
      tools,
    })
  }

  async generateObject<TSchema extends z.ZodType>(
    options: AgentPGenerationOptions & { schema: TSchema }
  ) {
    const context = this.contextFor(options)
    const model = await this.modelFor(options)
    const tools = this.registry.toAiTools(context, executeAgentPTool)
    if (options.messages && options.messages.length > 0) {
      return generateObject({
        model,
        schema: options.schema,
        system: options.system,
        messages: options.messages,
        tools,
      })
    }
    return generateObject({
      model,
      schema: options.schema,
      system: options.system,
      prompt: options.prompt ?? "",
      tools,
    })
  }
}

export const agentPService = new AgentPService()
