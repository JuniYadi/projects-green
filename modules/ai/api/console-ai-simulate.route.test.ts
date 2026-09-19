import { describe, it, expect, mock, beforeEach } from "bun:test"

mock.module("server-only", () => ({}))

const mockAuth = mock(() =>
  Promise.resolve({
    user: { id: "user_console", organizationId: "org_console" },
    organizationId: "org_console",
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockAuth,
}))

const mockPrisma = {
  aiAgentProfile: {
    findFirst: mock(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockResolveAiProviderConfig = mock()
const mockCreateAiLanguageModel = mock()

mock.module("@/modules/ai/ai-provider.factory", () => ({
  resolveAiProviderConfig: mockResolveAiProviderConfig,
  createAiLanguageModel: mockCreateAiLanguageModel,
}))

const mockBuildAgentTools = mock()

mock.module("@/modules/ai/agents/ai-agent-tools", () => ({
  buildAgentTools: mockBuildAgentTools,
}))

const mockGenerateText = mock()
const mockStepCountIs = mock(() => () => false)

mock.module("ai", () => ({
  generateText: mockGenerateText,
  stepCountIs: mockStepCountIs,
}))

const { createConsoleAiSimulateRoutes } = await import(
  "./console-ai-simulate.route"
)
const { resetSimulationRateLimit } = await import(
  "@/modules/whatsapp/agent/agent-simulation.service"
)

describe("Console AI Simulate Route (/console/ai/simulate)", () => {
  let app: ReturnType<typeof createConsoleAiSimulateRoutes>

  beforeEach(() => {
    mockAuth.mockReset()
    mockPrisma.aiAgentProfile.findFirst.mockReset()
    mockResolveAiProviderConfig.mockReset()
    mockCreateAiLanguageModel.mockReset()
    mockBuildAgentTools.mockReset()
    mockGenerateText.mockReset()

    resetSimulationRateLimit()

    mockAuth.mockResolvedValue({
      user: { id: "user_console", organizationId: "org_console" },
      organizationId: "org_console",
    })

    mockResolveAiProviderConfig.mockResolvedValue({
      providerType: "MANAGED",
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel: "anthropic/claude-3.5-sonnet",
      apiKey: "test-api-key",
    })

    mockCreateAiLanguageModel.mockReturnValue({
      modelId: "mock-model",
    })

    mockBuildAgentTools.mockResolvedValue({})

    mockGenerateText.mockResolvedValue({
      text: "Simulasi berhasil dijalankan [BUTTON: Coba Lagi]",
      usage: {
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30,
      },
    })

    app = createConsoleAiSimulateRoutes()
  })

  it("handles unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce({
      user: null as never,
      organizationId: null as never,
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_cs",
          message: "Halo",
        }),
      })
    )

    expect(res.status).toBe(401)
  })

  it("handles agent not found error", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce(null)

    const res = await app.handle(
      new Request("http://localhost/console/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_missing",
          message: "Halo",
        }),
      })
    )

    expect(res.status).toBe(404)
    const json = (await res.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
  })

  it("handles POST /console/ai/simulate with trailing slash", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce({
      id: "agent_cs",
      organizationId: "org_console",
      name: "Agent CS",
      systemPrompt: "Anda adalah CS profesional.",
      fallbackMessage: "Maaf sedang sibuk.",
      allowInteractiveReplies: true,
      isActive: true,
    })

    const res = await app.handle(
      new Request("http://localhost/console/ai/simulate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_cs",
          message: "Halo, tes simulasi console",
          conversationHistory: [
            { role: "user", content: "Halo" },
            { role: "assistant", content: "Halo, ada yang bisa dibantu?" },
          ],
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: {
        replyText: string
        rawText: string
        interactiveButtons: Array<{ type: string; title: string }>
        toolCalls: unknown[]
        usage: { promptTokens: number; completionTokens: number }
      }
    }

    expect(json.ok).toBe(true)
    expect(json.data.replyText).toBe("Simulasi berhasil dijalankan")
    expect(json.data.interactiveButtons).toHaveLength(1)
    expect(json.data.interactiveButtons[0].title).toBe("Coba Lagi")
    expect(json.data.usage.promptTokens).toBe(20)
    expect(json.data.usage.completionTokens).toBe(10)
  })

  it("handles image attachment URL correctly", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce({
      id: "agent_cs",
      organizationId: "org_console",
      name: "Agent CS",
      systemPrompt: "Anda adalah CS profesional.",
      fallbackMessage: "Maaf",
      allowInteractiveReplies: true,
      isActive: true,
    })

    let capturedMessages: unknown = null
    mockGenerateText.mockImplementationOnce(
      async ({ messages }: { messages: unknown }) => {
        capturedMessages = messages
        return {
          text: "Gambar diterima dengan baik.",
          usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
        }
      }
    )

    const res = await app.handle(
      new Request("http://localhost/console/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_cs",
          message: "Tolong cek struk belanja ini kak",
          mediaUrl: "https://example.com/receipt.jpg",
          mediaType: "image/jpeg",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: { replyText: string }
    }
    expect(json.ok).toBe(true)
    expect(json.data.replyText).toBe("Gambar diterima dengan baik.")
    expect(Array.isArray(capturedMessages)).toBe(true)
  })
})
