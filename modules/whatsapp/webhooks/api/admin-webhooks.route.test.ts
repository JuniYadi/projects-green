import { beforeEach, describe, expect, it, mock } from "bun:test"
import { createAdminWebhooksRoutes } from "./admin-webhooks.route"

const mockListWebhookEvents = mock(() =>
  Promise.resolve({
    data: [{ id: "evt-1", eventType: "message" }],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  })
)
const mockListDeadLetters = mock(() =>
  Promise.resolve({
    data: [{ id: "dl-1", errorMessage: "Failed after 3 attempts" }],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  })
)
const mockGetDeadLetterById = mock(() => Promise.resolve(null))
const mockReplayDeadLetter = mock(() => Promise.resolve({ success: true }))

mock.module("../webhooks.service", () => ({
  listWebhookEvents: mockListWebhookEvents,
}))

mock.module("../services/webhook-dead-letter.service", () => ({
  listDeadLetters: mockListDeadLetters,
  getDeadLetterById: mockGetDeadLetterById,
  replayDeadLetter: mockReplayDeadLetter,
}))

const mockWebhookFindMany = mock(() => Promise.resolve([]))
const mockWebhookFindUnique = mock(() => Promise.resolve(null))
const mockWebhookCreate = mock(() => Promise.resolve({}))
const mockWebhookUpdate = mock(() => Promise.resolve({}))
const mockWebhookDelete = mock(() => Promise.resolve({}))
const mockWebhookCount = mock(() => Promise.resolve(0))
const mockDeadLetterCount = mock(() => Promise.resolve(0))
const mockDeliveryLogFindUnique = mock(() => Promise.resolve(null))

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
    whatsappWebhookDeadLetter: {
      count: mockDeadLetterCount,
    },
    whatsappWebhookDeliveryLog: {
      findUnique: mockDeliveryLogFindUnique,
    },
  },
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
  },
  toDeliveryLogDTO: (log: unknown) => log,
}))

const mockRequireSuperAdmin = mock((set: { status?: number | string }) => {
  return Promise.resolve({
    userId: "admin-1",
    role: "super_admin",
  } as unknown as never)
})

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

describe("admin-webhooks.route", () => {
  let app: { handle: (req: Request) => Promise<Response> }

  beforeEach(() => {
    mockListWebhookEvents.mockClear()
    mockListDeadLetters.mockClear()
    mockGetDeadLetterById.mockClear()
    mockReplayDeadLetter.mockClear()
    mockWebhookFindMany.mockClear()
    mockWebhookFindUnique.mockClear()
    mockWebhookCreate.mockClear()
    mockWebhookUpdate.mockClear()
    mockWebhookDelete.mockClear()
    mockWebhookCount.mockClear()
    mockDeadLetterCount.mockClear()
    mockDeliveryLogFindUnique.mockClear()
    mockGetDeliveryLogs.mockClear()
    mockResendDelivery.mockClear()
    mockDispatch.mockClear()
    mockRequireSuperAdmin.mockClear()

    app = createAdminWebhooksRoutes({
      requireSuperAdmin: mockRequireSuperAdmin as unknown as never,
    }) as unknown as { handle: (req: Request) => Promise<Response> }
  })

  describe("GET /admin/whatsapp/webhooks/events", () => {
    it("lists webhook events for admin", async () => {
      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/events?limit=10")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        data: [{ id: "evt-1", eventType: "message" }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      })
    })

    it("returns error if admin guard fails", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(
        async (set: { status?: number | string }) => {
          set.status = 403
          return {
            ok: false,
            error: "FORBIDDEN",
            message: "Super admin only",
          } as unknown as never
        }
      )

      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/events")
      )

      expect(res.status).toBe(403)
    })
  })

  describe("GET /admin/whatsapp/webhooks/dead-letter", () => {
    it("lists dead letters", async () => {
      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/dead-letter")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        data: [{ id: "dl-1", errorMessage: "Failed after 3 attempts" }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      })
    })

    it("gets dead letter stats", async () => {
      mockDeadLetterCount.mockResolvedValueOnce(10)

      const res = await app.handle(
        new Request(
          "http://localhost/admin/whatsapp/webhooks/dead-letter/stats"
        )
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        data: { recentFailures: 10, windowMinutes: 60 },
      })
    })

    it("gets single dead letter detail and handles 404", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce(null)

      const res404 = await app.handle(
        new Request(
          "http://localhost/admin/whatsapp/webhooks/dead-letter/dl-404"
        )
      )
      expect(res404.status).toBe(404)

      mockGetDeadLetterById.mockResolvedValueOnce({
        id: "dl-1",
        deviceId: "dev-1",
        eventType: "message",
        rawPayload: { from: "62812" },
        errorMessage: "Err",
        attemptCount: 3,
        failedAt: new Date().toISOString(),
        replayedAt: null,
        replayStatus: "PENDING",
      } as unknown as never)

      const res200 = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/dead-letter/dl-1")
      )
      expect(res200.status).toBe(200)
    })

    it("replays dead letter", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce({
        id: "dl-1",
      } as unknown as never)
      mockReplayDeadLetter.mockResolvedValueOnce({
        success: true,
      } as unknown as never)

      const res = await app.handle(
        new Request(
          "http://localhost/admin/whatsapp/webhooks/dead-letter/dl-1/replay",
          { method: "POST" }
        )
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        message: "Webhook re-enqueued for processing",
      })
    })
  })

  describe("CRUD /admin/whatsapp/webhooks", () => {
    it("lists webhooks with filters", async () => {
      mockWebhookFindMany.mockResolvedValueOnce([
        { id: "wh-1", webhookUrl: "https://example.com/webhook" },
      ] as unknown as never)
      mockWebhookCount.mockResolvedValueOnce(1)

      const res = await app.handle(
        new Request(
          "http://localhost/admin/whatsapp/webhooks?organizationId=org-1"
        )
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })

    it("creates webhook", async () => {
      mockWebhookCreate.mockResolvedValueOnce({
        id: "wh-created",
        webhookUrl: "https://example.com/hook",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            webhookUrl: "https://example.com/hook",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        data: { id: "wh-created", webhookUrl: "https://example.com/hook" },
      })
    })

    it("updates and deletes webhook", async () => {
      mockWebhookFindUnique
        .mockResolvedValueOnce({ id: "wh-1" } as unknown as never)
        .mockResolvedValueOnce({ id: "wh-1" } as unknown as never)

      mockWebhookUpdate.mockResolvedValueOnce({
        id: "wh-1",
        webhookUrl: "https://example.com/updated",
      } as unknown as never)

      const patchRes = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/wh-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ webhookUrl: "https://example.com/updated" }),
        })
      )
      expect(patchRes.status).toBe(200)

      const delRes = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/wh-1", {
          method: "DELETE",
        })
      )
      expect(delRes.status).toBe(200)
    })

    it("gets delivery logs for webhook", async () => {
      mockWebhookFindUnique.mockResolvedValueOnce({
        id: "wh-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/wh-1/deliveries")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        data: [{ id: "del-1", statusCode: 200 }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      })
    })

    it("resends delivery log and tests ping", async () => {
      mockDeliveryLogFindUnique.mockResolvedValueOnce({
        id: "del-1",
        webhookId: "wh-1",
      } as unknown as never)
      mockResendDelivery.mockResolvedValueOnce({
        success: true,
      } as unknown as never)

      const resendRes = await app.handle(
        new Request(
          "http://localhost/admin/whatsapp/webhooks/wh-1/deliveries/del-1/resend",
          { method: "POST" }
        )
      )
      expect(resendRes.status).toBe(200)

      mockWebhookFindUnique.mockResolvedValueOnce({
        id: "wh-1",
      } as unknown as never)
      mockDispatch.mockResolvedValueOnce({} as unknown as never)

      const testRes = await app.handle(
        new Request("http://localhost/admin/whatsapp/webhooks/wh-1/test", {
          method: "POST",
        })
      )
      expect(testRes.status).toBe(200)
    })
  })
})
