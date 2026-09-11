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

const mockGetAppLogReport = mock()
const mockGetAppLogErrorsDrilldown = mock()
mock.module("../../opensearch/opensearch-log-health.service", () => ({
  getAppLogReport: mockGetAppLogReport,
  getAppLogErrorsDrilldown: mockGetAppLogErrorsDrilldown,
}))

const { appLogHealthRoutes } = await import("./app-log-health.route")

describe("app-log-health.route", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockWithAuth.mockResolvedValue({
      user: { id: "u1", email: "user@example.com" },
      organizationId: "org_1",
    })
    mockGetPlatformRoleForUser.mockResolvedValue("member")
  })

  describe("GET /deploy/apps/:slug/logs/report", () => {
    it("returns 401 when not authenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null })
      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/logs/report")
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when stack is not found in organization", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null)
      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/unknown-app/logs/report")
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe("NOT_FOUND")
    })

    it("returns log health report when stack exists", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppLogReport.mockResolvedValueOnce({
        granularity: "daily",
        periodLabel: "11 Sep 2026",
        totalLogs: 1200,
        infoCount: 1150,
        warnCount: 30,
        errorCount: 20,
        healthScore: 98,
        trend: [],
        topErrors: [],
      })

      const res = await appLogHealthRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/logs/report?granularity=daily&date=2026-09-11"
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.healthScore).toBe(98)
    })

    it("allows super_admin to access stack across organizations", async () => {
      mockGetPlatformRoleForUser.mockResolvedValueOnce("super_admin")
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_2",
        slug: "admin-app",
      })
      mockGetAppLogReport.mockResolvedValueOnce({
        granularity: "monthly",
        periodLabel: "September 2026",
        totalLogs: 5000,
        infoCount: 4900,
        warnCount: 50,
        errorCount: 50,
        healthScore: 99,
        trend: [],
        topErrors: [],
      })

      const res = await appLogHealthRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/admin-app/logs/report?granularity=monthly"
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })

    it("returns 500 when log report service throws an error", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppLogReport.mockRejectedValueOnce(new Error("Service error"))

      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/logs/report")
      )
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe("LOG_REPORT_FAILED")
    })
  })

  describe("GET /deploy/apps/:slug/logs/errors", () => {
    it("returns 401 when not authenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null })
      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/logs/errors")
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when stack is not found", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null)
      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/unknown-app/logs/errors")
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe("NOT_FOUND")
    })

    it("returns 500 when drilldown service throws an error", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppLogErrorsDrilldown.mockRejectedValueOnce(
        new Error("Drilldown error")
      )

      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/logs/errors")
      )
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe("LOG_ERRORS_DRILLDOWN_FAILED")
    })

    it("guards against non-numeric limit query parameter", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppLogErrorsDrilldown.mockResolvedValueOnce({
        errors: [],
        totalDistinct: 0,
      })

      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/logs/errors?limit=abc")
      )
      expect(res.status).toBe(200)
      expect(mockGetAppLogErrorsDrilldown).toHaveBeenCalledWith("my-app", {
        limit: 50,
        from: undefined,
        to: undefined,
      })
    })

    it("returns on-demand error drilldown list", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppLogErrorsDrilldown.mockResolvedValueOnce({
        errors: [
          {
            signature: "ConnectionTimeout",
            count: 12,
            sampleMessage: "Timeout",
          },
        ],
        totalDistinct: 1,
      })

      const res = await appLogHealthRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/logs/errors?limit=20")
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data[0].signature).toBe("ConnectionTimeout")
    })
  })
})
