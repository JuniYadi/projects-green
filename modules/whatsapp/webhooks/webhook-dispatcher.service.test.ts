import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWebhookFindUnique = mock(async () => null)
const mockWebhookFindMany = mock(async () => [])
const mockDeliveryLogFindUnique = mock(async () => null)
const mockDeliveryLogFindMany = mock(async () => [])
const mockDeliveryLogCount = mock(async () => 0)
const mockDeliveryLogUpdate = mock(async () => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappWebhook: {
      findUnique: mockWebhookFindUnique,
      findMany: mockWebhookFindMany,
    },
    whatsappWebhookDeliveryLog: {
      findUnique: mockDeliveryLogFindUnique,
      findMany: mockDeliveryLogFindMany,
      count: mockDeliveryLogCount,
      update: mockDeliveryLogUpdate,
    },
  },
}))

const mockEnqueueOutgoingWebhook = mock(async () => {})
mock.module("@/lib/queue/whatsapp-webhook-outgoing", () => ({
  enqueueOutgoingWebhook: mockEnqueueOutgoingWebhook,
}))

const { webhookDispatcher, toDeliveryLogDTO } =
  await import("./webhook-dispatcher.service")

describe("webhook-dispatcher.service", () => {
  beforeEach(() => {
    mockWebhookFindUnique.mockClear()
    mockWebhookFindMany.mockClear()
    mockDeliveryLogFindUnique.mockClear()
    mockDeliveryLogFindMany.mockClear()
    mockDeliveryLogCount.mockClear()
    mockDeliveryLogUpdate.mockClear()
    mockEnqueueOutgoingWebhook.mockClear()
  })

  describe("toDeliveryLogDTO", () => {
    it("maps all properties correctly", () => {
      const date = new Date()
      const rawLog = {
        id: "log-1",
        webhookId: "wh-1",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        eventType: "message.received",
        triggerEventId: "evt-123",
        status: "SUCCESS" as const,
        attempt: 1,
        maxAttempts: 3,
        requestUrl: "https://example.com/hook",
        responseStatus: 200,
        responseBody: '{"ok":true}',
        errorMessage: null,
        resolvedAt: null,
        startedAt: date,
        completedAt: date,
        createdAt: date,
        requestHeaders: { "x-test": "val" },
        requestBody: { hello: "world" },
      }

      const dto = toDeliveryLogDTO(rawLog as any)

      expect(dto).toEqual({
        id: "log-1",
        webhookId: "wh-1",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        eventType: "message.received",
        triggerEventId: "evt-123",
        status: "SUCCESS",
        attempt: 1,
        maxAttempts: 3,
        requestUrl: "https://example.com/hook",
        responseStatus: 200,
        responseBody: '{"ok":true}',
        errorMessage: null,
        resolvedAt: null,
        startedAt: date,
        completedAt: date,
        createdAt: date,
      })
    })
  })

  describe("dispatch", () => {
    it("dispatches event when webhook exists", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce({
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
      } as any)

      await webhookDispatcher.dispatch(
        "wh-1",
        "message.received",
        { text: "hello" },
        "trig-1"
      )

      expect(mockWebhookFindUnique).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        select: { organizationId: true, whatsappDeviceId: true },
      })
      expect(mockEnqueueOutgoingWebhook).toHaveBeenCalledWith({
        webhookId: "wh-1",
        organizationId: "org-1",
        deviceId: "dev-1",
        eventType: "message.received",
        eventId: "trig-1",
        payload: { text: "hello" },
      })
    })

    it("skips dispatch when webhook not found", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce(null)

      await webhookDispatcher.dispatch("wh-none", "message.received", {})

      expect(mockWebhookFindUnique).toHaveBeenCalled()
      expect(mockEnqueueOutgoingWebhook).not.toHaveBeenCalled()
    })
  })

  describe("dispatchForDevice", () => {
    it("enqueues outgoing webhook for each active webhook on device", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        { id: "wh-1", organizationId: "org-1" },
        { id: "wh-2", organizationId: "org-1" },
      ] as any)

      await webhookDispatcher.dispatchForDevice(
        "dev-1",
        "message.sent",
        { id: "msg-1" },
        "trig-2"
      )

      expect(mockWebhookFindMany).toHaveBeenCalledWith({
        where: { whatsappDeviceId: "dev-1", active: true },
      })
      expect(mockEnqueueOutgoingWebhook).toHaveBeenCalledTimes(2)
      expect(mockEnqueueOutgoingWebhook).toHaveBeenCalledWith({
        webhookId: "wh-1",
        organizationId: "org-1",
        deviceId: "dev-1",
        eventType: "message.sent",
        eventId: "trig-2",
        payload: { id: "msg-1" },
      })
      expect(mockEnqueueOutgoingWebhook).toHaveBeenCalledWith({
        webhookId: "wh-2",
        organizationId: "org-1",
        deviceId: "dev-1",
        eventType: "message.sent",
        eventId: "trig-2",
        payload: { id: "msg-1" },
      })
    })

    it("does nothing when device has no active webhooks", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([])

      await webhookDispatcher.dispatchForDevice("dev-empty", "message.sent", {
        id: "msg-1",
      })

      expect(mockWebhookFindMany).toHaveBeenCalledWith({
        where: { whatsappDeviceId: "dev-empty", active: true },
      })
      expect(mockEnqueueOutgoingWebhook).not.toHaveBeenCalled()
    })
  })

  describe("getDeliveryLogs", () => {
    it("returns paginated results with default pagination", async () => {
      const mockLog = {
        id: "log-1",
        webhookId: "wh-1",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        eventType: "message.received",
        triggerEventId: null,
        status: "SUCCESS",
        attempt: 1,
        maxAttempts: 3,
        requestUrl: "https://example.com",
        responseStatus: 200,
        responseBody: "ok",
        errorMessage: null,
        resolvedAt: null,
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
      }

      mockDeliveryLogCount.mockResolvedValueOnce(15)
      mockDeliveryLogFindMany.mockResolvedValueOnce([mockLog] as any)

      const result = await webhookDispatcher.getDeliveryLogs("wh-1", {})

      expect(mockDeliveryLogCount).toHaveBeenCalledWith({
        where: { webhookId: "wh-1" },
      })
      expect(mockDeliveryLogFindMany).toHaveBeenCalledWith({
        where: { webhookId: "wh-1" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      })

      expect(result.meta).toEqual({
        total: 15,
        page: 1,
        limit: 20,
        totalPages: 1,
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe("log-1")
    })

    it("applies eventType, status, from, to, and custom pagination filters", async () => {
      mockDeliveryLogCount.mockResolvedValueOnce(50)
      mockDeliveryLogFindMany.mockResolvedValueOnce([])

      const fromDate = "2026-01-01T00:00:00.000Z"
      const toDate = "2026-01-31T23:59:59.000Z"

      const result = await webhookDispatcher.getDeliveryLogs("wh-1", {
        eventType: "message.sent",
        status: "FAILED",
        from: fromDate,
        to: toDate,
        page: 2,
        limit: 10,
      })

      expect(mockDeliveryLogCount).toHaveBeenCalledWith({
        where: {
          webhookId: "wh-1",
          eventType: "message.sent",
          status: "FAILED",
          createdAt: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        },
      })
      expect(mockDeliveryLogFindMany).toHaveBeenCalledWith({
        where: {
          webhookId: "wh-1",
          eventType: "message.sent",
          status: "FAILED",
          createdAt: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        },
        orderBy: { createdAt: "desc" },
        skip: 10,
        take: 10,
      })

      expect(result.meta).toEqual({
        total: 50,
        page: 2,
        limit: 10,
        totalPages: 5,
      })
    })

    it("applies only from or only to date filter", async () => {
      mockDeliveryLogCount.mockResolvedValueOnce(0)
      mockDeliveryLogFindMany.mockResolvedValueOnce([])

      const fromDate = "2026-01-01T00:00:00.000Z"
      await webhookDispatcher.getDeliveryLogs("wh-1", { from: fromDate })

      expect(mockDeliveryLogCount).toHaveBeenCalledWith({
        where: {
          webhookId: "wh-1",
          createdAt: {
            gte: new Date(fromDate),
          },
        },
      })
    })
  })

  describe("resendDelivery", () => {
    it("resends a failed delivery log successfully", async () => {
      const mockLog = {
        id: "log-failed-1",
        webhookId: "wh-1",
        organizationId: "org-1",
        whatsappDeviceId: "dev-1",
        eventType: "message.received",
        triggerEventId: "evt-10",
        requestBody: { text: "retry me" },
        status: "FAILED",
      }

      mockDeliveryLogFindUnique.mockResolvedValueOnce(mockLog as any)

      await webhookDispatcher.resendDelivery("log-failed-1")

      expect(mockDeliveryLogFindUnique).toHaveBeenCalledWith({
        where: { id: "log-failed-1" },
      })
      expect(mockDeliveryLogUpdate).toHaveBeenCalledWith({
        where: { id: "log-failed-1" },
        data: expect.objectContaining({
          status: "PENDING",
          attempt: 0,
          errorMessage: null,
          completedAt: null,
          resolvedAt: expect.any(Date),
        }),
      })
      expect(mockEnqueueOutgoingWebhook).toHaveBeenCalledWith({
        webhookId: "wh-1",
        organizationId: "org-1",
        deviceId: "dev-1",
        eventType: "message.received",
        eventId: "evt-10",
        payload: { text: "retry me" },
      })
    })

    it("throws error when delivery log does not exist", async () => {
      mockDeliveryLogFindUnique.mockResolvedValueOnce(null)

      await expect(
        webhookDispatcher.resendDelivery("log-nonexistent")
      ).rejects.toThrow("Delivery log not found: log-nonexistent")
      expect(mockDeliveryLogUpdate).not.toHaveBeenCalled()
    })

    it("throws error when attempting to resend a successful delivery", async () => {
      mockDeliveryLogFindUnique.mockResolvedValueOnce({
        id: "log-success",
        status: "SUCCESS",
      } as unknown as Parameters<
        typeof mockDeliveryLogFindUnique.mockResolvedValueOnce
      >[0])
      await expect(
        webhookDispatcher.resendDelivery("log-success")
      ).rejects.toThrow("Cannot resend a successful delivery")
      expect(mockDeliveryLogUpdate).not.toHaveBeenCalled()
      expect(mockEnqueueOutgoingWebhook).not.toHaveBeenCalled()
    })
  })
})
