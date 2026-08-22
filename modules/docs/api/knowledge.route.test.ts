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
    },
    aiChatMessage: {
      create: mockCreateChatMessage,
      createMany: mockCreateManyChatMessages,
      count: mockCountMessages,
    },
  },
}))

const { createKnowledgeRoutes } =
  await import("@/modules/docs/api/knowledge.route")
type KnowledgeAuthContext =
  import("@/modules/docs/api/knowledge.route").KnowledgeAuthContext

const mockAuthenticate = mock(
  async (): Promise<KnowledgeAuthContext> => ({
    organizationId: "org_1",
    user: {
      id: "user_1",
      email: "user1@example.com",
    },
  })
)
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

  it("returns strict fallback when no relevant knowledge context", async () => {
    mockSearchKnowledgeDocs.mockResolvedValueOnce([] as KnowledgeDocMatch[])

    const response = await createApp().handle(
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

  it("rejects oversized prompts (> 800 chars) with 422 and 0 tokens spent", async () => {
    const longPrompt = "a".repeat(801)

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
