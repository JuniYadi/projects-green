import { beforeEach, describe, expect, mock, test } from "bun:test"

const now = new Date("2026-08-22T00:00:00.000Z")
const mockMessageCount = mock(async () => 0)
const mockMessageAggregate = mock(async () => ({
  _sum: { promptTokens: 0, responseTokens: 0 },
}))
const mockMessageFindMany = mock(async () => [])
const mockSessionCount = mock(async () => 0)
const mockSessionAggregate = mock(async () => ({
  _sum: { strikeCount: 0 },
}))
const mockSessionFindMany = mock(async () => [])
const mockSessionFindFirst = mock(async () => null)
const mockBanCount = mock(async () => 0)
const mockBanFindMany = mock(async () => [])
const mockBanFindUnique = mock(async () => null)
const mockBanCreate = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "ban_created",
  createdAt: now,
  blockedUntil: null,
  ...args.data,
}))
const mockBanUpdate = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "ban_1",
  targetValue: "user_1",
  pardonedAt: now,
  ...args.data,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiChatMessage: {
      count: mockMessageCount,
      aggregate: mockMessageAggregate,
      findMany: mockMessageFindMany,
    },
    aiChatSession: {
      count: mockSessionCount,
      aggregate: mockSessionAggregate,
      findMany: mockSessionFindMany,
      findFirst: mockSessionFindFirst,
    },
    aiChatBan: {
      count: mockBanCount,
      findMany: mockBanFindMany,
      findUnique: mockBanFindUnique,
      create: mockBanCreate,
      update: mockBanUpdate,
    },
  },
}))

// Dynamic import is required so the Prisma module mock is registered first.
const { createAdminAiRoutes } = await import("./admin-ai.route")

const mockRequireSuperAdmin = mock(async () => ({
  ok: true as const,
  userId: "admin_user_123",
}))

beforeEach(() => {
  mockRequireSuperAdmin.mockClear()
  mockMessageCount.mockClear()
  mockMessageAggregate.mockClear()
  mockMessageFindMany.mockClear()
  mockSessionCount.mockClear()
  mockSessionAggregate.mockClear()
  mockSessionFindMany.mockClear()
  mockSessionFindFirst.mockClear()
  mockBanCount.mockClear()
  mockBanFindMany.mockClear()
  mockBanFindUnique.mockClear()
  mockBanCreate.mockClear()
  mockBanUpdate.mockClear()

  mockMessageCount.mockResolvedValue(0)
  mockMessageAggregate.mockResolvedValue({
    _sum: { promptTokens: 0, responseTokens: 0 },
  })
  mockMessageFindMany.mockResolvedValue([])
  mockSessionCount.mockResolvedValue(0)
  mockSessionAggregate.mockResolvedValue({ _sum: { strikeCount: 0 } })
  mockSessionFindMany.mockResolvedValue([])
  mockSessionFindFirst.mockResolvedValue(null)
  mockBanCount.mockResolvedValue(0)
  mockBanFindMany.mockResolvedValue([])
  mockBanFindUnique.mockResolvedValue(null)
})

const createRoutes = () =>
  createAdminAiRoutes({ requireSuperAdmin: mockRequireSuperAdmin })

describe("Admin AI Governance Routes (/api/admin/ai)", () => {
  test("GET /stats returns KPI metrics and token burn calculation", async () => {
    const res = await createRoutes().handle(
      new Request("http://localhost/admin/ai/stats")
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.tokens).toBeDefined()
    expect(typeof json.data.totalQueries24h).toBe("number")
    expect(typeof json.data.totalQueries30d).toBe("number")
    expect(Array.isArray(json.data.recentFlaggedFeed)).toBe(true)
  })

  test("GET /sessions returns paginated sessions", async () => {
    const res = await createRoutes().handle(
      new Request("http://localhost/admin/ai/sessions?page=1&limit=10")
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data.sessions)).toBe(true)
    expect(json.data.pagination.page).toBe(1)
  })

  test("GET /sessions/:sessionId returns 404 for unknown session", async () => {
    const res = await createRoutes().handle(
      new Request("http://localhost/admin/ai/sessions/nonexistent_session_id")
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
  })

  test("GET /bans bounds the active bans query", async () => {
    const res = await createRoutes().handle(
      new Request("http://localhost/admin/ai/bans")
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data.bans)).toBe(true)
    expect(mockBanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  test("POST /bans/create inserts a new ban record", async () => {
    const res = await createRoutes().handle(
      new Request("http://localhost/admin/ai/bans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banType: "IP",
          targetValue: "192.168.1.100",
          durationHours: 24,
          isPermanent: false,
          reason: "Spam prompt flood",
        }),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.targetValue).toBe("192.168.1.100")
    expect(json.data.banType).toBe("IP")
  })

  test("POST /bans/pardon preserves the original ban reason", async () => {
    mockBanFindUnique.mockResolvedValueOnce({
      id: "ban_1",
      targetValue: "user_1",
      reason: "Original strike reason",
    } as never)

    const res = await createRoutes().handle(
      new Request("http://localhost/admin/ai/bans/pardon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banId: "ban_1",
          reason: "Appeal approved",
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockBanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ reason: expect.anything() }),
      })
    )
  })

  test("returns 403 when user is not super admin", async () => {
    const forbiddenGuard = mock(async (set: { status?: number | string }) => {
      set.status = 403
      return {
        ok: false as const,
        error: "FORBIDDEN",
        message: "Forbidden",
      }
    })
    const routes = createAdminAiRoutes({ requireSuperAdmin: forbiddenGuard })

    const res = await routes.handle(
      new Request("http://localhost/admin/ai/stats")
    )

    expect(res.status).toBe(403)
  })
})
