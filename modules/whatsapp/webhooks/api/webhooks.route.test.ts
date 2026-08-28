import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { workosNodeMock } from "../../../../test/workos-node-mock"

const mockAuthContext = {
  current: null as {
    organizationId?: string | null
    type: string
    userId?: string
    orgRole?: string | null
    platformRole?: string
  } | null,
}

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const mockWebhookFindMany = mock(() => Promise.resolve([]))
const mockWebhookFindUnique = mock(() => Promise.resolve(null))
const mockWebhookCreate = mock(() => Promise.resolve({}))
const mockWebhookUpdate = mock(() => Promise.resolve({}))
const mockWebhookDelete = mock(() => Promise.resolve({}))
const mockWebhookCount = mock(() => Promise.resolve(0))

const mockDeviceFindUnique = mock(async () => null)
const mockDeviceFindFirst = mock(() => Promise.resolve(null))
const mockEventCreate = mock(() => Promise.resolve({ id: "event-1" }))
const mockEventFindMany = mock(async () => [])
const mockEventCount = mock(async () => 0)

const mockDeliveryLogFindUnique = mock(async () => null)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappWebhook: {
      findMany: mockWebhookFindMany,
      findUnique: mockWebhookFindUnique,
      create: mockWebhookCreate,
      update: mockWebhookUpdate,
      delete: mockWebhookDelete,
      count: mockWebhookCount,
    },
    whatsappDevice: {
      findUnique: mockDeviceFindUnique,
      findFirst: mockDeviceFindFirst,
    },
    whatsappWebhookEvent: {
      create: mockEventCreate,
      findMany: mockEventFindMany,
      count: mockEventCount,
    },
    whatsappWebhookDeliveryLog: {
      findUnique: mockDeliveryLogFindUnique,
    },
  },
}))

const mockListWebhookEvents = mock(() =>
  Promise.resolve({
    data: [{ id: "evt-1" }],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  })
)
const mockHandleIncomingWebhook = mock(() => Promise.resolve({ success: true }))
const mockRecordProcessingResult = mock(() => Promise.resolve())

mock.module("../webhooks.service", () => ({
  listWebhookEvents: mockListWebhookEvents,
  handleIncomingWebhook: mockHandleIncomingWebhook,
  recordProcessingResult: mockRecordProcessingResult,
  createWebhookEvent: mockEventCreate,
}))

const mockGetDeliveryLogs = mock(() =>
  Promise.resolve({
    data: [{ id: "del-1", statusCode: 200 }],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  })
)
const mockResendDelivery = mock(() => Promise.resolve({ success: true }))
const mockDispatch = mock(() => Promise.resolve({}))

mock.module("../webhook-dispatcher.service", () => ({
  webhookDispatcher: {
    getDeliveryLogs: mockGetDeliveryLogs,
    resendDelivery: mockResendDelivery,
    dispatch: mockDispatch,
    resend: mockResendDelivery,
  },
  toDeliveryLogDTO: (log: unknown) => log,
}))

const mockVerifyWebhookSignature = mock(() => true)
mock.module("../services/webhook-hmac.service", () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
}))

const mockJobDispatch = mock(() => Promise.resolve())
mock.module("../jobs/webhook-retry.job", () => ({
  WebhookRetryJob: {
    dispatch: mockJobDispatch,
  },
}))

const { webhooksRoutes } = await import("./webhooks.route")

function createTestApp() {
  return new Elysia().use(webhooksRoutes)
}

function getEventsUrl(
  deviceId: string,
  query: Record<string, string> = {}
): string {
  const params = new URLSearchParams(query).toString()
  return `http://localhost/webhooks/${deviceId}/events${params ? `?${params}` : ""}`
}

const mockDevice = {
  id: "device-1",
  organizationId: "org-1",
  phoneNumber: "+62811111111",
  status: "ACTIVE",
  quotaBase: 1000,
  dailyLimitMessage: 500,
  tokenEncrypted: null,
  tokenIv: null,
  whatsappBusinessAccountId: null,
  whatsappPhoneId: null,
  whatsappApplicationId: null,
  whatsappProfile: null,
  features: null,
  callbackUrl: null,
  expiredAt: null,
  balance: 0,
  quotaBaseOut: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const mockEvent = {
  id: "event-1",
  organizationId: "org-1",
  whatsappDeviceId: "device-1",
  eventType: "inbound_message",
  processingStatus: "SUCCESS",
  metaPayload: { test: "data" },
  waMessageId: null,
  errorMessage: null,
  processedAt: new Date("2026-06-18T12:01:00.000Z"),
  createdAt: new Date("2026-06-18T12:00:00.000Z"),
}

describe("webhooks.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockWebhookFindMany.mockClear()
    mockWebhookFindUnique.mockClear()
    mockWebhookCreate.mockClear()
    mockWebhookUpdate.mockClear()
    mockWebhookDelete.mockClear()
    mockWebhookCount.mockClear()
    mockDeviceFindUnique.mockClear()
    mockDeviceFindFirst.mockClear()
    mockEventCreate.mockClear()
    mockEventFindMany.mockClear()
    mockEventCount.mockClear()
    mockListWebhookEvents.mockClear()
    mockHandleIncomingWebhook.mockClear()
    mockGetDeliveryLogs.mockClear()
    mockResendDelivery.mockClear()
    mockDispatch.mockClear()
    mockJobDispatch.mockClear()
    mockDeliveryLogFindUnique.mockClear()
    app = createTestApp()
  })

  describe("GET /webhooks/events", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await app.handle(
        new Request("http://localhost/webhooks/events")
      )
      expect(res.status).toBe(401)
    })

    it("lists events for organization", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }

      const res = await app.handle(
        new Request("http://localhost/webhooks/events?page=1&limit=10")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toBeDefined()
      expect(mockListWebhookEvents).toHaveBeenCalled()
    })
  })

  describe("GET /webhooks (CRUD)", () => {
    it("lists webhooks for org", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookFindMany.mockResolvedValueOnce([
        { id: "wh-1", webhookUrl: "https://example.com/webhook" },
      ] as unknown as never)
      mockWebhookCount.mockResolvedValueOnce(1)

      const res = await app.handle(new Request("http://localhost/webhooks"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(1)
    })

    it("creates new webhook config", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookCreate.mockResolvedValueOnce({
        id: "wh-new",
        webhookUrl: "https://example.com/endpoint",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deviceId: "dev-1",
            webhookUrl: "https://example.com/endpoint",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.id).toBe("wh-new")
    })

    it("gets single webhook config", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookFindUnique.mockResolvedValueOnce({
        id: "wh-1",
        organizationId: "org-1",
        webhookUrl: "https://example.com/wh",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks/wh-1")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe("wh-1")
    })

    it("updates webhook config", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookFindUnique.mockResolvedValueOnce({
        id: "wh-1",
        organizationId: "org-1",
      } as unknown as never)
      mockWebhookUpdate.mockResolvedValueOnce({
        id: "wh-1",
        webhookUrl: "https://example.com/updated",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks/wh-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            webhookUrl: "https://example.com/updated",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })

    it("deletes webhook config", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookFindUnique.mockResolvedValueOnce({
        id: "wh-1",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks/wh-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("GET /webhooks/:id/deliveries & resend", () => {
    it("returns 404 when webhook not found", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookFindUnique.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/webhooks/wh-404/deliveries")
      )
      expect(res.status).toBe(404)
    })

    it("lists delivery logs", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookFindUnique.mockResolvedValueOnce({
        id: "wh-1",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks/wh-1/deliveries")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(1)
    })

    it("resends a delivery log", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockDeliveryLogFindUnique.mockResolvedValueOnce({
        id: "del-1",
        webhookId: "wh-1",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks/wh-1/deliveries/del-1/resend", {
          method: "POST",
        })
      )
      expect(res.status).toBe(200)
    })
  })

  describe("POST /webhooks/:id/test", () => {
    it("enqueues test dispatch", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockWebhookFindUnique.mockResolvedValueOnce({
        id: "wh-1",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks/wh-1/test", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockDispatch).toHaveBeenCalled()
    })
  })

  describe("GET /webhooks/:id/events (device-scoped events)", () => {
    it("returns 401 without auth", async () => {
      mockAuthContext.current = null

      const response = await app.handle(new Request(getEventsUrl("device-1")))

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 for device from other org", async () => {
      mockAuthContext.current = {
        type: "workos",
        userId: "user_1",
        organizationId: "org-1",
        orgRole: "admin",
        platformRole: "none",
      }
      mockDeviceFindUnique.mockResolvedValueOnce({
        ...mockDevice,
        organizationId: "org-2",
      } as unknown as never)

      const response = await app.handle(
        new Request(getEventsUrl("device-other"))
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when device not found", async () => {
      mockAuthContext.current = {
        type: "workos",
        userId: "user_1",
        organizationId: "org-1",
      }
      mockDeviceFindUnique.mockResolvedValueOnce(null)

      const response = await app.handle(
        new Request(getEventsUrl("device-missing"))
      )

      expect(response.status).toBe(404)
    })

    it("returns paginated events for device", async () => {
      mockAuthContext.current = {
        type: "workos",
        userId: "user_1",
        organizationId: "org-1",
      }
      mockDeviceFindUnique.mockResolvedValueOnce(mockDevice as unknown as never)
      mockListWebhookEvents.mockResolvedValueOnce({
        data: [mockEvent],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      } as unknown as never)

      const response = await app.handle(new Request(getEventsUrl("device-1")))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })
})
