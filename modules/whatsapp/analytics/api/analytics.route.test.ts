import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { workosNodeMock } from "../../../../test/workos-node-mock"

const mockAuthContext = {
  current: null as {
    organizationId: string
    type: string
    userId: string
  } | null,
}

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {},
}))

const mockSyncAnalytics = mock(() => Promise.resolve({ synced: true }))
const mockGetComparisonReport = mock(() =>
  Promise.resolve({ totalMessages: 100 })
)
const mockGetCostReconciliation = mock(() =>
  Promise.resolve({ reconciled: true })
)

mock.module("../analytics.service", () => ({
  analyticsService: {
    syncAnalytics: mockSyncAnalytics,
    getComparisonReport: mockGetComparisonReport,
    getCostReconciliation: mockGetCostReconciliation,
  },
}))

const { analyticsRoutes } = await import("./analytics.route")

function createTestApp() {
  return new Elysia().use(analyticsRoutes)
}

describe("analytics.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockSyncAnalytics.mockClear()
    mockGetComparisonReport.mockClear()
    mockGetCostReconciliation.mockClear()
    app = createTestApp()
  })

  describe("POST /analytics/sync", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuthContext.current = null

      const res = await app.handle(
        new Request("http://localhost/analytics/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Auth required.",
      })
    })

    it("returns 422 when body validation fails", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }

      const res = await app.handle(
        new Request("http://localhost/analytics/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId: "" }),
        })
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toBe("VALIDATION_ERROR")
    })

    it("syncs analytics successfully", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockSyncAnalytics.mockResolvedValueOnce({
        synced: 15,
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/analytics/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deviceId: "dev-1",
            startDate: "2026-08-01",
            endDate: "2026-08-28",
            granularity: "DAY",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true, synced: 15 })
    })

    it("returns 400 when sync fails with error", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockSyncAnalytics.mockRejectedValueOnce(
        new Error("Meta rate limit reached")
      )

      const res = await app.handle(
        new Request("http://localhost/analytics/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deviceId: "dev-1",
            startDate: "2026-08-01",
            endDate: "2026-08-28",
          }),
        })
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({
        ok: false,
        error: "SYNC_FAILED",
        message: "Meta rate limit reached",
      })
    })
  })

  describe("GET /analytics/report", () => {
    it("returns comparison report for authenticated user", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockGetComparisonReport.mockResolvedValueOnce({
        totalMessages: 50,
      } as unknown as never)

      const res = await app.handle(
        new Request(
          "http://localhost/analytics/report?deviceId=dev-1&startDate=2026-08-01&endDate=2026-08-28"
        )
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true, totalMessages: 50 })
    })
  })

  describe("GET /analytics/cost-reconciliation", () => {
    it("returns cost reconciliation report", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockGetCostReconciliation.mockResolvedValueOnce({
        reconciled: true,
      } as unknown as never)

      const res = await app.handle(
        new Request(
          "http://localhost/analytics/cost-reconciliation?deviceId=dev-1&startDate=2026-08-01&endDate=2026-08-28"
        )
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true, reconciled: true })
    })
  })
})
