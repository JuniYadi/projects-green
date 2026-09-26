import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const mockFindUniqueAgent = mock()
const mockCountInboundMessages = mock()
const mockGetOrCreateSession = mock()
const mockAcquireSessionLock = mock()
const mockReleaseSessionLock = mock()
const mockGetSlidingWindowMessages = mock()
const mockRecordMessage = mock()
const mockBuildAgentTools = mock()
const mockResolveAiProviderConfig = mock()
const mockCreateAiLanguageModel = mock()
const mockRecordSessionStrike = mock(async () => ({ isBlocked: true }))
const mockCreateBan = mock(async () => ({}))
const mockInspectAgentPromptSafety = mock(
  () =>
    ({ ok: true }) as {
      ok: boolean
      reason?: string
      refusalMessage?: string
    }
)

const mockPrisma = {
  aiAgentProfile: {
    findUnique: mockFindUniqueAgent,
  },
  aiChatMessage: {
    count: mockCountInboundMessages,
  },
  aiChatBan: {
    create: mockCreateBan,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/modules/docs/docs.guard", () => ({
  recordSessionStrike: mockRecordSessionStrike,
}))

// Mocked explicitly, not re-exported from the real module: bun test runs
// all files in one process, and another file's mock.module() for this same
// path (e.g. ai-bot-consumer.service.test.ts) would otherwise leak into
// this file's import of the route under test.
mock.module("@/modules/ai/agents/ai-agent-guardrails", () => ({
  inspectAgentPromptSafety: mockInspectAgentPromptSafety,
}))

mock.module("@/modules/ai/agents/ai-agent-session.service", () => ({
  acquireSessionLock: mockAcquireSessionLock,
  releaseSessionLock: mockReleaseSessionLock,
  getOrCreateSession: mockGetOrCreateSession,
  getSlidingWindowMessages: mockGetSlidingWindowMessages,
  recordMessage: mockRecordMessage,
}))

mock.module("@/modules/ai/agents/ai-agent-tools", () => ({
  buildAgentTools: mockBuildAgentTools,
}))

mock.module("@/modules/ai/ai-provider.factory", () => ({
  resolveAiProviderConfig: mockResolveAiProviderConfig,
  createAiLanguageModel: mockCreateAiLanguageModel,
}))

const mockLogStageFailure = mock(() => {})
mock.module("@/lib/logger", () => ({
  logger: {
    warn: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
  logStageFailure: mockLogStageFailure,
}))

const { Elysia } = await import("elysia")
const { createPublicAiWidgetRoutes } = await import("./widget-stream.route")

describe("widget-stream.route", () => {
  let app: { handle: (request: Request) => Promise<Response> }

  beforeEach(() => {
    mockFindUniqueAgent.mockReset()
    mockCountInboundMessages.mockReset()
    mockGetOrCreateSession.mockReset()
    mockAcquireSessionLock.mockReset()
    mockReleaseSessionLock.mockReset()
    mockGetSlidingWindowMessages.mockReset()
    mockRecordMessage.mockReset()
    mockBuildAgentTools.mockReset()
    mockResolveAiProviderConfig.mockReset()
    mockCreateAiLanguageModel.mockReset()
    mockRecordSessionStrike.mockReset()
    mockCreateBan.mockReset()
    mockInspectAgentPromptSafety.mockReset()

    mockRecordSessionStrike.mockResolvedValue({ isBlocked: true })
    mockInspectAgentPromptSafety.mockReturnValue({ ok: true })
    mockCountInboundMessages.mockResolvedValue(0)
    mockGetSlidingWindowMessages.mockResolvedValue([])
    mockBuildAgentTools.mockResolvedValue({})
    mockResolveAiProviderConfig.mockResolvedValue({
      providerType: "MANAGED",
      defaultModel: "mock-model",
      apiKey: "test-key",
      baseUrl: "https://api.test",
    })
    mockCreateAiLanguageModel.mockReturnValue({} as never)
    mockAcquireSessionLock.mockResolvedValue("lock-token-123")
    mockReleaseSessionLock.mockResolvedValue(true)
    mockRecordMessage.mockResolvedValue({ id: "msg-1" })
    mockLogStageFailure.mockClear()

    app = new Elysia().use(
      createPublicAiWidgetRoutes({
        streamTextFn: (async () => {
          return {
            fullStream: (async function* () {
              yield { type: "text-delta", text: "Halo " }
              yield { type: "text-delta", text: "dunia!" }
            })(),
          }
        }) as never,
      })
    )
  })

  it("should return 400 when body is not valid JSON", async () => {
    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json-text",
      })
    )
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe("VALIDATION_ERROR")
  })

  it("should handle error during text streaming gracefully", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })

    const errorApp = new Elysia().use(
      createPublicAiWidgetRoutes({
        // The real streamText never throws; failures arrive as stream parts.
        streamTextFn: (() => ({
          fullStream: (async function* () {
            yield {
              type: "error",
              error: new Error("AI provider quota exceeded"),
            }
          })(),
        })) as never,
      })
    )

    const res = await errorApp.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Halo",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain('"error"')
    expect(text).toContain(
      'data: {"chunk":"Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."}'
    )
    expect(text).toContain("data: [DONE]")
    expect(mockReleaseSessionLock).toHaveBeenCalledWith(
      "widget_agent-1_vis-1",
      "lock-token-123"
    )
    expect(mockLogStageFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        agentProfileId: "agent-1",
        channel: "WEB_LIVECHAT",
        stage: "GENERATION",
      })
    )
  })

  it("emits fallbackMessage as a normal chunk and releases the lock when runStreamText times out", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      fallbackMessage: "Mohon tunggu, agen kami akan membantu Anda.",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })

    let receivedTimeout: unknown
    const timeoutApp = new Elysia().use(
      createPublicAiWidgetRoutes({
        streamTextFn: ((options: { timeout?: unknown }) => {
          receivedTimeout = options.timeout
          return {
            fullStream: (async function* () {
              yield { type: "abort", reason: "timed out" }
            })(),
          }
        }) as never,
      })
    )

    const res = await timeoutApp.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Halo",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain('"error"')
    expect(text).toContain(
      'data: {"chunk":"Mohon tunggu, agen kami akan membantu Anda."}'
    )
    expect(text).toContain("data: [DONE]")
    expect(receivedTimeout).toBe(60000)
    expect(mockReleaseSessionLock).toHaveBeenCalledWith(
      "widget_agent-1_vis-1",
      "lock-token-123"
    )
  })

  it("replaces partial text with the fallback when the stream fails mid-answer", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      fallbackMessage: "Maaf, coba lagi nanti.",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })
    const partialApp = new Elysia().use(
      createPublicAiWidgetRoutes({
        streamTextFn: (() => ({
          fullStream: (async function* () {
            yield { type: "text-delta", text: "Setengah jaw" }
            yield { type: "error", error: new Error("connection reset") }
          })(),
        })) as never,
      })
    )

    const text = await (
      await partialApp.handle(
        new Request("http://localhost/ai/widget/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent-1",
            message: "Halo",
            visitorId: "vis-1",
          }),
        })
      )
    ).text()

    expect(text).toContain('data: {"replace":"Maaf, coba lagi nanti."}')
    expect(text).not.toContain('{"chunk":"Maaf, coba lagi nanti."}')
    expect(text.match(/data: \[DONE\]/g)).toHaveLength(1)
  })

  it("streams the fallback when the model returns no text", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })
    const emptyApp = new Elysia().use(
      createPublicAiWidgetRoutes({
        streamTextFn: (() => ({
          fullStream: (async function* () {
            yield { type: "finish" }
          })(),
        })) as never,
      })
    )

    const text = await (
      await emptyApp.handle(
        new Request("http://localhost/ai/widget/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent-1",
            message: "Halo",
            visitorId: "vis-1",
          }),
        })
      )
    ).text()

    expect(text).toContain(
      'data: {"chunk":"Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."}'
    )
    expect(text.match(/data: \[DONE\]/g)).toHaveLength(1)
  })

  it("should return 422 when missing required body fields", async () => {
    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent-1" }),
      })
    )
    expect(res.status).toBe(422)
  })

  it("should return 404 when agent profile not found", async () => {
    mockFindUniqueAgent.mockResolvedValue(null)

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-not-found",
          message: "Halo",
          visitorId: "vis-1",
        }),
      })
    )
    expect(res.status).toBe(404)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe("AGENT_NOT_FOUND")
  })

  it("should return 403 when origin is not allowed", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: ["toko.co.id"],
      organizationId: "org-1",
    })

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-origin": "https://unauthorized.com",
        },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Halo",
          visitorId: "vis-1",
        }),
      })
    )
    expect(res.status).toBe(403)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe("ORIGIN_NOT_ALLOWED")
  })

  it("should stream SSE chunks and finish with [DONE] when valid", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: ["toko.co.id"],
      organizationId: "org-1",
      systemPrompt: "System prompt",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-origin": "https://toko.co.id",
        },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Ada promo?",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/event-stream")

    const text = await res.text()
    expect(text).toContain('data: {"chunk":"Halo "}')
    expect(text).toContain('data: {"chunk":"dunia!"}')
    expect(text).toContain("data: [DONE]")

    expect(mockRecordMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "widget_agent-1_vis-1",
        role: "user",
        content: "Ada promo?",
      })
    )

    expect(mockRecordMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "widget_agent-1_vis-1",
        role: "assistant",
        content: "Halo dunia!",
      })
    )

    expect(mockReleaseSessionLock).toHaveBeenCalledWith(
      "widget_agent-1_vis-1",
      "lock-token-123"
    )
  })

  it("returns 422 MAX_CHAR_EXCEEDED without calling the model", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      maxCharLength: 5,
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
      totalMessages: 0,
    })

    const streamTextFn = mock(() => {
      throw new Error("model should not be called")
    })
    const guardApp = new Elysia().use(
      createPublicAiWidgetRoutes({ streamTextFn: streamTextFn as never })
    )

    const res = await guardApp.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Pesan ini kepanjangan",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(422)
    const json = (await res.json()) as { error: string; message?: string }
    expect(json.error).toBe("MAX_CHAR_EXCEEDED")
    expect(json.message).toBeUndefined()
    expect(streamTextFn).not.toHaveBeenCalled()
    expect(mockReleaseSessionLock).toHaveBeenCalledWith(
      "widget_agent-1_vis-1",
      "lock-token-123"
    )
  })

  it("returns 422 BLOCKED_WORD_TRIGGERED with fallbackMessage", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      enableProfanityFilter: true,
      customBlockedWords: ["kasar"],
      fallbackMessage: "Mohon gunakan bahasa yang sopan.",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
      totalMessages: 0,
    })

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Dasar kata kasar kamu!",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(422)
    const json = (await res.json()) as { error: string; message?: string }
    expect(json.error).toBe("BLOCKED_WORD_TRIGGERED")
    expect(json.message).toBe("Mohon gunakan bahasa yang sopan.")
    expect(mockReleaseSessionLock).toHaveBeenCalledWith(
      "widget_agent-1_vis-1",
      "lock-token-123"
    )
  })

  it("returns 429 DAILY_LIMIT_REACHED and releases the lock", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      dailyUserLimit: 1,
      fallbackMessage: "Batas chat harian Anda telah habis.",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })
    mockCountInboundMessages.mockResolvedValue(1)

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Halo lagi",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: string; message?: string }
    expect(json.error).toBe("DAILY_LIMIT_REACHED")
    expect(json.message).toBe("Batas chat harian Anda telah habis.")
    expect(mockCountInboundMessages).toHaveBeenCalledWith({
      where: {
        sessionId: "widget_agent-1_vis-1",
        role: "user",
        createdAt: { gte: expect.any(Date) },
      },
    })
    expect(mockReleaseSessionLock).toHaveBeenCalledWith(
      "widget_agent-1_vis-1",
      "lock-token-123"
    )
  })

  it(
    "allows N user messages with assistant replies in between, " +
      "without blocking early",
    async () => {
      mockFindUniqueAgent.mockResolvedValue({
        id: "agent-1",
        isActive: true,
        allowedDomains: [],
        organizationId: "org-1",
        dailyUserLimit: 2,
        fallbackMessage: "Batas chat harian Anda telah habis.",
      })
      mockGetOrCreateSession.mockResolvedValue({
        id: "sess-db-1",
        sessionId: "widget_agent-1_vis-1",
      })

      // 1st user message: 0 prior user rows recorded yet, even though an
      // assistant reply may already exist from a previous exchange — the
      // count only ever reflects role="user" rows.
      mockCountInboundMessages.mockResolvedValueOnce(0)
      const first = await app.handle(
        new Request("http://localhost/ai/widget/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent-1",
            message: "Pesan pertama",
            visitorId: "vis-1",
          }),
        })
      )
      expect(first.status).toBe(200)

      // 2nd user message: 1 prior user row (the assistant reply to the
      // first message does not count towards the limit).
      mockCountInboundMessages.mockResolvedValueOnce(1)
      const second = await app.handle(
        new Request("http://localhost/ai/widget/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent-1",
            message: "Pesan kedua",
            visitorId: "vis-1",
          }),
        })
      )
      expect(second.status).toBe(200)
    }
  )

  it("blocks the (N+1)th user message once the limit is reached", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      dailyUserLimit: 2,
      fallbackMessage: "Batas chat harian Anda telah habis.",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })

    // 2 prior user rows already recorded — the 3rd user message must be
    // blocked even though totalMessages (user + assistant rows) would be 4.
    mockCountInboundMessages.mockResolvedValue(2)

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Pesan ketiga",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: string; message?: string }
    expect(json.error).toBe("DAILY_LIMIT_REACHED")
    expect(mockReleaseSessionLock).toHaveBeenCalledWith(
      "widget_agent-1_vis-1",
      "lock-token-123"
    )
  })

  it("returns 403 CUSTOMER_BLOCKED before streaming when the session isBlocked", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      fallbackMessage: "Mohon tunggu, agen kami akan membantu Anda.",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
      isBlocked: true,
    })

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Halo",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(403)
    const json = (await res.json()) as { error: string; message?: string }
    expect(json.error).toBe("CUSTOMER_BLOCKED")
    expect(json.message).toBe("Mohon tunggu, agen kami akan membantu Anda.")
    expect(mockAcquireSessionLock).not.toHaveBeenCalled()
  })

  it(
    "streams the refusal as a normal chunk and sets isBlocked on that " +
      "session only when strikeEscalation is true",
    async () => {
      mockFindUniqueAgent.mockResolvedValue({
        id: "agent-1",
        isActive: true,
        allowedDomains: [],
        organizationId: "org-1",
        strikeEscalation: true,
      })
      mockGetOrCreateSession.mockResolvedValue({
        id: "sess-db-1",
        sessionId: "widget_agent-1_vis-1",
      })
      mockInspectAgentPromptSafety.mockReturnValue({
        ok: false,
        reason: "PROFANITY",
        refusalMessage: "Mohon sampaikan pertanyaan dengan bahasa yang sopan.",
      })

      const streamTextFn = mock(() => {
        throw new Error("model should not be called")
      })
      const violationApp = new Elysia().use(
        createPublicAiWidgetRoutes({ streamTextFn: streamTextFn as never })
      )

      const res = await violationApp.handle(
        new Request("http://localhost/ai/widget/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent-1",
            message: "Dasar bot goblok banget sih",
            visitorId: "vis-1",
          }),
        })
      )

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).not.toContain('"error"')
      expect(text).toContain('data: {"chunk":')
      expect(text).toContain("data: [DONE]")
      expect(streamTextFn).not.toHaveBeenCalled()
      expect(mockRecordMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "widget_agent-1_vis-1",
          role: "assistant",
        })
      )
      // Flagged like WhatsApp's recordSafetyViolation (AC-09 parity)
      expect(mockRecordMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "user",
          isFlagged: true,
          flagReason: "PROFANITY",
        })
      )
      expect(mockRecordSessionStrike).toHaveBeenCalledWith(
        "widget_agent-1_vis-1",
        "PROFANITY"
      )
      expect(mockReleaseSessionLock).toHaveBeenCalledWith(
        "widget_agent-1_vis-1",
        "lock-token-123"
      )
    }
  )

  it("never creates an AiChatBan row on a widget violation", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      strikeEscalation: true,
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })
    mockInspectAgentPromptSafety.mockReturnValue({
      ok: false,
      reason: "PROFANITY",
      refusalMessage: "Mohon sampaikan pertanyaan dengan bahasa yang sopan.",
    })

    const streamTextFn = mock(() => {
      throw new Error("model should not be called")
    })
    const violationApp = new Elysia().use(
      createPublicAiWidgetRoutes({ streamTextFn: streamTextFn as never })
    )

    await violationApp.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Dasar bot goblok banget sih",
          visitorId: "vis-1",
        }),
      })
    )

    expect(mockRecordSessionStrike).toHaveBeenCalled()
    expect(mockCreateBan).not.toHaveBeenCalled()
  })

  it("should return 429 if concurrency lock acquisition fails", async () => {
    mockFindUniqueAgent.mockResolvedValue({
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
    })
    mockGetOrCreateSession.mockResolvedValue({
      id: "sess-db-1",
      sessionId: "widget_agent-1_vis-1",
    })
    mockAcquireSessionLock.mockResolvedValue(null)

    const res = await app.handle(
      new Request("http://localhost/ai/widget/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          message: "Halo",
          visitorId: "vis-1",
        }),
      })
    )

    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe("CONCURRENT_REQUEST")
  })

  describe("failure isolation (PR #934 review)", () => {
    const agent = {
      id: "agent-1",
      isActive: true,
      allowedDomains: [],
      organizationId: "org-1",
      fallbackMessage: "Maaf, coba lagi nanti.",
    }
    const post = () =>
      app.handle(
        new Request("http://localhost/ai/widget/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent-1",
            message: "Halo",
            visitorId: "vis-1",
          }),
        })
      )

    beforeEach(() => {
      mockFindUniqueAgent.mockResolvedValue(agent)
      mockGetOrCreateSession.mockResolvedValue({
        id: "sess-db-1",
        sessionId: "widget_agent-1_vis-1",
      })
    })

    it("a failed assistant persist after [DONE] sends no second reply", async () => {
      mockRecordMessage.mockImplementation(async (args: { role: string }) => {
        if (args.role === "assistant") throw new Error("db down")
        return { id: "msg-1" }
      })

      const text = await (await post()).text()

      expect(text).toContain('data: {"chunk":"Halo "}')
      expect(text).toContain('data: {"chunk":"dunia!"}')
      expect(text.match(/data: \[DONE\]/g)).toHaveLength(1)
      expect(text).not.toContain(agent.fallbackMessage)
      expect(mockLogStageFailure).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "PERSIST_REPLY" })
      )
      expect(mockReleaseSessionLock).toHaveBeenCalledWith(
        "widget_agent-1_vis-1",
        "lock-token-123"
      )
    })

    it("a provider resolution failure streams the fallback and releases the lock", async () => {
      mockResolveAiProviderConfig.mockRejectedValue(new Error("no provider"))
      const streamFn = mock()
      const failApp = new Elysia().use(
        createPublicAiWidgetRoutes({ streamTextFn: streamFn as never })
      )

      const res = await failApp.handle(
        new Request("http://localhost/ai/widget/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent-1",
            message: "Halo",
            visitorId: "vis-1",
          }),
        })
      )

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain(`data: {"chunk":"${agent.fallbackMessage}"}`)
      expect(text).toContain("data: [DONE]")
      expect(streamFn).not.toHaveBeenCalled()
      expect(mockLogStageFailure).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "PROVIDER_RESOLUTION" })
      )
      expect(mockReleaseSessionLock).toHaveBeenCalledWith(
        "widget_agent-1_vis-1",
        "lock-token-123"
      )
    })

    it("a daily-limit count failure streams the fallback and releases the lock", async () => {
      mockCountInboundMessages.mockRejectedValue(new Error("db down"))

      const res = await post()

      expect(res.status).toBe(200)
      expect(await res.text()).toContain(agent.fallbackMessage)
      expect(mockLogStageFailure).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "DAILY_LIMIT_COUNT" })
      )
      expect(mockReleaseSessionLock).toHaveBeenCalledWith(
        "widget_agent-1_vis-1",
        "lock-token-123"
      )
    })

    it("passes the agent's enableProfanityFilter to the safety inspector", async () => {
      mockFindUniqueAgent.mockResolvedValue({
        ...agent,
        enableProfanityFilter: false,
      })

      await (await post()).text()

      expect(mockInspectAgentPromptSafety).toHaveBeenCalledWith(
        "Halo",
        expect.objectContaining({ enableProfanityFilter: false })
      )
    })

    it("a context load failure streams the fallback and releases the lock", async () => {
      mockGetSlidingWindowMessages.mockRejectedValue(new Error("db down"))

      const res = await post()

      expect(res.status).toBe(200)
      expect(await res.text()).toContain(agent.fallbackMessage)
      expect(mockLogStageFailure).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "CONTEXT_LOAD" })
      )
      expect(mockReleaseSessionLock).toHaveBeenCalled()
    })
  })
})
