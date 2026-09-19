import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  aiChannelBinding: {
    findFirst: mock(async () => null as unknown),
  },
  aiChatSession: {
    findUnique: mock(async () => null as unknown),
    create: mock(async (args: { data: Record<string, unknown> }) => ({
      id: "sess_vision_1",
      sessionId: args.data?.sessionId,
      totalMessages: 0,
      ...args.data,
    })),
    update: mock(
      async (args: {
        data: {
          totalMessages?: { increment?: number; decrement?: number }
          totalTokens?: { increment?: number }
        }
      }) => ({
        id: "sess_vision_1",
        totalMessages: args.data?.totalMessages?.increment ? 1 : 0,
      })
    ),
  },
  aiChatMessage: {
    findMany: mock(async () => [] as unknown[]),
    create: mock(async () => ({})),
  },
  aiKnowledgeDocument: {
    findMany: mock(async () => []),
  },
  aiIntegrationConnection: {
    findMany: mock(async () => [] as unknown[]),
  },
  aiUsageAudit: {
    create: mock(async () => ({})),
  },
}

const mockRedis = {
  set: mock(async () => "OK" as string | null),
  get: mock(async () => null as string | null),
  del: mock(async () => 1),
  eval: mock(async () => 1),
}

const mockMessageService = {
  sendMessage: mock(async () => ({
    jobId: "job_vision_1",
    messageId: "msg_vision_1",
  })),
}

const mockSearchHybridKnowledge = mock(async () => [])
let mockResolvedModel = "gpt-4o"
const mockResolveAiProviderConfig = mock(async () => ({
  providerType: "MANAGED",
  baseUrl: null,
  defaultModel: mockResolvedModel,
  apiKey: "mock_key",
}))
const mockCreateAiLanguageModel = mock(() => ({}) as never)
const mockGenerateText = mock(async () => ({
  text: "Gambar telah dianalisis.",
  usage: { totalTokens: 30, promptTokens: 10, completionTokens: 20 },
}))

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/lib/redis", () => ({
  redis: mockRedis,
}))

mock.module("@/modules/whatsapp/messages/messages.service", () => ({
  messageService: mockMessageService,
}))

mock.module("@/modules/ai/ai-rag.service", () => ({
  searchHybridKnowledge: mockSearchHybridKnowledge,
}))

mock.module("@/modules/ai/ai-provider.factory", () => ({
  resolveAiProviderConfig: mockResolveAiProviderConfig,
  createAiLanguageModel: mockCreateAiLanguageModel,
}))

mock.module("ai", () => ({
  generateText: mockGenerateText,
  stepCountIs: mock((n: number) => n),
  tool: mock((def: unknown) => def),
}))

const {
  processWhatsappAiBotInbound,
  isVisionSupportedModel,
  VISION_FALLBACK_TEXT,
} = await import("./ai-bot-consumer.service")

describe("modules/whatsapp/ai-bot-vision", () => {
  beforeEach(() => {
    mockPrisma.aiChannelBinding.findFirst.mockClear()
    mockPrisma.aiChatSession.findUnique.mockClear()
    mockPrisma.aiChatSession.create.mockClear()
    mockPrisma.aiChatSession.update.mockClear()
    mockPrisma.aiChatMessage.findMany.mockClear()
    mockPrisma.aiChatMessage.create.mockClear()
    mockPrisma.aiIntegrationConnection.findMany.mockClear()
    mockPrisma.aiUsageAudit.create.mockClear()

    mockRedis.set.mockClear()
    mockRedis.get.mockClear()
    mockRedis.del.mockClear()
    mockRedis.eval.mockClear()

    mockResolveAiProviderConfig.mockClear()
    mockCreateAiLanguageModel.mockClear()
    mockMessageService.sendMessage.mockClear()
    mockSearchHybridKnowledge.mockClear()
    mockGenerateText.mockClear()

    mockResolvedModel = "gpt-4o"
  })

  it("identifies vision-supported models correctly", () => {
    expect(isVisionSupportedModel("gpt-4o")).toBe(true)
    expect(isVisionSupportedModel("gpt-4o-mini")).toBe(true)
    expect(isVisionSupportedModel("gpt-4-turbo")).toBe(true)
    expect(isVisionSupportedModel("claude-3-5-sonnet")).toBe(true)
    expect(isVisionSupportedModel("claude-sonnet-4-5-20251120")).toBe(true)
    expect(isVisionSupportedModel("claude-opus-20240229")).toBe(true)
    expect(isVisionSupportedModel("gemini-1.5-pro")).toBe(true)
    expect(isVisionSupportedModel("gemini-2.0-flash")).toBe(true)

    expect(isVisionSupportedModel("deepseek-chat")).toBe(false)
    expect(isVisionSupportedModel("gpt-3.5-turbo")).toBe(false)
    expect(isVisionSupportedModel("llama-3-70b")).toBe(false)
    expect(isVisionSupportedModel("")).toBe(false)
  })

  it(
    "constructs multimodal message content with image URL for vision model",
    async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_vis",
      agentProfile: {
        id: "agent_vis",
        name: "Agent Vision",
        isActive: true,
        systemPrompt: "Anda asisten vision.",
        fallbackMessage: "Maaf terjadi kesalahan.",
        maxCharLength: 800,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    })
    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Apakah sepatu ini ready?",
      conversationId: "conv_vis_1",
      inboundMessageId: "msg_vis_1",
      mediaUrl: "https://example.com/images/shoe.jpg",
      mediaType: "image/jpeg",
    })

    expect(res.handled).toBe(true)
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as {
      messages: Array<{
        role: string
        content: unknown
      }>
    }

    const lastMsg = callArgs.messages[callArgs.messages.length - 1]
    expect(lastMsg.role).toBe("user")
    expect(Array.isArray(lastMsg.content)).toBe(true)
    expect(lastMsg.content).toEqual([
      { type: "text", text: "Apakah sepatu ini ready?" },
      { type: "image", image: new URL("https://example.com/images/shoe.jpg") },
    ])
  })

  it(
    "falls back gracefully with interactive CS button on text-only model",
    async () => {
    mockResolvedModel = "deepseek-chat"
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_txt",
      agentProfile: {
        id: "agent_txt",
        name: "Agent Text Only",
        isActive: true,
        systemPrompt: "Anda asisten teks.",
        fallbackMessage: "Maaf terjadi kesalahan.",
        maxCharLength: 800,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    })
    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Cek produk ini kak",
      conversationId: "conv_txt_1",
      inboundMessageId: "msg_txt_1",
      mediaUrl: "https://example.com/images/shirt.jpg",
      mediaType: "image/jpeg",
    })

    expect(res.handled).toBe(true)
    expect(mockGenerateText).not.toHaveBeenCalled()
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "interactive",
        interactivePayload: {
          type: "button",
          body: { text: VISION_FALLBACK_TEXT },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "action_contact_cs",
                  title: "💬 Hubungi CS Admin",
                },
              },
            ],
          },
        },
      })
    )
  })

  it(
    "handles image without text caption using default user prompt",
    async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_vis2",
      agentProfile: {
        id: "agent_vis2",
        name: "Agent Vision",
        isActive: true,
        systemPrompt: "Anda asisten vision.",
        fallbackMessage: "Maaf.",
        maxCharLength: 800,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    })
    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "",
      conversationId: "conv_vis_2",
      inboundMessageId: "msg_vis_2",
      mediaUrl: "https://example.com/images/nocaption.png",
      mediaType: "image/png",
    })

    expect(res.handled).toBe(true)
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as {
      messages: Array<{
        role: string
        content: unknown
      }>
    }
    const lastMsg = callArgs.messages[callArgs.messages.length - 1]
    expect(lastMsg.content).toEqual([
      { type: "text", text: "Tolong bantu periksa gambar ini." },
      {
        type: "image",
        image: new URL("https://example.com/images/nocaption.png"),
      },
    ])
  })

  it(
    "includes out-of-stock guidance and fallback recommendation prompt",
    async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_vis3",
      agentProfile: {
        id: "agent_vis3",
        name: "Agent Vision",
        isActive: true,
        systemPrompt: "Toko Fashion",
        fallbackMessage: "Maaf.",
        maxCharLength: 800,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    })
    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce(null)

    await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Sepatu ini ada?",
      conversationId: "conv_vis_3",
      inboundMessageId: "msg_vis_3",
      mediaUrl: "https://example.com/images/shoes.jpg",
      mediaType: "image/jpeg",
    })

    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as {
      system: string
    }
    expect(callArgs.system).toContain("KEBIJAKAN PRODUK HABIS (OUT OF STOCK)")
    expect(callArgs.system).toContain("[Lihat Model Serupa]")
    expect(callArgs.system).toContain("[Kabari Saat Restock]")
  })

  it("acknowledges and processes PDF document messages", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_vis4",
      agentProfile: {
        id: "agent_vis4",
        name: "Agent Doc",
        isActive: true,
        systemPrompt: "Asisten Dokumen",
        fallbackMessage: "Maaf.",
        maxCharLength: 800,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    })
    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Tolong cek hasil lab saya",
      conversationId: "conv_vis_4",
      inboundMessageId: "msg_vis_4",
      mediaUrl: "https://example.com/docs/lab_result.pdf",
      mediaType: "application/pdf",
    })

    expect(res.handled).toBe(true)
    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const callArgs = (mockGenerateText.mock.calls as unknown[][])[0][0] as {
      system: string
      messages: Array<{ role: string; content: unknown }>
    }
    expect(callArgs.system).toContain("PENANGANAN DOKUMEN PDF")
    const lastMsg = callArgs.messages[callArgs.messages.length - 1]
    expect(lastMsg.content).toBe(
      "[Dokumen PDF terlampir]: Tolong cek hasil lab saya"
    )
  })
})
