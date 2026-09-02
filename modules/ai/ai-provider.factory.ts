import { createOpenAI } from "@ai-sdk/openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import { prisma } from "@/lib/prisma"
import { getProviderApiKey } from "./ai-vault.service"
export type ProviderType = "OPENAI_COMPATIBLE" | "ANTHROPIC" | "MANAGED"

export type ResolvedAiProvider = {
  providerType: ProviderType
  baseUrl: string | null
  defaultModel: string
  apiKey: string
}

export type ModelResolutionOptions = {
  organizationId?: string | null
  providerId?: string | null
  modelOverride?: string
}

export type ConfigFinder = (query: {
  where: Record<string, unknown>
}) => Promise<Record<string, unknown> | null>

/**
 * Resolves API credentials for an AI provider.
 * Looks up HashiCorp Vault for BYOK keys; falls back to platform OpenRouter key for MANAGED.
 */
export async function resolveAiProviderConfig(
  options: ModelResolutionOptions,
  apiKeyResolver: typeof getProviderApiKey = getProviderApiKey,
  configFinder?: ConfigFinder
): Promise<ResolvedAiProvider> {
  const findConfig =
    configFinder ||
    ((query: { where: Record<string, unknown> }) =>
      prisma.aiProviderConfig.findFirst(query as never) as Promise<Record<
        string,
        unknown
      > | null>)

  // 1. If providerId is specified, query tenant's BYOK config
  if (options.providerId && options.organizationId) {
    const config = await findConfig({
      where: {
        id: options.providerId,
        organizationId: options.organizationId,
      },
    })

    if (config) {
      const apiKey = await apiKeyResolver({
        organizationId: config.organizationId as string,
        providerId: config.id as string,
        vaultKey: (config.vaultKey as string) || "API_KEY",
      })

      if (apiKey) {
        return {
          providerType: config.providerType as ProviderType,
          baseUrl: (config.baseUrl as string) || null,
          defaultModel:
            options.modelOverride ||
            (config.defaultModel as string) ||
            "gpt-4o-mini",
          apiKey,
        }
      }
    }
  }

  // 2. If organization has a default configured BYOK provider
  if (options.organizationId) {
    const defaultConfig = await findConfig({
      where: {
        organizationId: options.organizationId,
        isDefault: true,
      },
    })

    if (defaultConfig) {
      const apiKey = await apiKeyResolver({
        organizationId: defaultConfig.organizationId as string,
        providerId: defaultConfig.id as string,
        vaultKey: (defaultConfig.vaultKey as string) || "API_KEY",
      })

      if (apiKey) {
        return {
          providerType: defaultConfig.providerType as ProviderType,
          baseUrl: (defaultConfig.baseUrl as string) || null,
          defaultModel:
            options.modelOverride ||
            (defaultConfig.defaultModel as string) ||
            "gpt-4o-mini",
          apiKey,
        }
      }
    }
  }

  // 3. Fallback to Managed PFNApp OpenRouter key
  const fallbackKey =
    process.env.AI_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    ""
  const fallbackBaseUrl =
    process.env.AI_BASE_URL?.trim() || "https://openrouter.ai/api/v1"
  const fallbackModel =
    options.modelOverride ||
    process.env.AI_CHAT_MODEL?.trim() ||
    "anthropic/claude-sonnet-4-5-20251120"

  return {
    providerType: "MANAGED",
    baseUrl: fallbackBaseUrl,
    defaultModel: fallbackModel,
    apiKey: fallbackKey,
  }
}

/**
 * Universal AI Model Factory using Vercel AI SDK.
 * Supports OpenAI-Compatible (OpenAI, DeepSeek, Groq, Ollama), Anthropic, and Managed OpenRouter.
 */
export function createAiLanguageModel(
  provider: ResolvedAiProvider
): LanguageModel {
  if (provider.providerType === "OPENAI_COMPATIBLE") {
    const openai = createOpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    })
    return openai.chat(provider.defaultModel)
  }
  // OpenRouter (Managed or Anthropic/Claude direct routing)
  const openrouter = createOpenRouter({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl || "https://openrouter.ai/api/v1",
  })
  return openrouter.chat(provider.defaultModel)
}
