import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ─── Prisma mock ─────────────────────────────────────────────────────────────────

type MockQuery = {
  findFirst: ReturnType<typeof mock>
  findUnique: ReturnType<typeof mock>
  create: ReturnType<typeof mock>
  update: ReturnType<typeof mock>
}

const mockMessage: MockQuery = {
  findFirst: mock(async () => null),
  findUnique: mock(async () => null),
  create: mock(async () => null),
  update: mock(async () => null),
}

const mockStatus: MockQuery = {
  findFirst: mock(async () => null),
  findUnique: mock(async () => null),
  create: mock(async () => ({ id: "status-new" })),
  update: mock(async () => null),
}

const mockConversation: MockQuery = {
  findFirst: mock(async () => null),
  findUnique: mock(async () => null),
  create: mock(async () => null),
  update: mock(async () => ({ id: "conv-updated" })),
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappMessage: mockMessage,
    whatsappMessageStatus: mockStatus,
    whatsappConversation: mockConversation,
    whatsappWebhook: {
      findMany: mock(async () => []),
    },
    whatsappContactGroup: {
      findFirst: mock(async () => null),
      create: mock(async () => ({ id: "group_default" })),
    },
    whatsappContact: {
      upsert: mock(async (args: any) => args.create ?? args.update ?? {}),
    },
  },
}))

// ─── Imports under test ──────────────────────────────────────────────────────────

const { processDeliveryStatus } =
  await import("@/modules/whatsapp/webhooks/webhooks.service")

beforeEach(() => {
  for (const m of [mockMessage, mockStatus, mockConversation]) {
    m.findFirst.mockClear()
    m.findUnique.mockClear()
    m.create.mockClear()
    m.update.mockClear()
  }

  // Silences console.warn during tests
  mockConsole()
})

afterEach(() => {
  restoreConsole()
})

// ─── Console spy helper ──────────────────────────────────────────────────────────

let origWarn: typeof console.warn
let warnCalls: unknown[][]

function mockConsole() {
  origWarn = console.warn
  warnCalls = []
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args)
  }
}

function restoreConsole() {
  console.warn = origWarn
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────────

const sampleStatusSent = {
  id: "wamid.sent.123",
  status: "sent",
  timestamp: "1680000000",
  recipient_id: "+15551234567",
}

const sampleStatusDelivered = {
  id: "wamid.delivered.456",
  status: "delivered",
  timestamp: "1680000100",
  recipient_id: "+15551234567",
}

const sampleStatusRead = {
  id: "wamid.read.789",
  status: "read",
  timestamp: "1680000200",
  recipient_id: "+15551234567",
}

const sampleStatusFailed = {
  id: "wamid.failed.999",
  status: "failed",
  timestamp: "1680000300",
  recipient_id: "+15551234567",
  errors: [
    {
      code: 130429,
      title: "Message failed to send",
      message: "Rate limit exceeded",
      error_data: { details: "Too many requests in a short period" },
    },
  ],
}

const sampleMessageFound = {
  id: "msg-123",
  conversationId: "conv-456",
}

// ─── Tests ────────────────────────────────────────────────────────────────────────

describe("processDeliveryStatus", () => {
  it("creates status record for 'sent' status", async () => {
    mockMessage.findFirst.mockResolvedValue(sampleMessageFound)
    mockStatus.create.mockResolvedValue({ id: "st-sent" })
    mockConversation.update.mockResolvedValue({ id: "conv-456" })

    const result = await processDeliveryStatus(
      sampleStatusSent,
      "device-1",
      "org-1"
    )

    expect(result.status).toBe("SENT")
    expect(result.messageId).toBe("msg-123")
    expect(result.statusId).toBe("st-sent")

    expect(mockStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messageId: "msg-123",
          status: "SENT",
        }),
      })
    )
  })

  it("creates status record for 'delivered' status", async () => {
    mockMessage.findFirst.mockResolvedValue(sampleMessageFound)
    mockStatus.create.mockResolvedValue({ id: "st-delivered" })
    mockConversation.update.mockResolvedValue({ id: "conv-456" })

    const result = await processDeliveryStatus(
      sampleStatusDelivered,
      "device-1",
      "org-1"
    )

    expect(result.status).toBe("DELIVERED")
    expect(mockStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELIVERED" }),
      })
    )
  })

  it("creates status record for 'read' status", async () => {
    mockMessage.findFirst.mockResolvedValue(sampleMessageFound)
    mockStatus.create.mockResolvedValue({ id: "st-read" })
    mockConversation.update.mockResolvedValue({ id: "conv-456" })

    const result = await processDeliveryStatus(
      sampleStatusRead,
      "device-1",
      "org-1"
    )

    expect(result.status).toBe("READ")
    expect(mockStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "READ" }),
      })
    )
  })

  it("creates status record for 'failed' status with error details", async () => {
    mockMessage.findFirst.mockResolvedValue(sampleMessageFound)
    mockStatus.create.mockResolvedValue({ id: "st-failed" })
    mockConversation.update.mockResolvedValue({ id: "conv-456" })

    const result = await processDeliveryStatus(
      sampleStatusFailed,
      "device-1",
      "org-1"
    )

    expect(result.status).toBe("FAILED")
    expect(mockStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: expect.stringContaining("130429"),
        }),
      })
    )
  })

  it("logs warning for unknown waMessageId and returns gracefully", async () => {
    mockMessage.findFirst.mockResolvedValue(null)

    const result = await processDeliveryStatus(
      sampleStatusSent,
      "device-1",
      "org-1"
    )

    expect(result.messageId).toBeNull()
    expect(result.statusId).toBe("")
    expect(result.status).toBe("SENT")

    // Should have logged a warning
    expect(warnCalls.length).toBeGreaterThan(0)
    expect(warnCalls[0][0]).toContain("unknown waMessageId")
  })

  it("updates conversation lastMessageAt on status", async () => {
    mockMessage.findFirst.mockResolvedValue(sampleMessageFound)
    mockStatus.create.mockResolvedValue({ id: "st-conv-update" })
    mockConversation.update.mockResolvedValue({ id: "conv-456" })

    await processDeliveryStatus(sampleStatusDelivered, "device-1", "org-1")

    expect(mockConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-456" },
        data: expect.objectContaining({
          lastMessageAt: expect.any(Date),
        }),
      })
    )
  })

  it("throws for unknown status value", async () => {
    const invalidStatus = {
      ...sampleStatusSent,
      status: "unknown_status",
    }

    await expect(
      processDeliveryStatus(invalidStatus, "device-1", "org-1")
    ).rejects.toThrow('Unknown delivery status: "unknown_status"')
  })

  it("parses timestamp from Meta's Unix seconds format", async () => {
    mockMessage.findFirst.mockResolvedValue(sampleMessageFound)
    mockStatus.create.mockResolvedValue({ id: "st-ts" })
    mockConversation.update.mockResolvedValue({ id: "conv-456" })

    await processDeliveryStatus(sampleStatusSent, "device-1", "org-1")

    expect(mockStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timestamp: expect.any(Date),
        }),
      })
    )

    // 1680000000 seconds since epoch
    const createCall = mockStatus.create.mock.calls[0][0] as {
      data: { timestamp: Date }
    }
    expect(createCall.data.timestamp.getTime()).toBe(1680000000000)
  })

  it("handles multiple status transitions for same message", async () => {
    // Simulate sent → delivered → read transitions
    mockMessage.findFirst.mockResolvedValue(sampleMessageFound)
    mockConversation.update.mockResolvedValue({ id: "conv-456" })

    // First: sent
    mockStatus.create.mockResolvedValueOnce({ id: "st-1" })
    await processDeliveryStatus(
      { ...sampleStatusSent, id: "wamid-same" },
      "device-1",
      "org-1"
    )

    // Second: delivered
    mockStatus.create.mockResolvedValueOnce({ id: "st-2" })
    await processDeliveryStatus(
      { ...sampleStatusDelivered, id: "wamid-same" },
      "device-1",
      "org-1"
    )

    // Third: read
    mockStatus.create.mockResolvedValueOnce({ id: "st-3" })
    await processDeliveryStatus(
      { ...sampleStatusRead, id: "wamid-same" },
      "device-1",
      "org-1"
    )

    // Verify 3 status records were created
    expect(mockStatus.create).toHaveBeenCalledTimes(3)
    expect(mockStatus.create.mock.calls[0][0].data.status).toBe("SENT")
    expect(mockStatus.create.mock.calls[1][0].data.status).toBe("DELIVERED")
    expect(mockStatus.create.mock.calls[2][0].data.status).toBe("READ")
  })
})
