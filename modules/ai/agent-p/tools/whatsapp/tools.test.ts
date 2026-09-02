import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const prismaMock = {
  whatsappConversation: {
    findMany: mock(),
    findFirst: mock(),
  },
  whatsappBroadcastCampaign: { findFirst: mock() },
  whatsappDevice: { findFirst: mock() },
}
mock.module("@/lib/prisma", () => ({ prisma: prismaMock }))

import { broadcastPreflightTool } from "./broadcast-preflight.tool"
import { contactNormalizeTool } from "./contact-normalize.tool"
import { deviceDiagnoseTool } from "./device-diagnose.tool"
import { inboxSuggestReplyTool } from "./inbox-suggest-reply.tool"
import { inboxSummarizeTool } from "./inbox-summarize.tool"
import type { AgentPContext } from "../../types"

const context: AgentPContext = {
  session: { organizationId: "org-1", userId: "user-1", role: "USER" },
}

describe("WhatsApp Agent P tools", () => {
  beforeEach(() => {
    for (const model of Object.values(prismaMock)) {
      for (const operation of Object.values(model)) operation.mockReset()
    }
  })

  it("normalizes a local phone number to E.164", () => {
    expect(
      contactNormalizeTool.execute(
        { phoneNumber: "0812-345-678", defaultCountryCode: "62" },
        context
      )
    ).toEqual({
      input: "0812-345-678",
      normalized: "+62812345678",
      isValid: true,
    })
  })
  it("normalizes a phone number already starting with country code without plus", () => {
    expect(
      contactNormalizeTool.execute(
        { phoneNumber: "62812345678", defaultCountryCode: "62" },
        context
      )
    ).toEqual({
      input: "62812345678",
      normalized: "+62812345678",
      isValid: true,
    })
  })

  it("marks an excessively short contact as invalid", () => {
    expect(
      contactNormalizeTool.execute(
        { phoneNumber: "123", defaultCountryCode: "62" },
        context
      )
    ).toEqual({
      input: "123",
      normalized: "+62123",
      isValid: false,
    })
  })

  it("summarizes recent messages within the organization", async () => {
    prismaMock.whatsappConversation.findMany.mockResolvedValueOnce([
      {
        id: "conversation-1",
        whatsappMessages: [
          {
            direction: "IN",
            body: "Hello",
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      },
    ])

    const result = await inboxSummarizeTool.execute({ limit: 5 }, context)

    expect(prismaMock.whatsappConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        take: 5,
      })
    )
    expect(result).toEqual({
      conversationId: undefined,
      messages: [
        {
          direction: "IN",
          body: "Hello",
          status: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      summary: "Percakapan memiliki 1 riwayat pesan.",
    })
  })

  it("suggests a reply from the latest message", async () => {
    prismaMock.whatsappConversation.findFirst.mockResolvedValueOnce({
      id: "conversation-1",
      whatsappMessages: [{ body: "Can you help?" }],
    })

    await expect(
      inboxSuggestReplyTool.execute(
        { conversationId: "conversation-1", tone: "friendly" },
        context
      )
    ).resolves.toEqual({
      conversationId: "conversation-1",
      suggestedReply:
        "Terima kasih atas pesannya. Kami akan membantu menindaklanjuti: Can you help?",
    })
    expect(prismaMock.whatsappConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", id: "conversation-1" },
      })
    )
  })

  it("reports a missing conversation instead of inventing a reply", async () => {
    prismaMock.whatsappConversation.findFirst.mockResolvedValueOnce(null)
    await expect(
      inboxSuggestReplyTool.execute(
        { conversationId: "missing", tone: "concise" },
        context
      )
    ).rejects.toThrow("CONVERSATION_NOT_FOUND")
  })

  it("diagnoses a connected device without exposing credentials", async () => {
    prismaMock.whatsappDevice.findFirst.mockResolvedValueOnce({
      id: "device-1",
      status: "ACTIVE",
      phoneNumber: "+62812345678",
      lastHeartbeatAt: new Date("2026-01-01T00:00:00Z"),
    })

    await expect(
      deviceDiagnoseTool.execute({ deviceId: "device-1" }, context)
    ).resolves.toEqual({
      deviceId: "device-1",
      status: "ACTIVE",
      phoneNumber: "+62812345678",
      connected: true,
      lastHeartbeatAt: "2026-01-01T00:00:00.000Z",
      checks: ["device-status-ok"],
    })
  })

  it("rejects a device outside the organization scope", async () => {
    prismaMock.whatsappDevice.findFirst.mockResolvedValueOnce(null)
    await expect(
      deviceDiagnoseTool.execute({ deviceId: "other-device" }, context)
    ).rejects.toThrow("DEVICE_NOT_FOUND")
    expect(prismaMock.whatsappDevice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", id: "other-device" },
      })
    )
  })

  it("passes broadcast recipients through preflight validation", async () => {
    prismaMock.whatsappBroadcastCampaign.findFirst.mockResolvedValueOnce({
      id: "broadcast-1",
      templateParams: "Hi {{1}}",
      recipients: [{ dynamicValues: { "{{1}}": "Ada" } }],
    })

    await expect(
      broadcastPreflightTool.execute({ broadcastId: "broadcast-1" }, context)
    ).resolves.toEqual({
      broadcastId: "broadcast-1",
      valid: true,
      recipientCount: 1,
      issues: [],
    })
  })

  it("returns a stable not-found error for unknown broadcasts", async () => {
    prismaMock.whatsappBroadcastCampaign.findFirst.mockResolvedValueOnce(null)
    await expect(
      broadcastPreflightTool.execute({ broadcastId: "missing" }, context)
    ).rejects.toThrow("BROADCAST_NOT_FOUND")
  })
})
