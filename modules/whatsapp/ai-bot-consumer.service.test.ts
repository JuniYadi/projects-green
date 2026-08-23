import { describe, expect, it, mock, beforeEach } from "bun:test"

const mockPrisma = {
  aiChannelBinding: {
    findFirst: mock(async () => null as unknown),
  },
  aiChatSession: {
    findUnique: mock(async () => null as unknown),
    create: mock(async (args: { data: Record<string, unknown> }) => ({
      id: "sess_1",
      totalMessages: 0,
      ...args.data,
    })),
    update: mock(
      async (args: {
        data: { totalMessages?: { increment?: number; decrement?: number } }
      }) => ({
        id: "sess_1",
        totalMessages: args.data?.totalMessages?.increment ? 1 : 0,
      })
    ),
  },
  aiChatMessage: {
    create: mock(async () => ({})),
  },
  aiKnowledgeDocument: {
    findMany: mock(async () => []),
  },
}

const mockMessageService = {
  sendMessage: mock(async () => ({ jobId: "job_1", messageId: "msg_sent_1" })),
}

const mockSearchHybridKnowledge = mock(async () => [
  {
    id: "chunk_1",
    title: "Jam Operasional",
    category: "INFO",
    contentMarkdown: "Buka 08:00 - 17:00 WIB",
    rrfScore: 0.95,
  },
])
const mockResolveAiProviderConfig = mock(async () => ({}) as never)
const mockCreateAiLanguageModel = mock(() => ({}) as never)
const mockGenerateText = mock(async () => ({
  text: "Halo, ada yang bisa kami bantu mengenai pesanan Anda?",
  usage: { totalTokens: 42 },
}))

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
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
}))

const { processWhatsappAiBotInbound } =
  await import("./ai-bot-consumer.service")

describe("modules/whatsapp/ai-bot-consumer.service", () => {
  beforeEach(() => {
    mockPrisma.aiChannelBinding.findFirst.mockClear()
    mockPrisma.aiChatSession.findUnique.mockClear()
    mockPrisma.aiChatSession.create.mockClear()
    mockPrisma.aiChatSession.update.mockClear()
    mockPrisma.aiChatMessage.create.mockClear()
    mockResolveAiProviderConfig.mockClear()
    mockCreateAiLanguageModel.mockClear()
    mockMessageService.sendMessage.mockClear()
    mockSearchHybridKnowledge.mockClear()
    mockGenerateText.mockClear()
  })

  it("returns handled: false when message text is empty", async () => {
    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "   ",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(false)
    expect(res.reason).toBe("EMPTY_TEXT")
    expect(mockPrisma.aiChannelBinding.findFirst).not.toHaveBeenCalled()
  })

  it("returns handled: false when no active agent binding exists for this device", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(false)
    expect(res.reason).toBe("NO_ACTIVE_AGENT_BINDING")
    expect(mockMessageService.sendMessage).not.toHaveBeenCalled()
  })

  it("filters blocked words and sends fallback message when profanity is detected", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        enableProfanityFilter: true,
        customBlockedWords: ["kasar", "anjing"],
        fallbackMessage: "Mohon gunakan bahasa yang sopan.",
      },
    } as never)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Dasar kata kasar kamu!",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("BLOCKED_WORD_TRIGGERED")
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Mohon gunakan bahasa yang sopan.",
      })
    )
  })

  it("executes hybrid RAG, generates AI reply, sends WhatsApp message, and logs metrics", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        name: "CS Official Bot",
        isActive: true,
        systemPrompt: "Anda adalah CS toko.",
        maxCharLength: 500,
        dailyUserLimit: 20,
        enableProfanityFilter: false,
        customBlockedWords: [],
        providerConfigId: "prov_1",
      },
    } as never)

    mockSearchHybridKnowledge.mockResolvedValueOnce([
      {
        id: "chunk_1",
        title: "Jam Operasional",
        category: "INFO",
        contentMarkdown: "Buka 08:00 - 17:00 WIB",
        rrfScore: 0.95,
      },
    ])

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Jam berapa toko buka?",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(true)
    expect(res.agentProfileId).toBe("agent_1")
    expect(mockSearchHybridKnowledge).toHaveBeenCalled()
    expect(mockGenerateText).toHaveBeenCalled()
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        phoneNumber: "+62812345678",
        message: "Halo, ada yang bisa kami bantu mengenai pesanan Anda?",
        deviceId: "dev_1",
      })
    )
    expect(mockPrisma.aiChatMessage.create).toHaveBeenCalled()
  })
})
