import { beforeEach, describe, expect, it, mock } from "bun:test"
import { inboxSuggestReplyTool } from "./inbox-suggest-reply.tool"
import type { AgentPContext } from "../../types"

const mockPrisma = {
  whatsappConversation: {
    findFirst: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("inboxSuggestReplyTool", () => {
  beforeEach(() => {
    mockPrisma.whatsappConversation.findFirst.mockReset()
  })

  it("has valid tool metadata", () => {
    expect(inboxSuggestReplyTool.name).toBe("whatsapp.inbox.suggest_reply")
  })

  it("suggests a contextual reply based on latest message", async () => {
    mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce({
      id: "conv-1",
      whatsappMessages: [{ body: "Tolong kirim invoice saya" }],
    })

    const result = await inboxSuggestReplyTool.execute(
      { conversationId: "conv-1", tone: "friendly" },
      context
    )
    expect(result.conversationId).toBe("conv-1")
    expect(result.suggestedReply).toContain("Tolong kirim invoice saya")
  })

  it("suggests default reply when conversation has no messages", async () => {
    mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce({
      id: "conv-empty",
      whatsappMessages: [],
    })

    const result = await inboxSuggestReplyTool.execute(
      { conversationId: "conv-empty" },
      context
    )
    expect(result.suggestedReply).toBe(
      "Terima kasih telah menghubungi kami. Ada yang bisa kami bantu?"
    )
  })

  it("throws when conversation not found", async () => {
    mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce(null)
    await expect(
      inboxSuggestReplyTool.execute({ conversationId: "conv-none" }, context)
    ).rejects.toThrow("CONVERSATION_NOT_FOUND")
  })
})
