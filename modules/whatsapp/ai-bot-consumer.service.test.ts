import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  aiChannelBinding: {
    findFirst: mock(async () => null as unknown),
  },
  aiChatSession: {
    findUnique: mock(async () => null as unknown),
    create: mock(async (args: { data: Record<string, unknown> }) => ({
      id: "sess_1",
      sessionId: args.data?.sessionId,
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
    jobId: "job_1",
    messageId: "msg_sent_1",
  })),
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
  usage: { totalTokens: 42, promptTokens: 10, completionTokens: 32 },
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

const { processWhatsappAiBotInbound } =
  await import("./ai-bot-consumer.service")

describe("modules/whatsapp/ai-bot-consumer.service", () => {
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

    mockRedis.set.mockResolvedValue("OK")
    mockRedis.eval.mockResolvedValue(1)
    mockPrisma.aiChatMessage.findMany.mockResolvedValue([])
    mockPrisma.aiIntegrationConnection.findMany.mockResolvedValue([])
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

  it("returns handled: false when no active binding exists", async () => {
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

  it("returns MAX_CHAR_EXCEEDED when input exceeds limit", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 10,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    } as never)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Pesan ini terlalu panjang sekali.",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(false)
    expect(res.reason).toBe("MAX_CHAR_EXCEEDED")
  })

  it("filters blocked words and sends fallback message", async () => {
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

  it("returns SESSION_LOCKED when lock cannot be acquired", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        enableProfanityFilter: false,
      },
    } as never)

    mockRedis.set.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(false)
    expect(res.reason).toBe("SESSION_LOCKED")
    expect(mockRedis.set).toHaveBeenCalled()
    expect(mockRedis.eval).not.toHaveBeenCalled()
  })

  it("enforces daily limit and rolls back message counter", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        dailyUserLimit: 1,
        enableProfanityFilter: false,
        customBlockedWords: [],
        fallbackMessage: "Batas chat harian Anda telah habis.",
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_limit",
      totalMessages: 5,
    } as never)

    mockPrisma.aiChatSession.update.mockResolvedValueOnce({
      id: "sess_limit",
      totalMessages: 6,
    } as never)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("DAILY_LIMIT_REACHED")
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Batas chat harian Anda telah habis.",
      })
    )
    expect(mockRedis.eval).toHaveBeenCalled()
  })

  it("executes autonomous multi-step reasoning with tools", async () => {
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

    mockPrisma.aiChatMessage.findMany.mockResolvedValueOnce([
      {
        id: "m_1",
        sessionId: "sess_1",
        role: "user",
        content: "Halo",
        createdAt: new Date(),
      },
    ])

    mockSearchHybridKnowledge.mockResolvedValueOnce([
      {
        id: "chunk_1",
        title: "Jam Operasional",
        category: "INFO",
        contentMarkdown: "Buka 08:00 - 17:00 WIB",
        rrfScore: 0.95,
      },
    ])

    mockPrisma.aiIntegrationConnection.findMany.mockResolvedValueOnce([
      {
        id: "conn_1",
        name: "checkLabStatus",
        description: "Cek hasil lab",
        baseUrl: "https://lab.example.com",
        isActive: true,
      },
    ])

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce(null)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Berapa nomor registrasi hasil lab?",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(res.handled).toBe(true)
    expect(res.agentProfileId).toBe("agent_1")
    expect(mockRedis.set).toHaveBeenCalled()
    expect(mockPrisma.aiChatMessage.findMany).toHaveBeenCalled()
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxSteps: 5,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
        ]),
        tools: expect.objectContaining({
          queryKnowledgeBase: expect.anything(),
          checkLabStatus: expect.anything(),
        }),
      })
    )
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        phoneNumber: "+62812345678",
        message: "Halo, ada yang bisa kami bantu mengenai pesanan Anda?",
        deviceId: "dev_1",
      })
    )
    expect(mockRedis.eval).toHaveBeenCalled()
  })
})
