import { describe, expect, test, mock, beforeEach } from "bun:test"
import { createAdminAiRoutes } from "./admin-ai.route"
import { prisma } from "@/lib/prisma"

const mockRequireSuperAdmin = mock(async () => ({
  ok: true as const,
  userId: "admin_user_123",
}))

describe("Admin AI Governance Routes (/api/admin/ai)", () => {
  beforeEach(() => {
    mockRequireSuperAdmin.mockClear()
  })

  test("GET /stats returns KPI metrics and token burn calculation", async () => {
    const routes = createAdminAiRoutes({
      requireSuperAdmin: mockRequireSuperAdmin,
    })

    const res = await routes.handle(
      new Request("http://localhost/admin/ai/stats")
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toBeDefined()
    expect(json.data.tokens).toBeDefined()
    expect(typeof json.data.totalQueries24h).toBe("number")
    expect(typeof json.data.totalQueries30d).toBe("number")
    expect(Array.isArray(json.data.recentFlaggedFeed)).toBe(true)
  })

  test("GET /sessions returns paginated sessions", async () => {
    const routes = createAdminAiRoutes({
      requireSuperAdmin: mockRequireSuperAdmin,
    })

    const res = await routes.handle(
      new Request("http://localhost/admin/ai/sessions?page=1&limit=10")
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data.sessions)).toBe(true)
    expect(json.data.pagination).toBeDefined()
    expect(json.data.pagination.page).toBe(1)
  })

  test("GET /sessions/:sessionId returns 404 for unknown session", async () => {
    const routes = createAdminAiRoutes({
      requireSuperAdmin: mockRequireSuperAdmin,
    })

    const res = await routes.handle(
      new Request("http://localhost/admin/ai/sessions/nonexistent_session_id")
    )
    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
  })

  test("GET /bans returns active bans list", async () => {
    const routes = createAdminAiRoutes({
      requireSuperAdmin: mockRequireSuperAdmin,
    })

    const res = await routes.handle(
      new Request("http://localhost/admin/ai/bans")
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data.bans)).toBe(true)
  })

  test("POST /bans/create inserts a new ban record", async () => {
    const routes = createAdminAiRoutes({
      requireSuperAdmin: mockRequireSuperAdmin,
    })

    const res = await routes.handle(
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

  test("POST /bans/pardon unlocks banned target", async () => {
    const routes = createAdminAiRoutes({
      requireSuperAdmin: mockRequireSuperAdmin,
    })

    // Create a temporary ban directly
    const ban = await prisma.aiChatBan.create({
      data: {
        banType: "USER",
        targetValue: "test_user_to_pardon",
        reason: "Test strike ban",
        isPermanent: true,
      },
    })

    const res = await routes.handle(
      new Request("http://localhost/admin/ai/bans/pardon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banId: ban.id,
          reason: "User requested appeal and approved",
        }),
      })
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.id).toBe(ban.id)

    // Cleanup
    await prisma.aiChatBan.delete({ where: { id: ban.id } })
  })

  test("Returns 403 Forbidden when user is not super admin", async () => {
    const forbiddenGuard = mock(async (set: { status?: number | string }) => {
      set.status = 403
      return {
        ok: false as const,
        error: "FORBIDDEN",
        message: "Forbidden",
      }
    })

    const routes = createAdminAiRoutes({
      requireSuperAdmin: forbiddenGuard,
    })

    const res = await routes.handle(
      new Request("http://localhost/admin/ai/stats")
    )
    expect(res.status).toBe(403)
  })
})
