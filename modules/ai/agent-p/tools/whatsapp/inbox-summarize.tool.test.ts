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
            statusHistory: [{ status: "READ" }],
            createdAt: new Date("2026-09-02T10:00:00Z"),
          },
          {
            direction: "OUTBOUND",
            body: "Sudah dikirim kak dengan resi JNE123",
            statusHistory: [{ status: "DELIVERED" }],
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
    expect(result.summary).toContain("Percakapan memiliki 2 riwayat pesan.")
    expect(result.summary).toContain("Halo, pesanan saya apa sudah dikirim?")
  })

  it("handles empty inbox gracefully", async () => {
    mockPrisma.whatsappConversation.findMany.mockResolvedValueOnce([])
    const result = await inboxSummarizeTool.execute({ limit: 20 }, context)
    expect(result.messages).toEqual([])
    expect(result.summary).toBe("Tidak ada riwayat pesan percakapan.")
  })
  it("resolves conversation when phone number is provided", async () => {
    mockPrisma.whatsappConversation.findMany.mockResolvedValueOnce([
      {
        id: "conv-phone-1",
        contactPhone: "+6285161432124",
        whatsappDeviceId: "dev-active",
        whatsappMessages: [
          {
            direction: "INBOUND",
            body: "Halo kak mau tanya promo",
            statusHistory: [{ status: "READ" }],
            createdAt: new Date("2026-09-02T10:00:00Z"),
          },
        ],
      },
    ])

    const result = await inboxSummarizeTool.execute(
      { phoneNumber: "+6285161432124", deviceId: "dev-active" },
      context
    )
    expect(result.conversationId).toBe("conv-phone-1")
    expect(result.phoneNumber).toBe("+6285161432124")
    expect(result.deviceId).toBe("dev-active")
    expect(result.messages.length).toBe(1)
    expect(result.summary).toContain("Halo kak mau tanya promo")
  })

  it("resolves conversation when phone number is passed in conversationId field", async () => {
    mockPrisma.whatsappConversation.findMany.mockResolvedValueOnce([
      {
        id: "conv-cuid-1",
        contactPhone: "+6285161432124",
        whatsappMessages: [
          {
            direction: "OUTBOUND",
            body: "OTP anda adalah 123456",
            statusHistory: [{ status: "SENT" }],
            createdAt: new Date("2026-09-02T10:00:00Z"),
          },
        ],
      },
    ])

    const result = await inboxSummarizeTool.execute(
      { conversationId: "6285161432124" },
      context
    )
    expect(result.conversationId).toBe("conv-cuid-1")
    expect(result.phoneNumber).toBe("+6285161432124")
    expect(result.summary).toContain("OTP anda adalah 123456")
  })
})
