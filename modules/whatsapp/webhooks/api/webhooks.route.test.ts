import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { workosNodeMock } from "../../../../test/workos-node-mock"

const mockAuthContext = {
  current: null as {
    organizationId?: string
    type: string
    userId?: string
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

const mockDeviceFindFirst = mock(() => Promise.resolve(null))
const mockEventCreate = mock(() => Promise.resolve({}))
const mockEventFindMany = mock(() => Promise.resolve([]))
const mockEventCount = mock(() => Promise.resolve(0))

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
      findFirst: mockDeviceFindFirst,
    },
    whatsappWebhookEvent: {
      create: mockEventCreate,
      findMany: mockEventFindMany,
      count: mockEventCount,
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
    data: [],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  })
)
const mockResendDelivery = mock(() => Promise.resolve({ success: true }))
const mockDispatch = mock(() => Promise.resolve({}))

mock.module("../webhook-dispatcher.service", () => ({
  webhookDispatcher: {
    getDeliveryLogs: mockGetDeliveryLogs,
    resendDelivery: mockResendDelivery,
    dispatch: mockDispatch,
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
    mockDeviceFindFirst.mockClear()
    mockEventCreate.mockClear()
    mockEventFindMany.mockClear()
    mockListWebhookEvents.mockClear()
    mockHandleIncomingWebhook.mockClear()
    mockGetDeliveryLogs.mockClear()
    mockResendDelivery.mockClear()
    mockDispatch.mockClear()
    mockJobDispatch.mockClear()
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

  describe("GET /webhooks/:id (Meta Verification GET)", () => {
    it("handles Meta webhook verification challenge", async () => {
      mockDeviceFindFirst.mockResolvedValueOnce({
        id: "dev-1",
        webhookVerifyToken: "my-verify-token",
      } as unknown as never)

      const res = await app.handle(
        new Request(
          "http://localhost/webhooks/dev-1/verify?hub.mode=subscribe&hub.verify_token=my-verify-token&hub.challenge=CHALLENGE_CODE"
        )
      )

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe("CHALLENGE_CODE")
    })
  })
})
