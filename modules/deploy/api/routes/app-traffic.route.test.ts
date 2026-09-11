import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockWithAuth = mock()
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockGetPlatformRoleForUser = mock()
mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRoleForUser,
}))

const mockPrisma = {
  applicationStack: {
    findFirst: mock(),
  },
}
mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockGetAppTrafficReport = mock()
const mockGetLiveTrafficLogs = mock()
mock.module("../../opensearch/opensearch-traffic.service", () => ({
  getAppTrafficReport: mockGetAppTrafficReport,
  getLiveTrafficLogs: mockGetLiveTrafficLogs,
}))

const { appTrafficRoutes } = await import("./app-traffic.route")

describe("app-traffic.route", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockWithAuth.mockResolvedValue({
      user: { id: "u1", email: "user@example.com" },
      organizationId: "org_1",
    })
    mockGetPlatformRoleForUser.mockResolvedValue("member")
  })

  describe("GET /deploy/apps/:slug/traffic/report", () => {
    it("returns 401 when not authenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null })
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/report")
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when stack is not found in organization", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null)
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/unknown-app/traffic/report")
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe("NOT_FOUND")
    })

    it("returns traffic report when stack exists", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppTrafficReport.mockResolvedValueOnce({
        granularity: "daily",
        periodLabel: "10 Sep 2026",
        totalRequests: 500,
        successRate: 98.5,
        avgLatencyMs: 35,
        totalBytes: 204800,
        totalBytesFormatted: "200.0 KB",
        trend: [],
        topPages: [],
        troubledPages: [],
      })

      const res = await appTrafficRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/traffic/report?granularity=daily&date=2026-09-10"
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.totalRequests).toBe(500)
      expect(mockGetAppTrafficReport).toHaveBeenCalledWith("my-app", {
        granularity: "daily",
        date: "2026-09-10",
        month: undefined,
        year: undefined,
      })
    })

    it("allows super_admin to access stack across organizations", async () => {
      mockGetPlatformRoleForUser.mockResolvedValueOnce("super_admin")
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_2",
        slug: "admin-app",
      })
      mockGetAppTrafficReport.mockResolvedValueOnce({
        granularity: "monthly",
        periodLabel: "September 2026",
        totalRequests: 15000,
        successRate: 99.1,
        avgLatencyMs: 40,
        totalBytes: 50000000,
        totalBytesFormatted: "47.7 MB",
        trend: [],
        topPages: [],
        troubledPages: [],
      })

      const res = await appTrafficRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/admin-app/traffic/report?granularity=monthly&month=2026-09"
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.totalRequests).toBe(15000)
    })
  })

  describe("GET /deploy/apps/:slug/traffic/logs", () => {
    it("returns 401 when not authenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null })
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/logs")
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe("UNAUTHORIZED")
    })

    it("returns live traffic logs sample", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetLiveTrafficLogs.mockResolvedValueOnce({
        logs: [
          {
            id: "l1",
            timestamp: "2026-09-11T00:00:00.000Z",
            method: "GET",
            path: "/checkout",
            statusCode: 200,
            latencyMs: 15,
            bytes: 1024,
            clientIp: "123.45.67.89",
          },
        ],
        total: 1,
      })

      const res = await appTrafficRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/traffic/logs?limit=10&status=2xx"
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.length).toBe(1)
      expect(data.data[0].path).toBe("/checkout")
      expect(mockGetLiveTrafficLogs).toHaveBeenCalledWith("my-app", {
        limit: 10,
        since: undefined,
        status: "2xx",
      })
    })
  })
})
