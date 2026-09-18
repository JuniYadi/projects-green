import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { AiChatMessage, AiChatSession } from "@prisma/client"
import type { CoreMessage } from "./ai-agent-session.service"

const mockAiChatSessionFindUnique = mock()
const mockAiChatSessionCreate = mock()
const mockAiChatSessionUpdate = mock()
const mockAiChatMessageFindMany = mock()
const mockAiChatMessageCreate = mock()

const mockRedisSet = mock()
const mockRedisGet = mock()
const mockRedisDel = mock()
const mockRedisEval = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiChatSession: {
      findUnique: mockAiChatSessionFindUnique,
      create: mockAiChatSessionCreate,
      update: mockAiChatSessionUpdate,
    },
    aiChatMessage: {
      findMany: mockAiChatMessageFindMany,
      create: mockAiChatMessageCreate,
    },
  },
}))

mock.module("@/lib/redis", () => ({
  redis: {
    set: mockRedisSet,
    get: mockRedisGet,
    del: mockRedisDel,
    eval: mockRedisEval,
  },
}))

const {
  acquireSessionLock,
  getConversationHistory,
  getOrCreateSession,
  recordMessage,
  releaseSessionLock,
  slidingWindowPruning,
} = await import("./ai-agent-session.service")

describe("ai-agent-session.service", () => {
  beforeEach(() => {
    mockAiChatSessionFindUnique.mockClear()
    mockAiChatSessionCreate.mockClear()
    mockAiChatSessionUpdate.mockClear()
    mockAiChatMessageFindMany.mockClear()
    mockAiChatMessageCreate.mockClear()

    mockRedisSet.mockClear()
    mockRedisGet.mockClear()
    mockRedisDel.mockClear()
    mockRedisEval.mockClear()

    mockRedisSet.mockResolvedValue("OK")
    mockRedisGet.mockResolvedValue(null)
    mockRedisDel.mockResolvedValue(1)
    mockRedisEval.mockResolvedValue(1)
  })

  describe("getOrCreateSession", () => {
    it("returns existing session when found by sessionId", async () => {
      const existingSession: AiChatSession = {
        id: "sess_row_1",
        sessionId: "wa_contact_123",
        organizationId: "org_alpha",
        agentProfileId: "agent_sales",
        channel: "WHATSAPP",
        channelTargetId: "device_wa_1",
        userId: null,
        userEmail: null,
        customerPhone: "+628123456789",
        externalUserId: null,
        ipAddress: null,
        userAgent: null,
        totalMessages: 6,
        totalTokens: 750,
        strikeCount: 0,
        isBlocked: false,
        blockReason: null,
        createdAt: new Date("2026-09-19T00:00:00.000Z"),
        updatedAt: new Date("2026-09-19T00:05:00.000Z"),
      }
      mockAiChatSessionFindUnique.mockResolvedValueOnce(existingSession)

      const result = await getOrCreateSession({
        sessionId: "wa_contact_123",
        organizationId: "org_alpha",
      })

      expect(mockAiChatSessionFindUnique).toHaveBeenCalledWith({
        where: { sessionId: "wa_contact_123" },
      })
      expect(mockAiChatSessionCreate).not.toHaveBeenCalled()
      expect(result).toEqual(existingSession)
    })

    it("creates new session when not found in database", async () => {
      const newSession: AiChatSession = {
        id: "sess_row_2",
        sessionId: "wa_contact_456",
        organizationId: "org_alpha",
        agentProfileId: "agent_support",
        channel: "WHATSAPP",
        channelTargetId: "device_wa_1",
        userId: null,
        userEmail: null,
        customerPhone: "+628987654321",
        externalUserId: null,
        ipAddress: null,
        userAgent: null,
        totalMessages: 0,
        totalTokens: 0,
        strikeCount: 0,
        isBlocked: false,
        blockReason: null,
        createdAt: new Date("2026-09-19T01:00:00.000Z"),
        updatedAt: new Date("2026-09-19T01:00:00.000Z"),
      }
      mockAiChatSessionFindUnique.mockResolvedValueOnce(null)
      mockAiChatSessionCreate.mockResolvedValueOnce(newSession)

      const result = await getOrCreateSession({
        sessionId: "wa_contact_456",
        organizationId: "org_alpha",
        agentProfileId: "agent_support",
        channel: "WHATSAPP",
        channelTargetId: "device_wa_1",
        customerPhone: "+628987654321",
      })

      expect(mockAiChatSessionFindUnique).toHaveBeenCalledWith({
        where: { sessionId: "wa_contact_456" },
      })
      expect(mockAiChatSessionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: "wa_contact_456",
          organizationId: "org_alpha",
          agentProfileId: "agent_support",
          channel: "WHATSAPP",
          channelTargetId: "device_wa_1",
          customerPhone: "+628987654321",
        }),
      })
      expect(result).toEqual(newSession)
    })
  })

  describe("acquireSessionLock and releaseSessionLock", () => {
    it(
      "acquires lock by setting Redis key with NX/EX 10 and returns token",
      async () => {
        mockRedisSet.mockResolvedValueOnce("OK")

        const lockToken = await acquireSessionLock("sess_thread_99")

        expect(typeof lockToken).toBe("string")
        expect(lockToken).not.toBeNull()
        expect(mockRedisSet).toHaveBeenCalledTimes(1)

        const calls = mockRedisSet.mock.calls
        const [key, token, ...flags] = calls[0] as [
          string,
          string,
          ...unknown[],
        ]

        expect(key).toContain("sess_thread_99")
        expect(token).toBe(lockToken as string)
        expect(flags).toContain("EX")
        expect(flags).toContain(10)
        expect(flags).toContain("NX")
      }
    )

    it(
      "returns null when lock is already held by concurrent operation",
      async () => {
        mockRedisSet.mockResolvedValueOnce(null)

        const lockToken = await acquireSessionLock("sess_thread_99")

        expect(lockToken).toBeNull()
        expect(mockRedisSet).toHaveBeenCalledTimes(1)
      }
    )

    it("releases lock when matching token is provided", async () => {
      mockRedisEval.mockResolvedValueOnce(1)

      const released = await releaseSessionLock(
        "sess_thread_99",
        "valid-token-123"
      )

      expect(released).toBe(true)
      const isEvalUsed = mockRedisEval.mock.calls.length > 0
      const isDelUsed = mockRedisDel.mock.calls.length > 0
      expect(isEvalUsed || isDelUsed).toBe(true)
    })

    it("returns false when token does not match or lock expired", async () => {
      mockRedisEval.mockResolvedValueOnce(0)
      mockRedisGet.mockResolvedValueOnce("different-token")

      const released = await releaseSessionLock(
        "sess_thread_99",
        "invalid-token-456"
      )

      expect(released).toBe(false)
    })
  })

  describe("getConversationHistory", () => {
    it(
      "fetches last N messages in desc order, reverses to chronological," +
        " and maps to CoreMessage",
      async () => {
        const dbMessages = [
          {
            id: "msg_3",
            sessionId: "sess_thread_1",
            role: "assistant",
            content: "Silakan pilih produk katalog kami.",
            createdAt: new Date("2026-09-19T02:02:00.000Z"),
          },
          {
            id: "msg_2",
            sessionId: "sess_thread_1",
            role: "user",
            content: "Apakah ada diskon hari ini?",
            createdAt: new Date("2026-09-19T02:01:00.000Z"),
          },
          {
            id: "msg_1",
            sessionId: "sess_thread_1",
            role: "assistant",
            content: "Halo! Selamat datang di Toko Kami.",
            createdAt: new Date("2026-09-19T02:00:00.000Z"),
          },
        ]
        mockAiChatMessageFindMany.mockResolvedValueOnce(dbMessages)

        const history = await getConversationHistory("sess_thread_1", 10)

        expect(mockAiChatMessageFindMany).toHaveBeenCalledWith({
          where: { sessionId: "sess_thread_1" },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
        expect(history).toEqual([
          { role: "assistant", content: "Halo! Selamat datang di Toko Kami." },
          { role: "user", content: "Apakah ada diskon hari ini?" },
          { role: "assistant", content: "Silakan pilih produk katalog kami." },
        ])
      }
    )

    it(
      "returns empty array when session has no previous messages",
      async () => {
        mockAiChatMessageFindMany.mockResolvedValueOnce([])

        const history = await getConversationHistory("sess_new_empty")

        expect(history).toEqual([])
        expect(mockAiChatMessageFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { sessionId: "sess_new_empty" },
            orderBy: { createdAt: "desc" },
          })
        )
      }
    )
  })

  describe("slidingWindowPruning", () => {
    it(
      "returns original messages when total character count is within budget",
      () => {
        const messages: CoreMessage[] = [
          { role: "user", content: "Halo bot toko" },
          { role: "assistant", content: "Halo! Ada yang bisa kami bantu?" },
          { role: "user", content: "Katalog sepatu apa yang baru?" },
          { role: "assistant", content: "Sepatu lari seri Neo dan Velocity." },
        ]

        const pruned = slidingWindowPruning(messages, 12000)

        expect(pruned).toEqual(messages)
        expect(pruned.length).toBe(4)
      }
    )

    it(
      "prunes oldest turns when character budget is exceeded," +
        " preserving pair balance",
      () => {
        const messages: CoreMessage[] = [
          { role: "user", content: "U1: ".padEnd(60, "a") },
          { role: "assistant", content: "A1: ".padEnd(60, "b") },
          { role: "user", content: "U2: ".padEnd(60, "c") },
          { role: "assistant", content: "A2: ".padEnd(60, "d") },
          { role: "user", content: "U3: ".padEnd(60, "e") },
          { role: "assistant", content: "A3: ".padEnd(60, "f") },
        ]

        // Total chars is 360; maxChars 260 requires pruning Turn 1 (120 chars)
        const pruned = slidingWindowPruning(messages, 260)

        expect(pruned.length).toBe(4)
        expect(pruned[0]?.role).toBe("user")
        expect(pruned[0]?.content).toContain("U2:")
        expect(pruned[1]?.role).toBe("assistant")
        expect(pruned[1]?.content).toContain("A2:")
        expect(pruned[2]?.role).toBe("user")
        expect(pruned[2]?.content).toContain("U3:")
        expect(pruned[3]?.role).toBe("assistant")
        expect(pruned[3]?.content).toContain("A3:")
      }
    )

    it(
      "ensures conversation begins with user message" +
        " and avoids orphan assistant",
      () => {
        const messages: CoreMessage[] = [
          { role: "user", content: "U1: ".padEnd(80, "1") },
          { role: "assistant", content: "A1: ".padEnd(80, "2") },
          { role: "user", content: "U2: ".padEnd(30, "3") },
          { role: "assistant", content: "A2: ".padEnd(30, "4") },
        ]

        // Budget 100 exceeds Turn 2 alone (60 chars) but fits Turn 2
        const pruned = slidingWindowPruning(messages, 100)

        expect(pruned.length).toBe(2)
        expect(pruned[0]?.role).toBe("user")
        expect(pruned[0]?.content).toContain("U2:")
        expect(pruned[1]?.role).toBe("assistant")
        expect(pruned[1]?.content).toContain("A2:")
      }
    )

    it(
      "applies default token budget (~12,000 characters ~ 3,000 tokens)" +
        " when omitted",
      () => {
        const longOldUser = "Old query: ".padEnd(6500, "x")
        const longOldAssistant = "Old response: ".padEnd(6500, "y")
        const recentUser = "Recent query: ".padEnd(1500, "z")
        const recentAssistant = "Recent response: ".padEnd(1500, "w")

        const messages: CoreMessage[] = [
          { role: "user", content: longOldUser },
          { role: "assistant", content: longOldAssistant },
          { role: "user", content: recentUser },
          { role: "assistant", content: recentAssistant },
        ]

        const pruned = slidingWindowPruning(messages)

        expect(pruned.length).toBe(2)
        expect(pruned[0]?.role).toBe("user")
        expect(pruned[0]?.content).toContain("Recent query:")
        expect(pruned[1]?.role).toBe("assistant")
        expect(pruned[1]?.content).toContain("Recent response:")
      }
    )
  })

  describe("recordMessage", () => {
    it(
      "appends user message and updates AiChatSession" +
        " total messages and tokens",
      async () => {
        const savedUserMessage: AiChatMessage = {
          id: "msg_user_101",
          sessionId: "sess_thread_1",
          role: "user",
          content: "Berapa ongkir ke Surabaya?",
          routePath: null,
          promptTokens: 14,
          responseTokens: 0,
          modelName: null,
          durationMs: null,
          citations: [],
          isFlagged: false,
          flagReason: null,
          createdAt: new Date("2026-09-19T03:00:00.000Z"),
        }
        mockAiChatMessageCreate.mockResolvedValueOnce(savedUserMessage)
        mockAiChatSessionUpdate.mockResolvedValueOnce({
          id: "sess_row_1",
          sessionId: "sess_thread_1",
          totalMessages: 5,
          totalTokens: 114,
        })

        const result = await recordMessage({
          sessionId: "sess_thread_1",
          role: "user",
          content: "Berapa ongkir ke Surabaya?",
          promptTokens: 14,
          responseTokens: 0,
        })

        expect(mockAiChatMessageCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            sessionId: "sess_thread_1",
            role: "user",
            content: "Berapa ongkir ke Surabaya?",
            promptTokens: 14,
            responseTokens: 0,
          }),
        })
        expect(mockAiChatSessionUpdate).toHaveBeenCalledWith({
          where: { sessionId: "sess_thread_1" },
          data: {
            totalMessages: { increment: 1 },
            totalTokens: { increment: 14 },
          },
        })
        expect(result).toEqual(savedUserMessage)
      }
    )

    it(
      "appends assistant message with response tokens," +
        " model name, and routePath",
      async () => {
        const savedAssistantMessage: AiChatMessage = {
          id: "msg_assistant_102",
          sessionId: "sess_thread_1",
          role: "assistant",
          content: "Ongkir ke Surabaya Rp 20.000.",
          routePath: "rag_catalog",
          promptTokens: 25,
          responseTokens: 35,
          modelName: "gpt-4o-mini",
          durationMs: 420,
          citations: ["doc_shipping_rates"],
          isFlagged: false,
          flagReason: null,
          createdAt: new Date("2026-09-19T03:00:01.000Z"),
        }
        mockAiChatMessageCreate.mockResolvedValueOnce(savedAssistantMessage)
        mockAiChatSessionUpdate.mockResolvedValueOnce({
          id: "sess_row_1",
          sessionId: "sess_thread_1",
          totalMessages: 6,
          totalTokens: 174,
        })

        const result = await recordMessage({
          sessionId: "sess_thread_1",
          role: "assistant",
          content: "Ongkir ke Surabaya Rp 20.000.",
          promptTokens: 25,
          responseTokens: 35,
          modelName: "gpt-4o-mini",
          routePath: "rag_catalog",
          citations: ["doc_shipping_rates"],
          durationMs: 420,
        })

        expect(mockAiChatMessageCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            sessionId: "sess_thread_1",
            role: "assistant",
            content: "Ongkir ke Surabaya Rp 20.000.",
            promptTokens: 25,
            responseTokens: 35,
            modelName: "gpt-4o-mini",
            routePath: "rag_catalog",
            citations: ["doc_shipping_rates"],
            durationMs: 420,
          }),
        })
        expect(mockAiChatSessionUpdate).toHaveBeenCalledWith({
          where: { sessionId: "sess_thread_1" },
          data: {
            totalMessages: { increment: 1 },
            totalTokens: { increment: 60 },
          },
        })
        expect(result).toEqual(savedAssistantMessage)
      }
    )

    it(
      "handles zero token defaults when token counts are omitted",
      async () => {
        mockAiChatMessageCreate.mockResolvedValueOnce({
          id: "msg_user_103",
          sessionId: "sess_thread_1",
          role: "user",
          content: "Halo",
          promptTokens: 0,
          responseTokens: 0,
        })
        mockAiChatSessionUpdate.mockResolvedValueOnce({
          id: "sess_row_1",
          sessionId: "sess_thread_1",
          totalMessages: 7,
          totalTokens: 174,
        })

        await recordMessage({
          sessionId: "sess_thread_1",
          role: "user",
          content: "Halo",
        })

        expect(mockAiChatMessageCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            sessionId: "sess_thread_1",
            role: "user",
            content: "Halo",
            promptTokens: 0,
            responseTokens: 0,
          }),
        })
        expect(mockAiChatSessionUpdate).toHaveBeenCalledWith({
          where: { sessionId: "sess_thread_1" },
          data: {
            totalMessages: { increment: 1 },
            totalTokens: { increment: 0 },
          },
        })
      }
    )
  })
})
