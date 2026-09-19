import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const mockFindUniqueAgent = mock()
const mockGetOrCreateSession = mock()
const mockAcquireSessionLock = mock()
const mockReleaseSessionLock = mock()
const mockGetSlidingWindowMessages = mock()
const mockRecordMessage = mock()
const mockBuildAgentTools = mock()
const mockResolveAiProviderConfig = mock()
const mockCreateAiLanguageModel = mock()

const mockPrisma = {
  aiAgentProfile: {
    findUnique: mockFindUniqueAgent,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
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

const { Elysia } = await import("elysia")
const { createPublicAiWidgetRoutes } = await import("./widget-stream.route")

describe("widget-stream.route", () => {
  let app: { handle: (request: Request) => Promise<Response> }

  beforeEach(() => {
    mockFindUniqueAgent.mockReset()
    mockGetOrCreateSession.mockReset()
    mockAcquireSessionLock.mockReset()
    mockReleaseSessionLock.mockReset()
    mockGetSlidingWindowMessages.mockReset()
    mockRecordMessage.mockReset()
    mockBuildAgentTools.mockReset()
    mockResolveAiProviderConfig.mockReset()
    mockCreateAiLanguageModel.mockReset()

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

    app = new Elysia().use(
      createPublicAiWidgetRoutes({
        streamTextFn: (async () => {
          return {
            textStream: (async function* () {
              yield "Halo "
              yield "dunia!"
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
        streamTextFn: (() => {
          throw new Error("AI provider quota exceeded")
        }) as never,
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
    expect(text).toContain("AI provider quota exceeded")
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
})
