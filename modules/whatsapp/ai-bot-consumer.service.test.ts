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

const mockHasClaimMarker = mock(async () => false)
const mockAcquireProcessingClaim = mock(async () => true)
const mockMarkClaimDone = mock(async () => undefined as void)
const mockReleaseProcessingClaim = mock(async () => undefined as void)
const mockLogStageFailure = mock(() => {})
const mockCheckActiveBan = mock(async () => ({ isBanned: false }) as never)
const mockInspectAgentPromptSafety = mock(() => ({ ok: true }) as never)
const mockRecordSafetyViolation = mock(async () => undefined as never)

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/lib/redis", () => ({
  redis: mockRedis,
}))

mock.module("@/lib/whatsapp/idempotency-repository", () => ({
  hasClaimMarker: mockHasClaimMarker,
  acquireProcessingClaim: mockAcquireProcessingClaim,
  markClaimDone: mockMarkClaimDone,
  releaseProcessingClaim: mockReleaseProcessingClaim,
}))

mock.module("@/lib/logger", () => ({
  logger: {
    warn: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
  logStageFailure: mockLogStageFailure,
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

mock.module("@/modules/docs/docs.guard", () => ({
  checkActiveBan: mockCheckActiveBan,
}))

mock.module("@/modules/ai/agents/ai-agent-guardrails", () => ({
  inspectAgentPromptSafety: mockInspectAgentPromptSafety,
  recordSafetyViolation: mockRecordSafetyViolation,
}))

mock.module("ai", () => ({
  generateText: mockGenerateText,
  streamText: mock(() => ({}) as never),
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
    mockHasClaimMarker.mockClear()
    mockAcquireProcessingClaim.mockClear()
    mockMarkClaimDone.mockClear()
    mockReleaseProcessingClaim.mockClear()
    mockLogStageFailure.mockClear()
    mockCheckActiveBan.mockClear()
    mockInspectAgentPromptSafety.mockClear()
    mockRecordSafetyViolation.mockClear()

    mockRedis.set.mockResolvedValue("OK")
    mockRedis.eval.mockResolvedValue(1)
    mockPrisma.aiChatMessage.findMany.mockResolvedValue([])
    mockPrisma.aiIntegrationConnection.findMany.mockResolvedValue([])
    mockMessageService.sendMessage.mockResolvedValue({
      jobId: "job_1",
      messageId: "msg_sent_1",
    })
    mockHasClaimMarker.mockResolvedValue(false)
    mockAcquireProcessingClaim.mockResolvedValue(true)
    mockMarkClaimDone.mockResolvedValue(undefined as never)
    mockReleaseProcessingClaim.mockResolvedValue(undefined as never)
    mockCheckActiveBan.mockResolvedValue({ isBanned: false } as never)
    mockInspectAgentPromptSafety.mockReturnValue({ ok: true } as never)
    mockRecordSafetyViolation.mockResolvedValue(undefined as never)
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

  it(
    "returns handled: true with reason CUSTOMER_BANNED and sends nothing " +
      "when checkActiveBan reports an active ban",
    async () => {
      mockCheckActiveBan.mockResolvedValueOnce({
        isBanned: true,
        banType: "PHONE",
        reason: "abuse",
      } as never)

      const res = await processWhatsappAiBotInbound({
        organizationId: "org_1",
        deviceId: "dev_1",
        contactPhone: "+62812345678",
        inboundMessageText: "Halo admin toko",
        conversationId: "conv_1",
        inboundMessageId: "msg_banned_1",
      })

      expect(res.handled).toBe(true)
      expect(res.reason).toBe("CUSTOMER_BANNED")
      expect(mockCheckActiveBan).toHaveBeenCalledWith({
        organizationId: "org_1",
        customerPhone: "+62812345678",
      })
      expect(mockPrisma.aiChannelBinding.findFirst).not.toHaveBeenCalled()
      expect(mockPrisma.aiChatSession.create).not.toHaveBeenCalled()
      expect(mockGenerateText).not.toHaveBeenCalled()
      expect(mockMessageService.sendMessage).not.toHaveBeenCalled()
    }
  )

  it("processes normally when the active ban belongs to a different organizationId", async () => {
    mockCheckActiveBan.mockResolvedValueOnce({ isBanned: false } as never)
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    } as never)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_diff_org_1",
    })

    expect(mockCheckActiveBan).toHaveBeenCalledWith({
      organizationId: "org_1",
      customerPhone: "+62812345678",
    })
    expect(res.handled).toBe(true)
    expect(res.reason).not.toBe("CUSTOMER_BANNED")
    expect(mockMessageService.sendMessage).toHaveBeenCalled()
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
        replyToMessageId: "msg_1",
      })
    )
    expect(mockRedis.eval).toHaveBeenCalled()
  })

  it("includes interactive button guidance in system prompt", async () => {
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
        allowInteractiveReplies: true,
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      totalMessages: 0,
    } as never)

    await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Pilihan menu apa saja?",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("[BUTTON: Label Singkat]"),
      })
    )
  })

  it("omits guidance when allowInteractiveReplies is false", async () => {
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
        allowInteractiveReplies: false,
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      totalMessages: 0,
    } as never)

    await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Pilihan menu apa saja?",
      conversationId: "conv_1",
      inboundMessageId: "msg_1",
    })

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining("[BUTTON: Label Singkat]"),
      })
    )
  })

  it("sends plain text when the model emits button tags and the flag is false", async () => {
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
        allowInteractiveReplies: false,
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      totalMessages: 0,
    } as never)

    mockGenerateText.mockResolvedValueOnce({
      text:
        "Silakan tentukan pilihan Anda:\n" +
        "[BUTTON: Beli Sekarang]\n" +
        "[URL: Kunjungi Web | https://example.com/shop]",
      usage: { totalTokens: 30, promptTokens: 10, completionTokens: 20 },
    } as never)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Mau belanja dong",
      conversationId: "conv_1",
      inboundMessageId: "msg_no_buttons_1",
    })

    expect(res.handled).toBe(true)
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        phoneNumber: "+62812345678",
        deviceId: "dev_1",
        message: "Silakan tentukan pilihan Anda:",
        replyToMessageId: "msg_no_buttons_1",
      })
    )
    expect(mockMessageService.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "interactive" })
    )
  })

  it("dispatches interactive payload when action tags are detected", async () => {
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
        allowInteractiveReplies: true,
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      totalMessages: 0,
    } as never)

    mockGenerateText.mockResolvedValueOnce({
      text:
        "Silakan tentukan pilihan Anda:\n" +
        "[BUTTON: Beli Sekarang]\n" +
        "[BUTTON: Tanya Admin CS]\n" +
        "[URL: Kunjungi Web | https://example.com/shop]",
      usage: { totalTokens: 30, promptTokens: 10, completionTokens: 20 },
    } as never)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Mau belanja dong",
      conversationId: "conv_1",
      inboundMessageId: "msg_inbound_99",
    })

    expect(res.handled).toBe(true)
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        phoneNumber: "+62812345678",
        deviceId: "dev_1",
        type: "interactive",
        replyToMessageId: "msg_inbound_99",
        message: "Silakan tentukan pilihan Anda:",
        interactivePayload: expect.objectContaining({
          type: "button",
          body: { text: "Silakan tentukan pilihan Anda:" },
          action: expect.objectContaining({
            buttons: [
              {
                type: "reply",
                reply: { id: "btn_1", title: "Beli Sekarang" },
              },
              {
                type: "reply",
                reply: { id: "btn_2", title: "Tanya Admin CS" },
              },
              {
                type: "cta_url",
                cta_url: {
                  id: "url_3",
                  display_text: "Kunjungi Web",
                  url: "https://example.com/shop",
                },
              },
            ],
          }),
        }),
      })
    )
  })

  it("does not send again when the done marker exists", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    } as never)

    mockHasClaimMarker.mockResolvedValueOnce(true)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_retry_1",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("DUPLICATE_REPLY_CLAIMED")
    expect(mockHasClaimMarker).toHaveBeenCalledWith(
      "wa:bot-reply:done:msg_retry_1"
    )
    expect(mockAcquireProcessingClaim).not.toHaveBeenCalled()
    expect(mockPrisma.aiChatSession.findUnique).not.toHaveBeenCalled()
    expect(mockGenerateText).not.toHaveBeenCalled()
    expect(mockMessageService.sendMessage).not.toHaveBeenCalled()
    expect(mockRedis.eval).toHaveBeenCalled() // lock still released
  })

  it("throws so BullMQ retries when a live processing claim exists", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        enableProfanityFilter: false,
        customBlockedWords: [],
      },
    } as never)

    mockHasClaimMarker.mockResolvedValueOnce(false)
    mockAcquireProcessingClaim.mockResolvedValueOnce(false)

    await expect(
      processWhatsappAiBotInbound({
        organizationId: "org_1",
        deviceId: "dev_1",
        contactPhone: "+62812345678",
        inboundMessageText: "Halo admin toko",
        conversationId: "conv_1",
        inboundMessageId: "msg_in_progress_1",
      })
    ).rejects.toThrow("REPLY_IN_PROGRESS")
    expect(mockAcquireProcessingClaim).toHaveBeenCalledWith(
      "wa:bot-reply:processing:msg_in_progress_1",
      expect.any(Number)
    )
    expect(mockPrisma.aiChatSession.findUnique).not.toHaveBeenCalled()
    expect(mockGenerateText).not.toHaveBeenCalled()
    expect(mockMessageService.sendMessage).not.toHaveBeenCalled()
    expect(mockMarkClaimDone).not.toHaveBeenCalled()
    expect(mockReleaseProcessingClaim).not.toHaveBeenCalled()
  })

  it(
    "releases the claim and rethrows when session setup / provider / " +
      "retrieval throws so the retry can process",
    async () => {
      mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
        id: "bind_1",
        isActive: true,
        agentProfile: {
          id: "agent_1",
          isActive: true,
          maxCharLength: 500,
          enableProfanityFilter: false,
          customBlockedWords: [],
        },
      } as never)

      const dbError = new Error("session lookup failed")
      mockPrisma.aiChatSession.findUnique.mockRejectedValueOnce(dbError)

      await expect(
        processWhatsappAiBotInbound({
          organizationId: "org_1",
          deviceId: "dev_1",
          contactPhone: "+62812345678",
          inboundMessageText: "Halo admin toko",
          conversationId: "conv_1",
          inboundMessageId: "msg_crash_1",
        })
      ).rejects.toThrow("session lookup failed")

      expect(mockReleaseProcessingClaim).toHaveBeenCalledWith(
        "wa:bot-reply:processing:msg_crash_1"
      )
      expect(mockMarkClaimDone).not.toHaveBeenCalled()
      expect(mockMessageService.sendMessage).not.toHaveBeenCalled()
      expect(mockRedis.eval).toHaveBeenCalled() // session lock still released
    }
  )

  it("retry after a released claim sends exactly one reply", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValue({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        systemPrompt: "Anda adalah CS toko.",
        maxCharLength: 500,
        dailyUserLimit: 20,
      },
    } as never)

    // First attempt crashes before any outcome is delivered.
    const dbError = new Error("session lookup failed")
    mockPrisma.aiChatSession.findUnique.mockRejectedValueOnce(dbError)

    await expect(
      processWhatsappAiBotInbound({
        organizationId: "org_1",
        deviceId: "dev_1",
        contactPhone: "+62812345678",
        inboundMessageText: "Halo admin toko",
        conversationId: "conv_1",
        inboundMessageId: "msg_retry_after_release_1",
      })
    ).rejects.toThrow("session lookup failed")

    expect(mockMessageService.sendMessage).not.toHaveBeenCalled()
    expect(mockReleaseProcessingClaim).toHaveBeenCalledWith(
      "wa:bot-reply:processing:msg_retry_after_release_1"
    )

    // BullMQ retry: same inboundMessageId, session lookup now succeeds and
    // the processing claim can be re-acquired since it was released.
    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      sessionId: "wa_conv_1",
      totalMessages: 0,
    } as never)

    const retryRes = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_retry_after_release_1",
    })

    expect(retryRes.handled).toBe(true)
    expect(mockMessageService.sendMessage).toHaveBeenCalledTimes(1)
    expect(mockMarkClaimDone).toHaveBeenCalledWith(
      "wa:bot-reply:done:msg_retry_after_release_1",
      expect.any(Number)
    )
  })

  it("sends fallbackMessage and tags the outcome as a timeout when generateText aborts", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        systemPrompt: "Anda adalah CS toko.",
        maxCharLength: 500,
        dailyUserLimit: 20,
        fallbackMessage: "Mohon coba lagi beberapa saat lagi.",
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      sessionId: "wa_conv_1",
      totalMessages: 0,
    } as never)

    mockGenerateText.mockRejectedValueOnce(
      Object.assign(new Error("timed out"), { name: "TimeoutError" })
    )

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_timeout_1",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("TIMEOUT")
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 60000 })
    )
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Mohon coba lagi beberapa saat lagi.",
      })
    )
    expect(mockLogStageFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        agentProfileId: "agent_1",
        channel: "WHATSAPP",
        stage: "GENERATION",
      })
    )
  })

  it("logs ai_bot.stage_failed and attempts a fallback send when the main reply send throws", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        systemPrompt: "Anda adalah CS toko.",
        maxCharLength: 500,
        dailyUserLimit: 20,
        fallbackMessage: "Mohon coba lagi nanti.",
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      sessionId: "wa_conv_1",
      totalMessages: 0,
    } as never)

    mockMessageService.sendMessage.mockRejectedValueOnce(
      new Error("WhatsApp API returned 500")
    )

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_send_fail_1",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("SEND_FAILED")
    expect(mockLogStageFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        agentProfileId: "agent_1",
        channel: "WHATSAPP",
        stage: "SEND",
      })
    )
    expect(mockMessageService.sendMessage).toHaveBeenCalledTimes(2)
    expect(mockMessageService.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: "Mohon coba lagi nanti.",
      })
    )
  })

  it("does not throw when both the reply send and the fallback send fail", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        systemPrompt: "Anda adalah CS toko.",
        maxCharLength: 500,
        dailyUserLimit: 20,
        fallbackMessage: "Mohon coba lagi nanti.",
      },
    } as never)

    mockPrisma.aiChatSession.findUnique.mockResolvedValueOnce({
      id: "sess_1",
      sessionId: "wa_conv_1",
      totalMessages: 0,
    } as never)

    mockMessageService.sendMessage.mockRejectedValue(
      new Error("WhatsApp API is down")
    )

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812345678",
      inboundMessageText: "Halo admin toko",
      conversationId: "conv_1",
      inboundMessageId: "msg_send_fail_2",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("SEND_FAILED")
    expect(mockLogStageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "SEND" })
    )
    expect(mockLogStageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "SEND_FALLBACK" })
    )
  })

  it(
    "sends the refusal and escalates to a PHONE-only, org-scoped ban " +
      "after threshold strikes from the same customerPhone",
    async () => {
      mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
        id: "bind_1",
        isActive: true,
        agentProfile: {
          id: "agent_1",
          isActive: true,
          maxCharLength: 500,
          customBlockedWords: [],
          strikeEscalation: true,
          fallbackMessage: "Mohon gunakan bahasa yang sopan.",
        },
      } as never)

      mockInspectAgentPromptSafety.mockReturnValueOnce({
        ok: false,
        reason: "PROFANITY",
        refusalMessage: "Mohon sampaikan pertanyaan dengan bahasa yang sopan.",
      } as never)

      const res = await processWhatsappAiBotInbound({
        organizationId: "org_1",
        deviceId: "dev_1",
        contactPhone: "+62812000001",
        inboundMessageText: "kata kasar apapun",
        conversationId: "conv_strike_x",
        inboundMessageId: "msg_strike_x_1",
      })

      expect(res.handled).toBe(true)
      expect(res.reason).toBe("SAFETY_VIOLATION_PROFANITY")
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Mohon sampaikan pertanyaan dengan bahasa yang sopan.",
        })
      )
      expect(mockRecordSafetyViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org_1",
          customerPhone: "+62812000001",
          userId: null,
          ipAddress: null,
          reason: "PROFANITY",
          enableStrikeEscalation: true,
          banScope: "PHONE_ONLY",
        })
      )
      expect(mockGenerateText).not.toHaveBeenCalled()
    }
  )

  it("a second customerPhone in the same organization is unaffected after the first is banned", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        customBlockedWords: [],
        strikeEscalation: true,
      },
    } as never)
    mockInspectAgentPromptSafety.mockReturnValueOnce({
      ok: false,
      reason: "PROFANITY",
      refusalMessage: "Mohon sopan.",
    } as never)

    await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812000001",
      inboundMessageText: "kata kasar apapun",
      conversationId: "conv_strike_x",
      inboundMessageId: "msg_strike_x_2",
    })

    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        customBlockedWords: [],
        strikeEscalation: true,
      },
    } as never)

    const resY = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62899999999",
      inboundMessageText: "Halo, ada promo hari ini?",
      conversationId: "conv_strike_y",
      inboundMessageId: "msg_strike_y_1",
    })

    expect(resY.handled).toBe(true)
    expect(resY.reason).not.toBe("SAFETY_VIOLATION_PROFANITY")
    expect(mockRecordSafetyViolation).toHaveBeenCalledTimes(1)
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: "+62899999999" })
    )
  })

  it("does not record a strike when strikeEscalation is false", async () => {
    mockPrisma.aiChannelBinding.findFirst.mockResolvedValueOnce({
      id: "bind_1",
      isActive: true,
      agentProfile: {
        id: "agent_1",
        isActive: true,
        maxCharLength: 500,
        customBlockedWords: [],
        strikeEscalation: false,
        fallbackMessage: "Mohon gunakan bahasa yang sopan.",
      },
    } as never)

    mockInspectAgentPromptSafety.mockReturnValueOnce({
      ok: false,
      reason: "PROFANITY",
      refusalMessage: "Mohon gunakan bahasa yang sopan.",
    } as never)

    const res = await processWhatsappAiBotInbound({
      organizationId: "org_1",
      deviceId: "dev_1",
      contactPhone: "+62812000002",
      inboundMessageText: "kata kasar apapun",
      conversationId: "conv_strike_off",
      inboundMessageId: "msg_strike_off_1",
    })

    expect(res.handled).toBe(true)
    expect(res.reason).toBe("SAFETY_VIOLATION_PROFANITY")
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Mohon gunakan bahasa yang sopan.",
      })
    )
    expect(mockRecordSafetyViolation).toHaveBeenCalledWith(
      expect.objectContaining({ enableStrikeEscalation: false })
    )
  })
})
