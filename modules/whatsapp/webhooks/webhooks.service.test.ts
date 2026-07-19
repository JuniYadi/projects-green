import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

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
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const {
  createWebhookEvent,
  recordProcessingResult,
  listWebhookEvents,
  extractMessageBody,
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

    it("excludes metaPayload from list DTO response", async () => {
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

      expect(result.data[0]).not.toHaveProperty("metaPayload")
      // DTO fields should be present
      expect(result.data[0]).toHaveProperty("id")
      expect(result.data[0]).toHaveProperty("eventType")
      expect(result.data[0]).toHaveProperty("processingStatus")
      expect(result.data[0]).toHaveProperty("createdAt")
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
