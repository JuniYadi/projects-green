import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  mockAuthContext,
  setMockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"

const mockWebhookEventCount = mock(async () => 0)
const mockDeadLetterCount = mock(async () => 0)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappWebhookEvent: {
      count: mockWebhookEventCount,
    },
    whatsappWebhookDeadLetter: {
      count: mockDeadLetterCount,
    },
  },
}))

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const mockListDeadLetters = mock(async () => ({
  data: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
}))
const mockGetDeadLetterById = mock(async (): Promise<unknown> => null)
const mockReplayDeadLetter = mock(async () => {})

mock.module("../services/webhook-dead-letter.service", () => ({
  listDeadLetters: mockListDeadLetters,
  getDeadLetterById: mockGetDeadLetterById,
  replayDeadLetter: mockReplayDeadLetter,
}))

const { webhookDeadLetterRoutes } = await import("./webhook-dead-letter.route")

function createTestApp() {
  return new Elysia().use(webhookDeadLetterRoutes)
}

function deadLetterUrl(path = "", query: Record<string, string> = {}): string {
  const qs = new URLSearchParams(query).toString()
  return `http://localhost/whatsapp/webhooks/dead-letter${path}${qs ? `?${qs}` : ""}`
}

describe("webhook-dead-letter.route", () => {
  beforeEach(() => {
    mockWebhookEventCount.mockClear()
    mockDeadLetterCount.mockClear()
    mockListDeadLetters.mockClear()
    mockGetDeadLetterById.mockClear()
    mockReplayDeadLetter.mockClear()

    setMockAuthContext({
      type: "workos",
      userId: "user_1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  describe("GET /whatsapp/webhooks/dead-letter", () => {
    it("returns 401 without auth", async () => {
      setMockAuthContext(null)
      const app = createTestApp()

      const res = await app.handle(new Request(deadLetterUrl()))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when organizationId is missing", async () => {
      setMockAuthContext({
        type: "workos",
        userId: "user_no_org",
        email: "user@example.com",
        organizationId: null,
        orgRole: null,
        platformRole: "none",
      })
      const app = createTestApp()

      const res = await app.handle(new Request(deadLetterUrl()))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("lists dead letters with default pagination and filters", async () => {
      const mockResult = {
        data: [{ id: "dl-1", reason: "TIMEOUT" }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }
      mockListDeadLetters.mockResolvedValueOnce(mockResult as never)

      const app = createTestApp()
      const res = await app.handle(new Request(deadLetterUrl()))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toEqual(mockResult.data)
      expect(body.meta).toEqual(mockResult.meta)

      expect(mockListDeadLetters).toHaveBeenCalledWith({
        organizationId: "org-1",
        deviceId: undefined,
        eventType: undefined,
        replayStatus: undefined,
        from: undefined,
        to: undefined,
        page: 1,
        limit: 20,
      })
    })

    it("passes query parameters for deviceId, eventType, replayStatus, date range, page, and limit", async () => {
      mockListDeadLetters.mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 2, limit: 50, totalPages: 0 },
      } as never)

      const app = createTestApp()
      const res = await app.handle(
        new Request(
          deadLetterUrl("", {
            deviceId: "dev-123",
            eventType: "message.inbound",
            replayStatus: "FAILED",
            from: "2026-01-01T00:00:00Z",
            to: "2026-01-31T23:59:59Z",
            page: "2",
            limit: "50",
          })
        )
      )

      expect(res.status).toBe(200)
      expect(mockListDeadLetters).toHaveBeenCalledWith({
        organizationId: "org-1",
        deviceId: "dev-123",
        eventType: "message.inbound",
        replayStatus: "FAILED",
        from: "2026-01-01T00:00:00Z",
        to: "2026-01-31T23:59:59Z",
        page: 2,
        limit: 50,
      })
    })
  })

  describe("GET /whatsapp/webhooks/dead-letter/stats", () => {
    it("returns 401 without auth", async () => {
      setMockAuthContext(null)
      const app = createTestApp()

      const res = await app.handle(new Request(deadLetterUrl("/stats")))
      expect(res.status).toBe(401)
    })

    it("returns 403 when organizationId is missing", async () => {
      setMockAuthContext({
        type: "workos",
        userId: "user_no_org",
        email: "user@example.com",
        organizationId: null,
        orgRole: null,
        platformRole: "none",
      })
      const app = createTestApp()

      const res = await app.handle(new Request(deadLetterUrl("/stats")))
      expect(res.status).toBe(403)
    })

    it("calculates failure stats with deviceId filter", async () => {
      mockWebhookEventCount
        .mockResolvedValueOnce(100) // totalEvents
        .mockResolvedValueOnce(5) // failedEvents
      mockDeadLetterCount.mockResolvedValueOnce(2) // deadLetters

      const app = createTestApp()
      const res = await app.handle(
        new Request(deadLetterUrl("/stats", { deviceId: "dev-1" }))
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.totalEvents).toBe(100)
      expect(body.data.failedEvents).toBe(5)
      expect(body.data.deadLetters).toBe(2)
      expect(body.data.failureRate).toBe(5)
    })

    it("handles zero totalEvents gracefully (0% failure rate)", async () => {
      mockWebhookEventCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      mockDeadLetterCount.mockResolvedValueOnce(0)

      const app = createTestApp()
      const res = await app.handle(new Request(deadLetterUrl("/stats")))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.failureRate).toBe(0)
    })
  })

  describe("GET /whatsapp/webhooks/dead-letter/:id", () => {
    it("returns 401 without auth", async () => {
      setMockAuthContext(null)
      const app = createTestApp()

      const res = await app.handle(new Request(deadLetterUrl("/dl-123")))
      expect(res.status).toBe(401)
    })

    it("returns 403 when organizationId is missing", async () => {
      setMockAuthContext({
        type: "workos",
        userId: "user_no_org",
        email: "user@example.com",
        organizationId: null,
        orgRole: null,
        platformRole: "none",
      })
      const app = createTestApp()

      const res = await app.handle(new Request(deadLetterUrl("/dl-123")))
      expect(res.status).toBe(403)
    })

    it("returns 404 if dead letter is not found", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce(null)

      const app = createTestApp()
      const res = await app.handle(new Request(deadLetterUrl("/dl-missing")))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 403 if dead letter belongs to another organization", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce({
        id: "dl-other",
        organizationId: "org-other",
      } as never)

      const app = createTestApp()
      const res = await app.handle(new Request(deadLetterUrl("/dl-other")))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns dead letter detail on success", async () => {
      const mockRecord = {
        id: "dl-123",
        organizationId: "org-1",
        reason: "TIMEOUT",
      }
      mockGetDeadLetterById.mockResolvedValueOnce(mockRecord as never)

      const app = createTestApp()
      const res = await app.handle(new Request(deadLetterUrl("/dl-123")))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toEqual(mockRecord)
    })
  })

  describe("POST /whatsapp/webhooks/dead-letter/:id/replay", () => {
    it("returns 401 without auth", async () => {
      setMockAuthContext(null)
      const app = createTestApp()

      const res = await app.handle(
        new Request(deadLetterUrl("/dl-123/replay"), { method: "POST" })
      )
      expect(res.status).toBe(401)
    })

    it("returns 403 when organizationId is missing", async () => {
      setMockAuthContext({
        type: "workos",
        userId: "user_no_org",
        email: "user@example.com",
        organizationId: null,
        orgRole: null,
        platformRole: "none",
      })
      const app = createTestApp()

      const res = await app.handle(
        new Request(deadLetterUrl("/dl-123/replay"), { method: "POST" })
      )
      expect(res.status).toBe(403)
    })

    it("returns 404 if dead letter not found", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce(null)

      const app = createTestApp()
      const res = await app.handle(
        new Request(deadLetterUrl("/dl-missing/replay"), { method: "POST" })
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 403 if dead letter belongs to another organization", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce({
        id: "dl-other",
        organizationId: "org-other",
      } as never)

      const app = createTestApp()
      const res = await app.handle(
        new Request(deadLetterUrl("/dl-other/replay"), { method: "POST" })
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("replays dead letter successfully", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce({
        id: "dl-123",
        organizationId: "org-1",
      } as never)

      const app = createTestApp()
      const res = await app.handle(
        new Request(deadLetterUrl("/dl-123/replay"), { method: "POST" })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.message).toBe("Dead letter re-enqueued for replay.")
      expect(mockReplayDeadLetter).toHaveBeenCalledWith("dl-123")
    })

    it("returns 500 when replay service throws", async () => {
      mockGetDeadLetterById.mockResolvedValueOnce({
        id: "dl-123",
        organizationId: "org-1",
      } as never)
      mockReplayDeadLetter.mockRejectedValueOnce(new Error("Queue error"))

      const app = createTestApp()
      const res = await app.handle(
        new Request(deadLetterUrl("/dl-123/replay"), { method: "POST" })
      )

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("REPLAY_FAILED")
      expect(body.message).toBe("Queue error")
    })
  })
})
