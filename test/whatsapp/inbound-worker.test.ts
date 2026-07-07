import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ─── Prisma mock ─────────────────────────────────────────────────────────────────

type MockQuery = {
  findFirst: ReturnType<typeof mock>
  findUnique: ReturnType<typeof mock>
  create: ReturnType<typeof mock>
  update: ReturnType<typeof mock>
}

const mockConversation: MockQuery = {
  findFirst: mock(async () => null),
  findUnique: mock(async () => null),
  create: mock(async () => ({ id: "conv-new-1" })),
  update: mock(async () => ({ id: "conv-updated-1" })),
}

const mockMessage: MockQuery = {
  findFirst: mock(async () => null),
  findUnique: mock(async () => null),
  create: mock(async () => ({ id: "msg-new-1" })),
  update: mock(async () => null),
}

const mockDevice: MockQuery = {
  findFirst: mock(async () => null),
  findUnique: mock(async () => ({ id: "device-1", organizationId: "org-1" })),
  create: mock(async () => null),
  update: mock(async () => null),
}

const mockDailyCount = {
  upsert: mock(async () => null),
}

const mockMonthlyCount = {
  upsert: mock(async () => null),
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappConversation: mockConversation,
    whatsappMessage: mockMessage,
    whatsappDevice: mockDevice,
    whatsappDailyCount: mockDailyCount,
    whatsappMonthlyCount: mockMonthlyCount,
    whatsappContactGroup: {
      findFirst: mock(async () => null),
      create: mock(async () => ({ id: "group_default" })),
    },
    whatsappContact: {
      upsert: mock(async () => ({})),
    },
  },
}))

// ─── Imports under test ──────────────────────────────────────────────────────────

const { processInboundMessage } =
  await import("@/modules/whatsapp/webhooks/webhooks.service")

beforeEach(() => {
  // Reset all mocks
  for (const m of [mockConversation, mockMessage, mockDevice]) {
    m.findFirst.mockClear()
    m.findUnique.mockClear()
    m.create.mockClear()
    m.update.mockClear()
  }

  // Default device mock
  mockDevice.findUnique.mockResolvedValue({
    id: "device-1",
    organizationId: "org-1",
  })
})

afterEach(() => {
  // Clean up
})

const sampleTextPayload = {
  from: "+15551234567",
  id: "wamid.text.abc123",
  timestamp: "1680000000",
  type: "text",
  text: { body: "Hello from customer!" },
}

const sampleImagePayload = {
  from: "+15551234567",
  id: "wamid.img.def456",
  timestamp: "1680000001",
  type: "image",
  image: { id: "media-id-789", mime_type: "image/jpeg" },
}

describe("processInboundMessage", () => {
  it("creates a new conversation for first-time contact", async () => {
    // No existing conversation
    mockConversation.findFirst.mockResolvedValue(null)
    mockConversation.create.mockResolvedValue({
      id: "conv-new",
      organizationId: "org-1",
      contactPhone: "+15551234567",
    })
    mockMessage.create.mockResolvedValue({
      id: "msg-new",
      conversationId: "conv-new",
    })

    const result = await processInboundMessage(
      sampleTextPayload,
      "device-1",
      "org-1"
    )

    expect(result.conversationId).toBe("conv-new")
    expect(result.messageId).toBe("msg-new")
    expect(result.isNewConversation).toBe(true)

    // Verify conversation was created with correct data
    expect(mockConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          contactPhone: "+15551234567",
          lastDirection: "INBOX",
          whatsappDeviceId: "device-1",
        }),
      })
    )
  })

  it("uses existing conversation for returning contact", async () => {
    mockConversation.findFirst.mockResolvedValue({
      id: "conv-existing",
      organizationId: "org-1",
      contactPhone: "+15551234567",
    })
    mockConversation.update.mockResolvedValue({
      id: "conv-existing",
    })
    mockMessage.create.mockResolvedValue({
      id: "msg-existing",
      conversationId: "conv-existing",
    })

    const result = await processInboundMessage(
      sampleTextPayload,
      "device-1",
      "org-1"
    )

    expect(result.conversationId).toBe("conv-existing")
    expect(result.isNewConversation).toBe(false)

    // Verify conversation was updated with new timestamp
    expect(mockConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-existing" },
        data: expect.objectContaining({
          lastDirection: "INBOX",
        }),
      })
    )
  })

  it("creates inbound message with correct direction=INBOX", async () => {
    mockConversation.findFirst.mockResolvedValue({
      id: "conv-1",
    })
    mockConversation.update.mockResolvedValue({ id: "conv-1" })
    mockMessage.create.mockResolvedValue({
      id: "msg-inbox",
      conversationId: "conv-1",
    })

    await processInboundMessage(sampleTextPayload, "device-1", "org-1")

    expect(mockMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: "INBOX",
          messageType: "text",
          body: "Hello from customer!",
          waMessageId: "wamid.text.abc123",
        }),
      })
    )
  })

  it("stores media reference for image messages", async () => {
    mockConversation.findFirst.mockResolvedValue({
      id: "conv-2",
    })
    mockConversation.update.mockResolvedValue({ id: "conv-2" })
    mockMessage.create.mockResolvedValue({
      id: "msg-media",
      conversationId: "conv-2",
    })

    await processInboundMessage(sampleImagePayload, "device-1", "org-1")

    expect(mockMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messageType: "image",
          mediaUrl: "__media:media-id-789",
        }),
      })
    )
    // Verify body is not set for media-only messages
    const createCall = mockMessage.create.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(createCall.data.body).toBeUndefined()
  })

  it("stores media reference for document messages", async () => {
    const docPayload = {
      from: "+15551234567",
      id: "wamid.doc.ghi789",
      timestamp: "1680000002",
      type: "document",
      document: {
        id: "media-doc-123",
        mime_type: "application/pdf",
        filename: "doc.pdf",
      },
    }

    mockConversation.findFirst.mockResolvedValue({ id: "conv-3" })
    mockConversation.update.mockResolvedValue({ id: "conv-3" })
    mockMessage.create.mockResolvedValue({
      id: "msg-doc",
      conversationId: "conv-3",
    })

    await processInboundMessage(docPayload, "device-1", "org-1")

    expect(mockMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messageType: "document",
          mediaUrl: "__media:media-doc-123",
        }),
      })
    )
  })

  it("throws for payload missing 'from'", async () => {
    const invalidPayload = { id: "wamid.no-from", type: "text" }

    await expect(
      processInboundMessage(invalidPayload as any, "device-1", "org-1")
    ).rejects.toThrow("Invalid message payload")
  })

  it("throws for payload missing 'id'", async () => {
    const invalidPayload = { from: "+15551234567", type: "text" }

    await expect(
      processInboundMessage(invalidPayload as any, "device-1", "org-1")
    ).rejects.toThrow("Invalid message payload")
  })

  it("handles unknown message types gracefully", async () => {
    const unknownPayload = {
      from: "+15551234567",
      id: "wamid.unknown",
      timestamp: "1680000003",
      type: "unsupported_type",
    }

    mockConversation.findFirst.mockResolvedValue({ id: "conv-4" })
    mockConversation.update.mockResolvedValue({ id: "conv-4" })
    mockMessage.create.mockResolvedValue({
      id: "msg-unk",
      conversationId: "conv-4",
    })

    const result = await processInboundMessage(
      unknownPayload,
      "device-1",
      "org-1"
    )

    expect(result.messageId).toBe("msg-unk")
    const createCall = mockMessage.create.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(createCall.data.messageType).toBe("unsupported_type")
    expect(createCall.data.body).toBeUndefined()
    expect(createCall.data.mediaUrl).toBeUndefined()
  })

  it("includes metadata in message record", async () => {
    mockConversation.findFirst.mockResolvedValue({ id: "conv-5" })
    mockConversation.update.mockResolvedValue({ id: "conv-5" })
    mockMessage.create.mockResolvedValue({
      id: "msg-meta",
      conversationId: "conv-5",
    })

    await processInboundMessage(sampleTextPayload, "device-1", "org-1")

    const createCall = mockMessage.create.mock.calls[0][0] as {
      data: { metadata: unknown }
    }
    expect(createCall.data.metadata).toMatchObject({
      rawPayload: sampleTextPayload,
      deviceId: "device-1",
      organizationId: "org-1",
    })
  })
})
