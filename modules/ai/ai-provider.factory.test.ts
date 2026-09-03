import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("@ai-sdk/openai", () => ({
  createOpenAI: mock(() => ({
    chat: (model: string) => ({ modelId: model }),
  })),
}))

import {
  resolveAiProviderConfig,
  createAiLanguageModel,
  type ResolvedAiProvider,
  type ConfigFinder,
} from "./ai-provider.factory"
describe("aiProviderFactory", () => {
  const mockGetApiKey = mock(async () => "sk-vault-test-key")

  beforeEach(() => {
    mockGetApiKey.mockClear()
    mockGetApiKey.mockResolvedValue("sk-vault-test-key")
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    delete process.env.AI_API_KEY
    delete process.env.AI_PROVIDER
    process.env.AI_BASE_URL = "https://openrouter.ai/api/v1"
    process.env.AI_CHAT_MODEL = "anthropic/claude-sonnet-4-5-20251120"
  })
  it("resolves specific BYOK provider config and fetches key from Vault", async () => {
    const mockFinder: ConfigFinder = mock(async () => ({
      id: "prov_openai_1",
      organizationId: "org_1",
      name: "OpenAI Corporate",
      providerType: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini",
      vaultKey: "API_KEY",
      vaultPath: "tenants/org_1/ai/providers/prov_openai_1",
      isConfigured: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const provider = await resolveAiProviderConfig(
      {
        organizationId: "org_1",
        providerId: "prov_openai_1",
      },
      mockGetApiKey,
      mockFinder
    )

    expect(provider.providerType).toBe("OPENAI_COMPATIBLE")
    expect(provider.defaultModel).toBe("gpt-4o-mini")
    expect(provider.apiKey).toBe("sk-vault-test-key")
    expect(mockGetApiKey).toHaveBeenCalledWith({
      organizationId: "org_1",
      providerId: "prov_openai_1",
      vaultKey: "API_KEY",
    })
  })

  it("falls back to Managed OpenRouter configuration when no BYOK is set", async () => {
    const mockFinder: ConfigFinder = mock(async () => null)

    const provider = await resolveAiProviderConfig(
      {
        organizationId: "org_no_byok",
      },
      mockGetApiKey,
      mockFinder
    )

    expect(provider.providerType).toBe("MANAGED")
    expect(provider.baseUrl).toBe("https://openrouter.ai/api/v1")
    expect(provider.defaultModel).toBe("anthropic/claude-sonnet-4-5-20251120")
  })
  it("resolves default organization BYOK provider when providerId is not passed", async () => {
    const mockFinder: ConfigFinder = mock(async () => ({
      id: "prov_default_1",
      organizationId: "org_default",
      name: "Default OpenAI",
      providerType: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o",
      vaultKey: "API_KEY",
      isDefault: true,
    }))

    const provider = await resolveAiProviderConfig(
      {
        organizationId: "org_default",
        modelOverride: "gpt-4o-custom",
      },
      mockGetApiKey,
      mockFinder
    )

    expect(provider.providerType).toBe("OPENAI_COMPATIBLE")
    expect(provider.defaultModel).toBe("gpt-4o-custom")
    expect(provider.apiKey).toBe("sk-vault-test-key")
    expect(mockGetApiKey).toHaveBeenCalledWith({
      organizationId: "org_default",
      providerId: "prov_default_1",
      vaultKey: "API_KEY",
    })
  })

  it("handles fallback configuration with custom env variables", async () => {
    delete process.env.AI_BASE_URL
    delete process.env.AI_CHAT_MODEL
    process.env.OPENAI_API_KEY = "sk-openai-direct"
    process.env.AI_PROVIDER = "OPENAI_COMPATIBLE"
    const mockFinder: ConfigFinder = mock(async () => null)

    const provider = await resolveAiProviderConfig(
      {
        organizationId: null,
      },
      mockGetApiKey,
      mockFinder
    )

    expect(provider.providerType).toBe("OPENAI_COMPATIBLE")
    expect(provider.apiKey).toBe("sk-openai-direct")
    expect(provider.baseUrl).toBe("https://api.openai.com/v1")
    expect(provider.defaultModel).toBe("gpt-4o-mini")
  })

  it("handles fallback when BYOK provider returns no API key", async () => {
    const mockFinder: ConfigFinder = mock(async () => ({
      id: "prov_empty",
      organizationId: "org_empty",
      providerType: "OPENAI_COMPATIBLE",
      defaultModel: "gpt-4o",
      vaultKey: "API_KEY",
    }))
    const emptyApiKeyResolver = mock(async () => null)

    const provider = await resolveAiProviderConfig(
      {
        organizationId: "org_empty",
        providerId: "prov_empty",
      },
      emptyApiKeyResolver,
      mockFinder
    )

    expect(provider.providerType).toBe("MANAGED")
  })

  it("creates universal LanguageModel instances for OpenAI and Managed providers", () => {
    const openaiProvider: ResolvedAiProvider = {
      providerType: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini",
      apiKey: "sk-mock-key",
    }

    const modelOpenai = createAiLanguageModel(openaiProvider)
    expect(modelOpenai).toBeTruthy()

    const managedProvider: ResolvedAiProvider = {
      providerType: "MANAGED",
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel: "anthropic/claude-sonnet-4-5-20251120",
      apiKey: "sk-or-mock-key",
    }

    const modelManaged = createAiLanguageModel(managedProvider)
    expect(modelManaged).toBeTruthy()
  })
})
