import { beforeEach, describe, expect, it, mock } from "bun:test"
import { inboxSummarizeTool } from "./inbox-summarize.tool"
import type { AgentPContext } from "../../types"

const mockPrisma = {
  whatsappConversation: {
    findMany: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("inboxSummarizeTool", () => {
  beforeEach(() => {
    mockPrisma.whatsappConversation.findMany.mockReset()
  })

  it("has valid tool metadata", () => {
    expect(inboxSummarizeTool.name).toBe("whatsapp.inbox.summarize")
  })

  it("summarizes messages from a conversation", async () => {
    mockPrisma.whatsappConversation.findMany.mockResolvedValueOnce([
      {
        id: "conv-1",
        whatsappMessages: [
          {
            direction: "INBOUND",
            body: "Halo, pesanan saya apa sudah dikirim?",
            createdAt: new Date("2026-09-02T10:00:00Z"),
          },
          {
            direction: "OUTBOUND",
            body: "Sudah dikirim kak dengan resi JNE123",
            createdAt: new Date("2026-09-02T10:05:00Z"),
          },
        ],
      },
    ])

    const result = await inboxSummarizeTool.execute(
      { conversationId: "conv-1", limit: 20 },
      context
    )
    expect(result.conversationId).toBe("conv-1")
    expect(result.messages.length).toBe(2)
    expect(result.summary).toBe("Recent inbox contains 2 messages.")
  })

  it("handles empty inbox gracefully", async () => {
    mockPrisma.whatsappConversation.findMany.mockResolvedValueOnce([])
    const result = await inboxSummarizeTool.execute({}, context)
    expect(result.messages).toEqual([])
    expect(result.summary).toBe("No recent inbox messages.")
  })
})
