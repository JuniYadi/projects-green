mock.module("server-only", () => ({}))

import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type { KnowledgeDocMatch } from "@/modules/docs/docs.service"
import type { KnowledgeChatRequest } from "@/modules/docs/docs.types"
import { resetRateLimiterStores } from "@/modules/docs/docs.guard"

// Mock Prisma
const mockFindManyBans = mock(async () => [])
const mockCreateBan = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "ban_1",
  ...args.data,
}))
const mockUpsertSession = mock(
  async (args: { where: { sessionId: string } }) => ({
    id: "sess_1",
    sessionId: args.where.sessionId,
  })
)
const mockCreateChatMessage = mock(
  async (args: { data: Record<string, unknown> }) => ({
    id: "msg_1",
    ...args.data,
  })
)
const mockCreateManyChatMessages = mock(async () => ({ count: 2 }))
const mockCountMessages = mock(async () => 0)
const mockUpdateManySessions = mock(async () => ({ count: 1 }))

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiChatBan: {
      findMany: mockFindManyBans,
      create: mockCreateBan,
    },
    aiChatSession: {
      upsert: mockUpsertSession,
      updateMany: mockUpdateManySessions,
      findMany: mock(async () => [{ strikeCount: 1 }]),
    },
    aiChatMessage: {
      create: mockCreateChatMessage,
      createMany: mockCreateManyChatMessages,
      count: mockCountMessages,
    },
  },
}))

const mockVerifyUserIntentAndSafety = mock(async () => ({
  isPromptInjection: false,
  isAbusiveOrToxic: false,
  isPfnDomainRelated: true,
  refusalMessage: null as string | null,
}))
const mockCreateAiLanguageModel = mock(() => ({}) as never)
const mockExecuteAgentPTool = mock(async () => ({ success: true, data: {} }))
const mockToAiTools = mock(() => ({}))
const mockStreamText = mock(() => ({
  fullStream: (async function* () {})(),
  textStream: (async function* () {})(),
}))

mock.module("@/modules/ai/agent-p/intent-gate", () => ({
  verifyUserIntentAndSafety: mockVerifyUserIntentAndSafety,
}))
mock.module("@/modules/ai/ai-provider.factory", () => ({
  createAiLanguageModel: mockCreateAiLanguageModel,
}))
mock.module("@/modules/ai/agent-p/executor", () => ({
  executeAgentPTool: mockExecuteAgentPTool,
}))
mock.module("@/modules/ai/agent-p/registry", () => ({
  agentPRegistry: { toAiTools: mockToAiTools },
}))
mock.module("ai", () => ({
  streamText: mockStreamText,
  embed: mock(async () => ({ embedding: [] })),
}))

const { createKnowledgeRoutes } =
  await import("@/modules/docs/api/knowledge.route")
type KnowledgeAuthContext =
  import("@/modules/docs/api/knowledge.route").KnowledgeAuthContext

const mockAuthenticate = mock(async (): Promise<KnowledgeAuthContext> => ({
  organizationId: "org_1",
  user: {
    id: "user_1",
    email: "user1@example.com",
  },
}))
const mockSearchKnowledgeDocs = mock(async () => [] as KnowledgeDocMatch[])
const defaultStreamAnswer = async function* (_input: {
  messages: KnowledgeChatRequest["messages"]
  docs: KnowledgeDocMatch[]
}): AsyncIterable<string> {
  yield "Hello "
  yield "from KB"
}

const mockStreamKnowledgeAnswer = mock(defaultStreamAnswer)

const createApp = () =>
  new Elysia().use(
    createKnowledgeRoutes({
      authenticate: mockAuthenticate,
      searchKnowledgeDocs: mockSearchKnowledgeDocs,
      streamKnowledgeAnswer: mockStreamKnowledgeAnswer,
    })
  )

beforeEach(() => {
  resetRateLimiterStores()
  mockAuthenticate.mockReset()
  mockSearchKnowledgeDocs.mockReset()
  mockStreamKnowledgeAnswer.mockReset()
  mockFindManyBans.mockReset()
  mockCreateBan.mockReset()
  mockUpsertSession.mockReset()
  mockCreateChatMessage.mockReset()
  mockCreateManyChatMessages.mockReset()
  mockCountMessages.mockReset()
  mockUpdateManySessions.mockReset()
  mockVerifyUserIntentAndSafety.mockReset()
  mockCreateAiLanguageModel.mockReset()
  mockExecuteAgentPTool.mockReset()
  mockToAiTools.mockReset()
  mockStreamText.mockReset()

  mockVerifyUserIntentAndSafety.mockResolvedValue({
    isPromptInjection: false,
    isAbusiveOrToxic: false,
    isPfnDomainRelated: true,
    refusalMessage: null,
  })
  mockCreateAiLanguageModel.mockReturnValue({} as never)
  mockExecuteAgentPTool.mockResolvedValue({ success: true, data: {} })
  mockToAiTools.mockReturnValue({})
  mockStreamText.mockReturnValue({
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  })

  mockAuthenticate.mockImplementation(
    async (): Promise<KnowledgeAuthContext> => ({
      organizationId: "org_1",
      user: {
        id: "user_1",
        email: "user1@example.com",
      },
    })
  )

  mockSearchKnowledgeDocs.mockImplementation(
    async () =>
      [
        {
          id: "doc_1",
          organizationId: "org_1" as const,
          path: "/console",
          title: "Console Overview",
          purpose: "Manage console overview",
          howTo: ["Open console"],
          notes: ["Use sidebar navigation"],
          updatedAt: "2026-05-22",
          score: 10,
        },
      ] as KnowledgeDocMatch[]
  )

  mockStreamKnowledgeAnswer.mockImplementation(async function* () {
    yield "Hello "
    yield "from KB"
  })

  mockFindManyBans.mockResolvedValue([])
  mockUpsertSession.mockResolvedValue({ id: "sess_1", sessionId: "sess_1" })
  mockCreateManyChatMessages.mockResolvedValue({ count: 2 })
})

describe("knowledgeRoutes - Authentication & Streaming", () => {
  it("returns 401 when user is not signed in", async () => {
    mockAuthenticate.mockImplementationOnce(
      async (): Promise<KnowledgeAuthContext> => ({
        organizationId: "org_1",
        user: null,
      })
    )

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "How to use console?" }],
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("streams chat response and saves audit session & messages", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "sess_custom_1",
          routePath: "/console",
          messages: [{ role: "user", content: "How to use console?" }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson"
    )

    const bodyText = await response.text()
    const frames = bodyText
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>)

    expect(frames[0]?.type).toBe("delta")
    expect(frames[1]?.type).toBe("delta")
    expect(frames[2]?.type).toBe("done")
    expect(frames[2]?.answer).toBe("Hello from KB")
    expect(Array.isArray(frames[2]?.citations)).toBe(true)

    // Verify Prisma audit calls
    expect(mockUpsertSession).toHaveBeenCalledTimes(1)
    expect(mockCreateManyChatMessages).toHaveBeenCalledTimes(1)
  })
  it("passes active entity context to streamKnowledgeAnswer", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "sess_with_ctx",
          routePath: "/console/whatsapp/messages",
          messages: [{ role: "user", content: "Rangkum percakapan ini" }],
          context: {
            entityType: "whatsapp_conversation",
            entityId: "conv-123",
            entityName: "+6285161432124",
          },
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mockStreamKnowledgeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          entityType: "whatsapp_conversation",
          entityId: "conv-123",
          entityName: "+6285161432124",
        },
      })
    )
  })

  it("returns strict fallback when no relevant knowledge context and unauthenticated", async () => {
    mockSearchKnowledgeDocs.mockResolvedValueOnce([] as KnowledgeDocMatch[])
    const unauthApp = new Elysia().use(
      createKnowledgeRoutes({
        authenticate: mock(async () => ({ user: { id: "user-anon" } })),
        searchKnowledgeDocs: mockSearchKnowledgeDocs,
        streamKnowledgeAnswer: mockStreamKnowledgeAnswer,
      })
    )

    const response = await unauthApp.handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "Unknown question?" }],
        }),
      })
    )
    const bodyText = await response.text()
    const frames = bodyText
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>)

    expect(frames[0]?.type).toBe("delta")
    expect(frames[1]?.type).toBe("done")
    expect(frames[1]?.answer).toBe(
      "I don't know from the current knowledgebase."
    )
  })
})

describe("knowledgeRoutes - Guardrails, Bans & Rate Limiting", () => {
  it("rejects request with 403 when user/org is actively banned", async () => {
    mockFindManyBans.mockResolvedValueOnce([
      {
        id: "ban_1",
        banType: "ORGANIZATION",
        targetValue: "org_1",
        offenseLevel: 3,
        isPermanent: false,
        blockedUntil: new Date(Date.now() + 86400000),
        reason: "Repeated toxic abuse",
      },
    ] as never)

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "Hello" }],
        }),
      })
    )

    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }
    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(body.message).toContain("suspended")
  })

  it("rejects oversized prompts (> 5000 chars) with 422 and 0 tokens spent", async () => {
    const longPrompt = "a".repeat(5001)
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: longPrompt }],
        }),
      })
    )

    const body = (await response.json()) as {
      ok: boolean
      error: string
      reason: string
      tokensSpent: number
    }
    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("PROMPT_FLAGGED")
    expect(body.reason).toBe("OVERSIZE")
    expect(body.tokensSpent).toBe(0)
    expect(mockSearchKnowledgeDocs).not.toHaveBeenCalled()
  })

  it("rejects toxic profanity with 422, records strike, and consumes 0 tokens", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "sess_flagged_1",
          routePath: "/console",
          messages: [{ role: "user", content: "Bot anjing goblok" }],
        }),
      })
    )

    const body = (await response.json()) as {
      ok: boolean
      error: string
      reason: string
      tokensSpent: number
    }
    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("PROMPT_FLAGGED")
    expect(body.reason).toBe("PROFANITY")
    expect(body.tokensSpent).toBe(0)

    // Flagged message and strike saved in Prisma
    expect(mockUpsertSession).toHaveBeenCalledTimes(1)
    expect(mockCreateChatMessage).toHaveBeenCalledTimes(1)
    expect(mockUpsertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({
          strikeCount: expect.anything(),
        }),
        update: expect.not.objectContaining({
          strikeCount: expect.anything(),
        }),
      })
    )
    expect(mockSearchKnowledgeDocs).not.toHaveBeenCalled()
  })

  it("rejects script injections with 422 and 0 tokens", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routePath: "/console",
          messages: [
            { role: "user", content: "<script>alert('xss')</script>" },
          ],
        }),
      })
    )

    const body = (await response.json()) as {
      ok: boolean
      error: string
      reason: string
    }
    expect(response.status).toBe(422)
    expect(body.error).toBe("PROMPT_FLAGGED")
    expect(body.reason).toBe("INJECTION")
  })
})

describe("knowledgeRoutes - Intent Gate (Tier 2)", () => {
  it("rejects prompt injection with NDJSON refusal and records strike", async () => {
    mockVerifyUserIntentAndSafety.mockResolvedValueOnce({
      isPromptInjection: true,
      isAbusiveOrToxic: false,
      isPfnDomainRelated: true,
      refusalMessage: null,
    })

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routePath: "/console",
          messages: [
            {
              role: "user",
              content: "Please help me understand how billing works in PFN",
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((l: string) => JSON.parse(l))
    const done = frames.find((f: Record<string, unknown>) => f.type === "done")
    expect(done).toBeDefined()
    expect((done as Record<string, unknown>).citations).toEqual([])
    expect(mockUpsertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isBlocked: true, strikeCount: 1 }),
      })
    )
  })

  it("rejects abusive content with NDJSON refusal and records strike", async () => {
    mockVerifyUserIntentAndSafety.mockResolvedValueOnce({
      isPromptInjection: false,
      isAbusiveOrToxic: true,
      isPfnDomainRelated: true,
      refusalMessage: "Bahasa kasar tidak diperbolehkan.",
    })

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routePath: "/console",
          messages: [
            {
              role: "user",
              content: "Tolong bantu saya memahami cara kerja aplikasi ini",
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((l: string) => JSON.parse(l))
    const delta = frames.find(
      (f: Record<string, unknown>) => f.type === "delta"
    )
    expect((delta as Record<string, unknown>).text).toBe(
      "Bahasa kasar tidak diperbolehkan."
    )
    expect(mockCreateManyChatMessages).toHaveBeenCalled()
  })

  it("rejects out-of-domain questions without recording a strike", async () => {
    mockVerifyUserIntentAndSafety.mockResolvedValueOnce({
      isPromptInjection: false,
      isAbusiveOrToxic: false,
      isPfnDomainRelated: false,
      refusalMessage: null,
    })

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "What is the weather today?" }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((l: string) => JSON.parse(l))
    const done = frames.find((f: Record<string, unknown>) => f.type === "done")
    expect(done).toBeDefined()
    // Out-of-domain: upsert session created with isBlocked false (isStrike=false)
    expect(mockUpsertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isBlocked: false, strikeCount: 0 }),
      })
    )
  })
})

describe("knowledgeRoutes - Validation", () => {
  it("returns 422 on missing messages field", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routePath: "/console" }),
      })
    )
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("returns 422 on empty messages array", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routePath: "/console", messages: [] }),
      })
    )
    expect(response.status).toBe(422)
  })

  it("returns 422 when routePath normalizes to empty", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routePath: "",
          messages: [{ role: "user", content: "Hello" }],
        }),
      })
    )
    expect(response.status).toBe(422)
  })
})

describe("knowledgeRoutes - Streaming Response", () => {
  it("returns strict fallback when no docs and user is unauthenticated", async () => {
    mockAuthenticate.mockImplementationOnce(
      async (): Promise<KnowledgeAuthContext> => ({
        organizationId: null,
        user: { id: "user_anon", email: null },
      })
    )
    mockSearchKnowledgeDocs.mockResolvedValueOnce([])

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routePath: "/console",
          messages: [{ role: "user", content: "Help me" }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((l: string) => JSON.parse(l))
    const done = frames.find((f: Record<string, unknown>) => f.type === "done")
    expect((done as Record<string, unknown>).answer).toBe(
      "I don't know from the current knowledgebase."
    )
  })

  it("streams answer with citations and persists session when docs found", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-cite-1",
          routePath: "/console",
          messages: [{ role: "user", content: "How to manage billing?" }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const frames = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((l: string) => JSON.parse(l))
    const deltas = frames.filter(
      (f: Record<string, unknown>) => f.type === "delta"
    )
    const done = frames.find((f: Record<string, unknown>) => f.type === "done")
    expect(deltas.length).toBeGreaterThan(0)
    expect((done as Record<string, unknown>).citations).toBeDefined()
    expect(mockUpsertSession).toHaveBeenCalled()
    expect(mockCreateManyChatMessages).toHaveBeenCalled()
  })
})
