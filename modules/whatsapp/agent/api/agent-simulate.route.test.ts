import { describe, it, expect, mock, beforeEach } from "bun:test"

mock.module("server-only", () => ({}))

const mockAuth = mock(() =>
  Promise.resolve({
    user: { id: "user_test", organizationId: "org_test" },
    organizationId: "org_test",
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockAuth,
}))

const mockPrisma = {
  aiAgentProfile: {
    findFirst: mock(),
  },
  whatsAppConversation: {
    create: mock(),
    update: mock(),
  },
  whatsAppMessage: {
    create: mock(),
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

const mockSendMessage = mock()

mock.module("@/modules/whatsapp/messages/messages.service", () => ({
  messageService: {
    sendMessage: mockSendMessage,
  },
}))

const { Elysia } = await import("elysia")
const { agentSimulateRoutes } = await import("./agent-simulate.route")
const { resetSimulationRateLimit } = await import(
  "../agent-simulation.service"
)

describe("Universal AI Agent Simulation API (agent-simulate.route)", () => {
  let app: { handle: (req: Request) => Promise<Response> }

  beforeEach(() => {
    mockAuth.mockReset()
    mockPrisma.aiAgentProfile.findFirst.mockReset()
    mockPrisma.whatsAppConversation.create.mockReset()
    mockPrisma.whatsAppConversation.update.mockReset()
    mockPrisma.whatsAppMessage.create.mockReset()
    mockResolveAiProviderConfig.mockReset()
    mockCreateAiLanguageModel.mockReset()
    mockBuildAgentTools.mockReset()
    mockGenerateText.mockReset()
    mockSendMessage.mockReset()

    resetSimulationRateLimit()

    mockAuth.mockResolvedValue({
      user: { id: "user_test", organizationId: "org_test" },
      organizationId: "org_test",
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
      text: "Halo, ada yang bisa kami bantu?",
      usage: {
        promptTokens: 15,
        completionTokens: 10,
        totalTokens: 25,
      },
    })

    app = new Elysia().use(agentSimulateRoutes)
  })

  it("rejects unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce({
      user: null as never,
      organizationId: null as never,
    })

    const res = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_123",
          message: "Halo",
        }),
      })
    )

    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("enforces tenant isolation and rejects cross-org access", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce(null)

    const res = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_other_org",
          message: "Periksa status order",
        }),
      })
    )

    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NOT_FOUND")

    expect(mockPrisma.aiAgentProfile.findFirst).toHaveBeenCalledWith({
      where: {
        id: "agent_other_org",
        organizationId: "org_test",
      },
      select: expect.any(Object),
    })
  })

  it("rejects simulation if agent profile is inactive", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce({
      id: "agent_inactive",
      organizationId: "org_test",
      name: "Toko Bot",
      systemPrompt: "Prompt",
      fallbackMessage: "Maaf offline",
      allowInteractiveReplies: true,
      isActive: false,
    })

    const res = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_inactive",
          message: "Halo",
        }),
      })
    )

    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe("AGENT_INACTIVE")
  })

  it("executes simulation with captured tool calls and latency", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce({
      id: "agent_active",
      organizationId: "org_test",
      name: "Toko Bot",
      systemPrompt: "Anda adalah agen toko resmi.",
      fallbackMessage: "Maaf tidak bisa menjawab",
      allowInteractiveReplies: true,
      isActive: true,
    })

    const mockToolExecute = mock(async (args: { orderId: string }) => {
      return {
        success: true,
        orderId: args.orderId,
        status: "DELIVERED",
      }
    })

    mockBuildAgentTools.mockResolvedValueOnce({
      checkOrderStatus: {
        description: "Cek status pesanan",
        parameters: {},
        execute: mockToolExecute,
      },
    })

    mockGenerateText.mockImplementationOnce(
      async ({
        tools,
      }: {
        tools: Record<
          string,
          { execute: (args: unknown, options?: unknown) => Promise<unknown> }
        >
      }) => {
        // Model triggers tool execution
        await tools.checkOrderStatus.execute({ orderId: "ORD-999" }, {})
        return {
          text: "Pesanan ORD-999 telah terkirim!",
          usage: {
            promptTokens: 40,
            completionTokens: 20,
            totalTokens: 60,
          },
        }
      }
    )

    const res = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_active",
          message: "Bagaimana status order ORD-999?",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: {
        replyText: string
        rawText: string
        interactiveButtons: unknown[]
        toolCalls: Array<{
          toolName: string
          args: { orderId: string }
          output: { success: boolean; orderId: string; status: string }
          status: string
          durationMs: number
        }>
        usage: {
          promptTokens: number
          completionTokens: number
          totalTokens: number
          latencyMs: number
        }
      }
    }

    expect(json.ok).toBe(true)
    expect(json.data.replyText).toBe("Pesanan ORD-999 telah terkirim!")
    expect(json.data.rawText).toBe("Pesanan ORD-999 telah terkirim!")
    expect(json.data.toolCalls).toHaveLength(1)
    expect(json.data.toolCalls[0].toolName).toBe("checkOrderStatus")
    expect(json.data.toolCalls[0].args).toEqual({ orderId: "ORD-999" })
    expect(json.data.toolCalls[0].output).toEqual({
      success: true,
      orderId: "ORD-999",
      status: "DELIVERED",
    })
    expect(json.data.toolCalls[0].status).toBe("SUCCESS")
    expect(json.data.toolCalls[0].durationMs).toBeGreaterThanOrEqual(0)
    expect(json.data.usage.promptTokens).toBe(40)
    expect(json.data.usage.completionTokens).toBe(20)
    expect(json.data.usage.totalTokens).toBe(60)
    expect(json.data.usage.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it("extracts interactive buttons and cleans replyText", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce({
      id: "agent_active",
      organizationId: "org_test",
      name: "Toko Bot",
      systemPrompt: "Anda adalah agen toko resmi.",
      fallbackMessage: "Maaf",
      allowInteractiveReplies: true,
      isActive: true,
    })

    const rawResponse =
      "Silakan pilih opsi bantuan di bawah ini:\n\n" +
      "[BUTTON: Cek Ongkir]\n" +
      "[BUTTON: Hubungi CS]\n" +
      "[URL: Website Kami | https://example.com/shop]"

    mockGenerateText.mockResolvedValueOnce({
      text: rawResponse,
      usage: {
        promptTokens: 25,
        completionTokens: 35,
        totalTokens: 60,
      },
    })

    const res = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_active",
          message: "Info toko dong kak",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: {
        replyText: string
        rawText: string
        interactiveButtons: Array<{
          type: "reply" | "cta_url"
          title: string
          payload?: string
          url?: string
        }>
      }
    }

    expect(json.ok).toBe(true)
    expect(json.data.rawText).toBe(rawResponse)
    expect(json.data.replyText).toBe(
      "Silakan pilih opsi bantuan di bawah ini:"
    )
    expect(json.data.interactiveButtons).toHaveLength(3)
    expect(json.data.interactiveButtons[0]).toEqual({
      type: "reply",
      title: "Cek Ongkir",
      payload: "btn_1",
    })
    expect(json.data.interactiveButtons[1]).toEqual({
      type: "reply",
      title: "Hubungi CS",
      payload: "btn_2",
    })
    expect(json.data.interactiveButtons[2]).toEqual({
      type: "cta_url",
      title: "Website Kami",
      url: "https://example.com/shop",
    })
  })

  it(
    "handles NOT_FOUND and ERROR tool outcomes correctly in traces",
    async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce({
      id: "agent_active",
      organizationId: "org_test",
      name: "Toko Bot",
      systemPrompt: "Prompt",
      fallbackMessage: "Maaf",
      allowInteractiveReplies: true,
      isActive: true,
    })

    const notFoundTool = mock(async () => ({
      code: "NOT_FOUND",
      status: 404,
      message: "Resi tidak ditemukan",
    }))

    const failingTool = mock(async () => {
      throw new Error("Koneksi gateway timeout")
    })

    mockBuildAgentTools.mockResolvedValueOnce({
      lookupTracking: {
        description: "Lacak paket",
        parameters: {},
        execute: notFoundTool,
      },
      processRefund: {
        description: "Proses pengembalian dana",
        parameters: {},
        execute: failingTool,
      },
    })

    mockGenerateText.mockImplementationOnce(
      async ({
        tools,
      }: {
        tools: Record<
          string,
          { execute: (args: unknown, options?: unknown) => Promise<unknown> }
        >
      }) => {
        await tools.lookupTracking.execute({ resi: "123" }, {})
        try {
          await tools.processRefund.execute({ refundId: "ref_1" }, {})
        } catch {
          // LLM engine absorbs tool errors
        }
        return {
          text: "Resi tidak ditemukan dan sistem refund sedang gangguan.",
          usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
        }
      }
    )

    const res = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_active",
          message: "Lacak resi 123 dan refund",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: {
        toolCalls: Array<{
          toolName: string
          status: string
          output: unknown
        }>
      }
    }

    expect(json.data.toolCalls).toHaveLength(2)
    expect(json.data.toolCalls[0].toolName).toBe("lookupTracking")
    expect(json.data.toolCalls[0].status).toBe("NOT_FOUND")
    expect(json.data.toolCalls[1].toolName).toBe("processRefund")
    expect(json.data.toolCalls[1].status).toBe("ERROR")
  })

  it(
    "strictly guarantees dry-run (no WhatsApp API calls or DB mutations)",
    async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValueOnce({
      id: "agent_active",
      organizationId: "org_test",
      name: "Toko Bot",
      systemPrompt: "Anda adalah agen toko resmi.",
      fallbackMessage: "Maaf",
      allowInteractiveReplies: true,
      isActive: true,
    })

    const res = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_active",
          message: "Testing dry-run message sending",
          conversationHistory: [
            { role: "user", content: "Halo bot" },
            { role: "assistant", content: "Halo, ada yang bisa dibantu?" },
          ],
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockPrisma.whatsAppConversation.create).not.toHaveBeenCalled()
    expect(mockPrisma.whatsAppConversation.update).not.toHaveBeenCalled()
    expect(mockPrisma.whatsAppMessage.create).not.toHaveBeenCalled()
  })

  it("enforces tenant simulation rate limits", async () => {
    mockPrisma.aiAgentProfile.findFirst.mockResolvedValue({
      id: "agent_active",
      organizationId: "org_test",
      name: "Toko Bot",
      systemPrompt: "Prompt",
      fallbackMessage: "Maaf",
      allowInteractiveReplies: true,
      isActive: true,
    })

    // Consume all 20 rate limit slots
    for (let i = 0; i < 20; i++) {
      const res = await app.handle(
        new Request("http://localhost/agent/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentProfileId: "agent_active",
            message: `Request ${i}`,
          }),
        })
      )
      expect(res.status).toBe(200)
    }

    // 21st request must be 429
    const blockedRes = await app.handle(
      new Request("http://localhost/agent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentProfileId: "agent_active",
          message: "Request 21",
        }),
      })
    )

    expect(blockedRes.status).toBe(429)
    const json = (await blockedRes.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("RATE_LIMITED")
  })
})
