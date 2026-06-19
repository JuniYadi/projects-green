import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  setMockAuthContext,
  mockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"

// ---------------------------------------------------------------------------
// Mock leaf dependencies: prisma + resolve-proxy-auth
// ---------------------------------------------------------------------------

const mockDeviceFindUnique = mock(async (): Promise<any> => null)
const mockWebhookEventCount = mock(async () => 0)
const mockWebhookEventFindMany = mock(async (): Promise<any[]> => [])
const mockWebhookEventCreate = mock(async () => ({ id: "event-1" }))
const mockWebhookEventUpdate = mock(async () => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findUnique: mockDeviceFindUnique,
    },
    whatsappWebhookEvent: {
      count: mockWebhookEventCount,
      findMany: mockWebhookEventFindMany,
      create: mockWebhookEventCreate,
      update: mockWebhookEventUpdate,
    },
  },
}))

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const { webhooksRoutes } = await import("./webhooks.route")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  quotaBaseIn: 0,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("webhooks routes — GET /:id/events", () => {
  beforeEach(() => {
    mockDeviceFindUnique.mockClear()
    mockWebhookEventCount.mockClear()
    mockWebhookEventFindMany.mockClear()
    mockWebhookEventCreate.mockClear()
    mockWebhookEventUpdate.mockClear()

    // Default auth — authenticated as org-1 member
    setMockAuthContext({
      type: "workos",
      userId: "user_1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })

    // Default mocks
    mockDeviceFindUnique.mockResolvedValue(mockDevice)
    mockWebhookEventCount.mockResolvedValue(1)
    mockWebhookEventFindMany.mockResolvedValue([mockEvent])
  })

  // ── Auth guards ──────────────────────────────────────────────────────────

  it("returns 401 without auth", async () => {
    setMockAuthContext(null)

    const app = createTestApp()

    const response = await app.handle(new Request(getEventsUrl("device-1")))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 for device from other org", async () => {
    mockDeviceFindUnique.mockResolvedValue({
      ...mockDevice,
      organizationId: "org-2",
    })

    const app = createTestApp()

    const response = await app.handle(new Request(getEventsUrl("device-other")))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("FORBIDDEN")
  })

  it("allows super_admin to access any org device", async () => {
    mockDeviceFindUnique.mockResolvedValue({
      ...mockDevice,
      organizationId: "org-other",
    })
    setMockAuthContext({
      type: "workos",
      userId: "super_1",
      email: "super@admin.com",
      organizationId: null,
      orgRole: null,
      platformRole: "super_admin",
    })

    const app = createTestApp()

    const response = await app.handle(new Request(getEventsUrl("device-other")))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  // ── Device not found ─────────────────────────────────────────────────────

  it("returns 404 when device not found", async () => {
    mockDeviceFindUnique.mockResolvedValue(null)

    const app = createTestApp()

    const response = await app.handle(
      new Request(getEventsUrl("device-missing"))
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("NOT_FOUND")
    expect(body.message).toContain("Device not found")
  })

  // ── Successful response ──────────────────────────────────────────────────

  it("returns paginated events for a device", async () => {
    const app = createTestApp()

    const response = await app.handle(new Request(getEventsUrl("device-1")))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("event-1")
    expect(body.data[0].eventType).toBe("inbound_message")
    expect(body.data[0].processingStatus).toBe("SUCCESS")
    expect(body.meta.total).toBe(1)
    expect(body.meta.page).toBe(1)
    expect(body.meta.limit).toBe(20)
  })

  it("returns empty data when no events", async () => {
    mockWebhookEventCount.mockResolvedValue(0)
    mockWebhookEventFindMany.mockResolvedValue([])

    const app = createTestApp()

    const response = await app.handle(new Request(getEventsUrl("device-1")))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(0)
    expect(body.meta.total).toBe(0)
  })

  // ── Query filters ────────────────────────────────────────────────────────

  it('filters by event type via "type" query param', async () => {
    const app = createTestApp()

    await app.handle(
      new Request(getEventsUrl("device-1", { type: "inbound_message" }))
    )

    expect(mockWebhookEventCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventType: "inbound_message" }),
      })
    )
  })

  it('filters by processing status via "status" query param', async () => {
    const app = createTestApp()

    await app.handle(
      new Request(getEventsUrl("device-1", { status: "FAILED" }))
    )

    expect(mockWebhookEventCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ processingStatus: "FAILED" }),
      })
    )
  })

  it('filters by date range via "from" and "to" query params', async () => {
    const app = createTestApp()

    await app.handle(
      new Request(
        getEventsUrl("device-1", {
          from: "2026-06-01T00:00:00.000Z",
          to: "2026-06-30T23:59:59.000Z",
        })
      )
    )

    expect(mockWebhookEventCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
            lte: new Date("2026-06-30T23:59:59.000Z"),
          },
        }),
      })
    )
  })

  it('respects "page" and "limit" query params', async () => {
    const app = createTestApp()

    await app.handle(
      new Request(getEventsUrl("device-1", { page: "3", limit: "10" }))
    )

    expect(mockWebhookEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20, // (3-1) * 10
        take: 10,
      })
    )
  })

  it("clamps limit to max 100 when excessive", async () => {
    const app = createTestApp()

    await app.handle(new Request(getEventsUrl("device-1", { limit: "999" })))

    // findMany after the service clamps it
    expect(mockWebhookEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  it("uses page=1 when page param is 0 or negative", async () => {
    const app = createTestApp()

    await app.handle(new Request(getEventsUrl("device-1", { page: "0" })))

    // Route uses Math.max(Number(query.page) || 1, 1)
    // Number("0") = 0 → 0 || 1 = 1 → Math.max(1, 1) = 1
    expect(mockWebhookEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 })
    )
  })

  it("uses limit=20 when limit param is missing", async () => {
    const app = createTestApp()

    await app.handle(new Request(getEventsUrl("device-1")))

    expect(mockWebhookEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    )
  })

  // ── Verify device lookup ─────────────────────────────────────────────────

  it("looks up device by id from params", async () => {
    const app = createTestApp()

    await app.handle(new Request(getEventsUrl("device-special")))

    expect(mockDeviceFindUnique).toHaveBeenCalledWith({
      where: { id: "device-special" },
      select: { organizationId: true },
    })
  })

  // ── Ordering ─────────────────────────────────────────────────────────────

  it("orders events by createdAt desc", async () => {
    const app = createTestApp()

    await app.handle(new Request(getEventsUrl("device-1")))

    expect(mockWebhookEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    )
  })
})
