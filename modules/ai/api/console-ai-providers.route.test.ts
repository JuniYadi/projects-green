import { describe, it, expect, mock, beforeEach } from "bun:test"
// Mock WorkOS auth before imports
const mockAuth = mock(() =>
  Promise.resolve({
    user: { id: "user_1", organizationId: "org_1" },
    organizationId: "org_1",
  })
)
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockAuth,
}))

// Mock Prisma
const mockPrisma = {
  aiProviderConfig: {
    findMany: mock(),
    findFirst: mock(),
    create: mock(),
    updateMany: mock(),
    delete: mock(),
  },
}
mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// Mock Vault service
const mockVault = {
  saveProviderApiKey: mock(() =>
    Promise.resolve({
      vaultPath: "tenants/org_1/ai/providers/prov_123",
      vaultKey: "API_KEY",
    })
  ),
  getProviderApiKey: mock(() => Promise.resolve("sk-test-key")),
  deleteProviderApiKey: mock(() => Promise.resolve(true)),
}
mock.module("@/modules/ai/ai-vault.service", () => mockVault)

// Mock generateText
mock.module("ai", () => ({
  generateText: mock(() =>
    Promise.resolve({
      text: "Hello there user",
    })
  ),
}))

import { createConsoleAiProvidersRoutes } from "./console-ai-providers.route"

describe("Console AI Providers Route", () => {
  let app: ReturnType<typeof createConsoleAiProvidersRoutes>

  beforeEach(() => {
    mockAuth.mockClear()
    mockPrisma.aiProviderConfig.findMany.mockClear()
    mockPrisma.aiProviderConfig.findFirst.mockClear()
    mockPrisma.aiProviderConfig.create.mockClear()
    mockPrisma.aiProviderConfig.updateMany.mockClear()
    mockPrisma.aiProviderConfig.delete.mockClear()
    mockVault.saveProviderApiKey.mockClear()
    mockVault.getProviderApiKey.mockClear()
    mockVault.deleteProviderApiKey.mockClear()

    mockAuth.mockResolvedValue({
      user: { id: "user_1", organizationId: "org_1" },
      organizationId: "org_1",
    })
    app = createConsoleAiProvidersRoutes()
  })

  it("lists providers for organization", async () => {
    mockPrisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        id: "prov_1",
        name: "OpenAI Corporate",
        providerType: "OPENAI_COMPATIBLE",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        isDefault: true,
        isConfigured: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const res = await app.handle(
      new Request("http://localhost/console/ai/providers", { method: "GET" })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: unknown[] }
    expect(json.ok).toBe(true)
    expect(json.data.length).toBe(1)
  })

  it("creates a BYOK provider and stores key in vault", async () => {
    mockPrisma.aiProviderConfig.create.mockResolvedValue({
      id: "prov_new",
      name: "DeepSeek Self-Hosted",
      providerType: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-chat",
      isDefault: true,
      isConfigured: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "DeepSeek Self-Hosted",
          providerType: "OPENAI_COMPATIBLE",
          baseUrl: "https://api.deepseek.com",
          defaultModel: "deepseek-chat",
          apiKey: "sk-deepseek-12345",
          isDefault: true,
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: { id: string } }
    expect(json.ok).toBe(true)
    expect(mockVault.saveProviderApiKey).toHaveBeenCalled()
    expect(mockPrisma.aiProviderConfig.create).toHaveBeenCalled()
  })

  it("tests connection successfully", async () => {
    const res = await app.handle(
      new Request("http://localhost/console/ai/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: "OPENAI_COMPATIBLE",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4o-mini",
          apiKey: "sk-valid-key",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; reply: string }
    expect(json.ok).toBe(true)
    expect(json.reply).toBe("Hello there user")
  })

  it("deletes a provider and removes secret from vault", async () => {
    mockPrisma.aiProviderConfig.findFirst.mockResolvedValue({
      id: "prov_to_delete",
      organizationId: "org_1",
    })
    mockPrisma.aiProviderConfig.delete.mockResolvedValue({
      id: "prov_to_delete",
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/providers/prov_to_delete", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    expect(mockVault.deleteProviderApiKey).toHaveBeenCalled()
    expect(mockPrisma.aiProviderConfig.delete).toHaveBeenCalled()
  })
})
