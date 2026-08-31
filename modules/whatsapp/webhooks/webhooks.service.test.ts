import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import fs from "node:fs"
// ---------------------------------------------------------------------------
// Mock leaf dependency @/lib/prisma only.
// See AGENTS.md: test-guidelines > mock.module — Module Cache Rules
// ---------------------------------------------------------------------------

const mockPrisma = {
  whatsappWebhookEvent: {
    create: mock(async () => ({ id: "event-1" })),
    update: mock(async () => ({})),
    count: mock(async () => 0),
    findMany: mock(async () => []),
  },
  whatsappConversation: {
    findFirst: mock(async () => null) as ReturnType<typeof mock>,
    create: mock(async (args: any) => ({
      id: "conv-1",
      ...args.data,
    })) as ReturnType<typeof mock>,
    update: mock(async (args: any) => ({
      id: "conv-1",
      ...args.data,
    })) as ReturnType<typeof mock>,
  },
  whatsappMessage: {
    findFirst: mock(async () => null as any),
    create: mock(async (args: any) => ({
      id: "msg-1",
      ...args.data,
      createdAt: new Date(),
    })),
    update: mock(async (args: any) => ({
      id: "msg-1",
      ...args.data,
    })),
  },
  whatsappMessageStatus: {
    create: mock(async () => ({ id: "status-1" })) as ReturnType<typeof mock>,
  },
  whatsappContact: {
    upsert: mock(async () => ({})),
  },
  whatsappContactGroup: {
    findFirst: mock(async () => ({ id: "group-1" })),
  },
  whatsappDailyCount: {
    upsert: mock(async () => ({})),
  },
  whatsappHourlyCount: {
    upsert: mock(async () => ({})),
  },
  whatsappMonthlyCount: {
    upsert: mock(async () => ({})),
  },
  whatsappMedia: {
    findUnique: mock(async () => null as any),
    upsert: mock(async () => ({
      id: "media-1",
      metaMediaId: "meta-sticker-123",
      organizationId: "org-1",
      mimeType: "image/webp",
      createdAt: new Date(),
    })),
  },
  whatsappDevice: {
    findUniqueOrThrow: mock(async () => ({
      id: "device-1",
      tokenEncrypted: "token",
    })),
    findUnique: mock(async () => ({
      id: "device-1",
      tokenEncrypted: "token",
    })),
    update: mock(async () => ({})),
  },
  whatsappWebhook: {
    findMany: mock(async () => []),
  },
  whatsappBillingLedger: {
    findFirst: mock(async () => null as any),
    update: mock(async () => ({})),
    updateMany: mock(async () => ({ count: 1 })),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const {
  createWebhookEvent,
  recordProcessingResult,
  listWebhookEvents,
  extractMessageBody,
  processInboundMessage,
  processDeliveryStatus,
} = await import("./webhooks.service")

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockEventRecord = {
  id: "event-1",
  organizationId: "org-1",
  whatsappDeviceId: "device-1",
  eventType: "inbound_message",
  processingStatus: "PENDING",
  metaPayload: { entry: [{ changes: [{ value: { messages: [{}] } }] }] },
  waMessageId: null,
  errorMessage: null,
  processedAt: null,
  createdAt: new Date("2026-06-18T12:00:00.000Z"),
}

const mockEventRecord2 = {
  id: "event-2",
  organizationId: "org-1",
  whatsappDeviceId: "device-1",
  eventType: "status_update",
  processingStatus: "SUCCESS",
  metaPayload: { entry: [{ changes: [{ value: { statuses: [{}] } }] }] },
  waMessageId: "wa-msg-123",
  errorMessage: null,
  processedAt: new Date("2026-06-18T12:01:00.000Z"),
  createdAt: new Date("2026-06-18T12:00:00.000Z"),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("webhookEventService", () => {
  beforeEach(() => {
    mockPrisma.whatsappWebhookEvent.create.mockClear()
    mockPrisma.whatsappWebhookEvent.update.mockClear()
    mockPrisma.whatsappWebhookEvent.count.mockClear()
    mockPrisma.whatsappWebhookEvent.findMany.mockClear()

    // Restore defaults after any previous test pollution
    mockPrisma.whatsappWebhookEvent.create.mockResolvedValue({ id: "event-1" })
    mockPrisma.whatsappWebhookEvent.update.mockResolvedValue({})
    mockPrisma.whatsappWebhookEvent.count.mockResolvedValue(0)
    mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    // Re-apply mock to prevent pollution from other test files in shared CI worker
    mock.module("@/lib/prisma", () => ({
      prisma: mockPrisma,
    }))
  })

  describe("createWebhookEvent", () => {
    it("creates a webhook event record with correct org/device/type/payload", async () => {
      mockPrisma.whatsappWebhookEvent.create.mockResolvedValue({
        id: "event-created-1",
      } as any)

      const eventId = await createWebhookEvent(
        "org-1",
        "device-1",
        "inbound_message",
        { test: "payload" }
      )

      expect(eventId).toBe("event-created-1")
      expect(mockPrisma.whatsappWebhookEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          eventType: "inbound_message",
          metaPayload: { test: "payload" },
          waMessageId: null,
        },
      })
    })

    it("persists the message ID extracted from webhook payloads", async () => {
      mockPrisma.whatsappWebhookEvent.create.mockResolvedValue({
        id: "event-with-message-id",
      } as any)

      await createWebhookEvent("org-1", "device-1", "inbound_message", {
        id: "wamid_persisted",
        from: "+628123456789",
      })

      expect(mockPrisma.whatsappWebhookEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          eventType: "inbound_message",
          metaPayload: {
            id: "wamid_persisted",
            from: "+628123456789",
          },
          waMessageId: "wamid_persisted",
        },
      })
    })
    it("persists the message ID extracted from a full Meta webhook envelope", async () => {
      mockPrisma.whatsappWebhookEvent.create.mockResolvedValue({
        id: "event-with-envelope-message-id",
      } as never)

      const envelopePayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba-1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    phone_number_id: "phone-1",
                  },
                  messages: [
                    {
                      id: "wamid_from_envelope",
                      from: "+628123456789",
                      type: "text",
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      await createWebhookEvent(
        "org-1",
        "device-1",
        "inbound_message",
        envelopePayload
      )

      expect(mockPrisma.whatsappWebhookEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          eventType: "inbound_message",
          metaPayload: envelopePayload,
          waMessageId: "wamid_from_envelope",
        },
      })
    })

    it("returns the created event ID", async () => {
      mockPrisma.whatsappWebhookEvent.create.mockResolvedValue({
        id: "evt-abc-123",
      } as any)

      const eventId = await createWebhookEvent(
        "org-2",
        "device-2",
        "status_update",
        {}
      )

      expect(eventId).toBe("evt-abc-123")
    })

    it("accepts null/empty payload", async () => {
      mockPrisma.whatsappWebhookEvent.create.mockResolvedValue({
        id: "event-empty",
      } as any)

      const eventId = await createWebhookEvent(
        "org-1",
        "device-1",
        "unknown",
        null as any
      )

      expect(eventId).toBe("event-empty")
      expect(mockPrisma.whatsappWebhookEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          whatsappDeviceId: "device-1",
          eventType: "unknown",
          metaPayload: null,
          waMessageId: null,
        },
      })
    })
  })

  describe("recordProcessingResult", () => {
    it("updates status, errorMessage, and processedAt", async () => {
      await recordProcessingResult("event-1", "SUCCESS")

      expect(mockPrisma.whatsappWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: {
          processingStatus: "SUCCESS",
          errorMessage: null,
          processedAt: expect.any(Date),
        },
      })
    })

    it("records error message when status is FAILED", async () => {
      await recordProcessingResult("event-1", "FAILED", "Connection timeout")

      expect(mockPrisma.whatsappWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: {
          processingStatus: "FAILED",
          errorMessage: "Connection timeout",
          processedAt: expect.any(Date),
        },
      })
    })

    it("uses null for errorMessage when not provided", async () => {
      await recordProcessingResult("event-1", "PENDING")

      expect(mockPrisma.whatsappWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "event-1" },
          data: expect.objectContaining({
            processingStatus: "PENDING",
            errorMessage: null,
          }),
        })
      )
    })

    it("sets processedAt to current date", async () => {
      await recordProcessingResult("event-1", "SUCCESS")

      expect(mockPrisma.whatsappWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "event-1" },
          data: expect.objectContaining({
            processedAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe("listWebhookEvents", () => {
    it("returns paginated results with default page/limit", async () => {
      mockPrisma.whatsappWebhookEvent.count.mockResolvedValue(2)
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([
        mockEventRecord,
        mockEventRecord2,
      ] as any)

      const result = await listWebhookEvents({
        organizationId: "org-1",
      })

      expect(result.data).toHaveLength(2)
      expect(result.meta.total).toBe(2)
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(20)
      expect(result.meta.totalPages).toBe(1)
    })

    it("applies orgId filter", async () => {
      await listWebhookEvents({ organizationId: "org-42" })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-42" }),
        })
      )
    })

    it("applies deviceId filter", async () => {
      await listWebhookEvents({
        organizationId: "org-1",
        whatsappDeviceId: "device-99",
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ whatsappDeviceId: "device-99" }),
        })
      )
    })

    it("applies eventType filter", async () => {
      await listWebhookEvents({
        organizationId: "org-1",
        eventType: "inbound_message",
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventType: "inbound_message" }),
        })
      )
    })

    it("applies processingStatus filter", async () => {
      await listWebhookEvents({
        organizationId: "org-1",
        processingStatus: "FAILED",
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ processingStatus: "FAILED" }),
        })
      )
    })

    it("applies date range filter (from and to)", async () => {
      const fromDate = "2026-06-01T00:00:00.000Z"
      const toDate = "2026-06-30T23:59:59.000Z"

      await listWebhookEvents({
        organizationId: "org-1",
        from: fromDate,
        to: toDate,
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(fromDate),
              lte: new Date(toDate),
            },
          }),
        })
      )
    })

    it("applies from date filter when only from is provided", async () => {
      const fromDate = "2026-06-01T00:00:00.000Z"

      await listWebhookEvents({
        organizationId: "org-1",
        from: fromDate,
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date(fromDate),
            }),
          }),
        })
      )
    })

    it("applies to date filter when only to is provided", async () => {
      const toDate = "2026-06-30T23:59:59.000Z"

      await listWebhookEvents({
        organizationId: "org-1",
        to: toDate,
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              lte: new Date(toDate),
            }),
          }),
        })
      )
    })

    it("respects page and limit parameters", async () => {
      mockPrisma.whatsappWebhookEvent.count.mockResolvedValue(50)

      await listWebhookEvents({
        organizationId: "org-1",
        page: 3,
        limit: 10,
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      )
    })

    it("orders by createdAt desc", async () => {
      await listWebhookEvents({ organizationId: "org-1" })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      )
    })

    it("returns empty data array when no events match", async () => {
      mockPrisma.whatsappWebhookEvent.count.mockResolvedValue(0)
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([])

      const result = await listWebhookEvents({
        organizationId: "org-missing",
      })

      expect(result.data).toHaveLength(0)
      expect(result.meta.total).toBe(0)
      expect(result.meta.totalPages).toBe(0)
    })

    it("calculates totalPages correctly", async () => {
      mockPrisma.whatsappWebhookEvent.count.mockResolvedValue(25)

      const result = await listWebhookEvents({
        organizationId: "org-1",
        limit: 10,
      })

      expect(result.meta.totalPages).toBe(3) // ceil(25/10)
    })

    it("uses page=0 as-is (route layer handles clamping)", async () => {
      mockPrisma.whatsappWebhookEvent.count.mockResolvedValue(5)

      await listWebhookEvents({
        organizationId: "org-1",
        page: 0,
        limit: 10,
      })

      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: -10, // (0-1) * 10 — service passes through, route clamps
        })
      )
    })

    it("passes all filters to count query", async () => {
      await listWebhookEvents({
        organizationId: "org-1",
        whatsappDeviceId: "device-1",
        eventType: "inbound_message",
        processingStatus: "PENDING",
      })

      expect(mockPrisma.whatsappWebhookEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: "org-1",
            whatsappDeviceId: "device-1",
            eventType: "inbound_message",
            processingStatus: "PENDING",
          },
        })
      )
    })

    it("includes metaPayload and metadata in list DTO response", async () => {
      mockPrisma.whatsappWebhookEvent.count.mockResolvedValue(1)
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([
        {
          ...mockEventRecord,
          metaPayload: { big: "data" },
          processedAt: null,
        },
      ] as any)

      const result = await listWebhookEvents({
        organizationId: "org-1",
      })

      expect(result.data[0]).toHaveProperty("metaPayload")
      // DTO fields should be present
      expect(result.data[0]).toHaveProperty("id")
      expect(result.data[0]).toHaveProperty("eventType")
      expect(result.data[0]).toHaveProperty("processingStatus")
      expect(result.data[0]).toHaveProperty("createdAt")
      expect(result.data[0]).toHaveProperty("deliveryStatus")
    })
  })
})

describe("extractMessageBody", () => {
  it("extracts button_reply title from interactive payload", () => {
    const result = extractMessageBody({
      from: "628123456789",
      id: "wamid.1",
      timestamp: "1723456789",
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: { id: "btn_help", title: "Need Help" },
      },
    })
    expect(result).toBe("Need Help")
  })

  it("extracts list_reply title from interactive payload", () => {
    const result = extractMessageBody({
      from: "628123456789",
      id: "wamid.2",
      timestamp: "1723456790",
      type: "interactive",
      interactive: {
        type: "list_reply",
        list_reply: {
          id: "svc_k8s",
          title: "Kubernetes Setup",
          description: "K8s setup",
        },
      },
    })
    expect(result).toBe("Kubernetes Setup")
  })

  it("returns text body for text messages", () => {
    const result = extractMessageBody({
      from: "628123456789",
      id: "wamid.3",
      timestamp: "1723456791",
      type: "text",
      text: { body: "Hello" },
    })
    expect(result).toBe("Hello")
  })

  it("returns null for unsupported message types", () => {
    const result = extractMessageBody({
      from: "628123456789",
      id: "wamid.4",
      timestamp: "1723456792",
      type: "unsupported",
    })
    expect(result).toBeNull()
  })

  it("returns null when interactive object is missing", () => {
    const result = extractMessageBody({
      from: "628123456789",
      id: "wamid.5",
      timestamp: "1723456793",
      type: "interactive",
    })
    expect(result).toBeNull()
  })
})
describe("processInboundMessage", () => {
  beforeEach(() => {
    mockPrisma.whatsappConversation.findFirst.mockClear()
    mockPrisma.whatsappConversation.create.mockClear()
    mockPrisma.whatsappConversation.update.mockClear()
    mockPrisma.whatsappMessage.create.mockClear()
    mockPrisma.whatsappContact.upsert.mockClear()
  })

  it("normalizes incoming Indonesian phone numbers to E.164 (+62...)", async () => {
    mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)

    await processInboundMessage(
      {
        from: "6285708296482",
        id: "wamid.inbound.1",
        timestamp: "1787218008",
        type: "text",
        text: { body: "Halo" },
      },
      "device-1",
      "org-1"
    )

    expect(mockPrisma.whatsappConversation.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        contactPhone: { in: ["+6285708296482", "6285708296482"] },
      },
    })

    expect(mockPrisma.whatsappConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        contactPhone: "+6285708296482",
        lastDirection: "INBOX",
        whatsappDeviceId: "device-1",
      }),
    })
  })

  it("updates existing conversation and keeps normalized phone", async () => {
    mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
      id: "existing-conv",
      contactPhone: "6285708296482",
    } as any)

    await processInboundMessage(
      {
        from: "6285708296482",
        id: "wamid.inbound.2",
        timestamp: "1787218009",
        type: "text",
        text: { body: "Halo lagi" },
      },
      "device-1",
      "org-1"
    )

    expect(mockPrisma.whatsappConversation.update).toHaveBeenCalledWith({
      where: { id: "existing-conv" },
      data: expect.objectContaining({
        contactPhone: "+6285708296482",
        lastDirection: "INBOX",
      }),
    })
  })

  it("stores media with CDN URL when S3 CDN is configured", async () => {
    const origCdn = process.env.S3_CDN_URL
    process.env.S3_CDN_URL = "https://cdn.pfnapp.id"

    mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
      id: "conv-1",
      contactPhone: "+6281226622293",
    } as any)
    mockPrisma.whatsappMessage.create.mockResolvedValue({
      id: "msg-sticker-1",
      metadata: {},
    } as any)
    mockPrisma.whatsappMedia.findUnique.mockResolvedValue({
      id: "media-1",
      metaMediaId: "meta-sticker-123",
      organizationId: "org-1",
      mimeType: "image/webp",
      storePath: "/tmp/fake-sticker.webp",
      createdAt: new Date(),
    } as any)

    const tmpFake = "/tmp/fake-sticker.webp"
    fs.writeFileSync(tmpFake, Buffer.from("fake-data"))

    await processInboundMessage(
      {
        from: "6281226622293",
        id: "wamid.sticker.1",
        timestamp: "1787218010",
        type: "sticker",
        sticker: { id: "meta-sticker-123", mime_type: "image/webp" },
      },
      "device-1",
      "org-1"
    )

    expect(mockPrisma.whatsappMessage.create).toHaveBeenCalled()
    fs.unlinkSync(tmpFake)

    if (origCdn) process.env.S3_CDN_URL = origCdn
    else delete process.env.S3_CDN_URL
  })
})
describe("processDeliveryStatus", () => {
  beforeEach(() => {
    mockPrisma.whatsappMessage.findFirst = mock(async () => null)
    mockPrisma.whatsappMessageStatus.create = mock(async () => ({
      id: "status-1",
    }))
    mockPrisma.whatsappBillingLedger.findFirst = mock(async () => null)
    mockPrisma.whatsappBillingLedger.update = mock(async () => ({}))
    mockPrisma.whatsappBillingLedger.updateMany = mock(async () => ({
      count: 1,
    }))
    mockPrisma.whatsappConversation.update = mock(async () => ({}))
  })

  it("confirms billing ledger on successful delivery", async () => {
    mockPrisma.whatsappMessage.findFirst = mock(
      async () =>
        ({
          id: "msg-1",
          conversationId: "conv-1",
          conversation: {
            contactPhone: "6281234567890",
            organizationId: "org-1",
            whatsappDeviceId: "dev-1",
          },
        }) as any
    )
    mockPrisma.whatsappBillingLedger.findFirst = mock(
      async () =>
        ({
          id: "ledger-1",
          waMessageId: "wamid.ok.1",
          status: "CHARGED_PENDING_VERIFY",
        }) as any
    )

    const result = await processDeliveryStatus(
      {
        id: "wamid.ok.1",
        status: "delivered",
        timestamp: "1723456789",
        recipient_id: "6281234567890",
      },
      "dev-1",
      "org-1"
    )

    expect(result.status).toBe("DELIVERED")
    expect(mockPrisma.whatsappBillingLedger.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          waMessageId: "wamid.ok.1",
          status: "CHARGED_PENDING_VERIFY",
        },
        data: {
          status: "CONFIRMED",
          lastStatus: "DELIVERED",
        },
      })
    )
  })

  it("reverts billing ledger on failed delivery", async () => {
    mockPrisma.whatsappMessage.findFirst = mock(
      async () =>
        ({
          id: "msg-1",
          conversationId: "conv-1",
          conversation: {
            contactPhone: "6281234567890",
            organizationId: "org-1",
            whatsappDeviceId: "dev-1",
          },
        }) as any
    )
    mockPrisma.whatsappBillingLedger.findFirst = mock(
      async () =>
        ({
          id: "ledger-1",
          waMessageId: "wamid.fail.1",
          status: "CHARGED_PENDING_VERIFY",
          quotaValue: 1,
          whatsappDeviceId: "dev-1",
        }) as any
    )

    const result = await processDeliveryStatus(
      {
        id: "wamid.fail.1",
        status: "failed",
        timestamp: "1723456789",
        errors: [
          {
            code: 131026,
            title: "Message Undeliverable",
            error_data: { details: "User not found" },
          },
        ],
        recipient_id: "6281234567890",
      },
      "dev-1",
      "org-1"
    )

    expect(result.status).toBe("FAILED")
    expect(mockPrisma.whatsappBillingLedger.update).toHaveBeenCalledWith({
      where: { id: "ledger-1" },
      data: expect.objectContaining({
        isReverted: true,
        status: "REVERTED_FAILED",
        lastStatus: "FAILED",
      }),
    })
  })
})
