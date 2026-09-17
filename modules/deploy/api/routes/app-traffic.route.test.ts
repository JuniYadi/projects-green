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
const mockGetAppTrafficIps = mock()
const mockGetAppTrafficIpDetail = mock()
mock.module("../../opensearch/opensearch-traffic.service", () => ({
  getAppTrafficReport: mockGetAppTrafficReport,
  getLiveTrafficLogs: mockGetLiveTrafficLogs,
  getAppTrafficIps: mockGetAppTrafficIps,
  getAppTrafficIpDetail: mockGetAppTrafficIpDetail,
}))

const mockBlockIpAddress = mock()
const mockUnblockIpAddress = mock()
const mockListAppIpBlocks = mock()
mock.module("../../ip-block/ip-block.service", () => ({
  blockIpAddress: mockBlockIpAddress,
  unblockIpAddress: mockUnblockIpAddress,
  listAppIpBlocks: mockListAppIpBlocks,
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

    it("guards against non-numeric limit parameter gracefully", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetLiveTrafficLogs.mockResolvedValueOnce({
        logs: [],
        total: 0,
      })

      const res = await appTrafficRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/traffic/logs?limit=invalid_abc"
        )
      )
      expect(res.status).toBe(200)
      expect(mockGetLiveTrafficLogs).toHaveBeenCalledWith("my-app", {
        limit: 25,
        since: undefined,
        status: undefined,
      })
    })

    it("returns 500 when service throws an error", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetLiveTrafficLogs.mockRejectedValueOnce(new Error("Service failure"))

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/logs")
      )
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe("TRAFFIC_LOGS_FAILED")
    })

    it("returns 500 when report service throws an error", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppTrafficReport.mockRejectedValueOnce(new Error("DB failure"))

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/report")
      )
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe("TRAFFIC_REPORT_FAILED")
    })
  })

  describe("GET /deploy/apps/:slug/traffic/ips", () => {
    it("returns 401 when not authenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null })
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/ips")
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when stack is not found", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null)
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/unknown-app/traffic/ips")
      )
      expect(res.status).toBe(404)
    })

    it("returns paginated traffic IPs with query filters", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppTrafficIps.mockResolvedValueOnce({
        items: [
          {
            ip: "10.0.0.1",
            countryCode: "SG",
            countryName: "Singapore",
            requestsCount: 100,
            percentage: 50,
            status2xx: 90,
            status3xx: 5,
            status4xx: 5,
            status5xx: 0,
            successRatio: 90,
            primaryClient: "Chrome",
            primaryDevice: "desktop",
            signal: "likely_human",
            confidence: 80,
            reasons: ["Normal navigation"],
            isBlocked: false,
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
        otherRequestCount: 50,
        coveragePercentage: 66.7,
      })

      const res = await appTrafficRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/traffic/ips?page=1&limit=10&signal=likely_human"
        )
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.items[0].ip).toBe("10.0.0.1")
      expect(body.data.coveragePercentage).toBe(66.7)
      expect(mockGetAppTrafficIps).toHaveBeenCalledWith(
        "my-app",
        expect.objectContaining({
          page: 1,
          limit: 10,
          signal: "likely_human",
        })
      )
    })

    it("returns 500 when service throws an error", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppTrafficIps.mockRejectedValueOnce(
        new Error("OpenSearch query failure")
      )

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/ips")
      )
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe("TRAFFIC_IPS_FAILED")
    })
  })

  describe("GET /deploy/apps/:slug/traffic/ips/:ip", () => {
    it("returns 401 when not authenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null })
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/ips/10.0.0.1")
      )
      expect(res.status).toBe(401)
    })

    it("returns 400 for invalid IP address format", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppTrafficIpDetail.mockRejectedValueOnce(
        new Error("Invalid IP address: 'not-an-ip'.")
      )

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/ips/not-an-ip")
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe("INVALID_IP_ADDRESS")
    })

    it("returns IP detailed evidence when valid", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        slug: "my-app",
      })
      mockGetAppTrafficIpDetail.mockResolvedValueOnce({
        ip: "10.0.0.1",
        countryCode: "SG",
        countryName: "Singapore",
        totalRequests: 50,
        statusCounts: {
          status2xx: 45,
          status3xx: 0,
          status4xx: 5,
          status5xx: 0,
        },
        successRate: 90,
        signal: {
          classification: "likely_human",
          confidence: 85,
          reasons: ["Standard browser navigation"],
        },
        pathsByStatus: {
          status2xx: [{ path: "/home", count: 45 }],
          status3xx: [],
          status4xx: [{ path: "/404", count: 5 }],
          status5xx: [],
        },
        userAgents: [
          {
            raw: "Mozilla/5.0 ... Chrome/120",
            browser: "Chrome",
            os: "Windows",
            device: "desktop",
            count: 50,
          },
        ],
        timeline: [
          { timestamp: "2026-09-16T10:00:00.000Z", requests: 50, errors: 5 },
        ],
        firstSeen: "2026-09-16T10:00:00.000Z",
        lastSeen: "2026-09-16T10:30:00.000Z",
        velocity: { maxRpm: 1.5, isBurst: false },
        staticAssetShare: 20,
        blockInfo: null,
      })

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/ips/10.0.0.1")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.ip).toBe("10.0.0.1")
      expect(body.data.signal.classification).toBe("likely_human")
      expect(body.data.pathsByStatus.status2xx[0].path).toBe("/home")
    })
  })

  describe("GET /deploy/apps/:slug/traffic/blocks", () => {
    it("returns 401 when unauthenticated", async () => {
      mockWithAuth.mockResolvedValueOnce({ user: null })
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/blocks")
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when stack is not found", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce(null)
      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/unknown-app/traffic/blocks")
      )
      expect(res.status).toBe(404)
    })

    it("returns list of blocks when stack exists", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        organizationId: "org_1",
      })
      mockListAppIpBlocks.mockResolvedValueOnce([
        {
          id: "blk_1",
          ipAddress: "198.51.100.1",
          reason: "Repeated scanner",
          status: "active",
        },
      ])

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/blocks")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.length).toBe(1)
      expect(body.data[0].ipAddress).toBe("198.51.100.1")
    })
  })

  describe("POST /deploy/apps/:slug/traffic/blocks", () => {
    it("creates active block successfully", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        organizationId: "org_1",
      })
      mockBlockIpAddress.mockResolvedValueOnce({
        id: "blk_10",
        ipAddress: "198.51.100.55",
        reason: "Scanner probe",
        status: "active",
        durationMinutes: 1440,
      })

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ipAddress: "198.51.100.55",
            reason: "Scanner probe",
            duration: "24h",
          }),
        })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.status).toBe("active")
    })

    it("returns 400 when invalid input is provided", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        organizationId: "org_1",
      })
      mockBlockIpAddress.mockRejectedValueOnce(
        new Error(
          "Invalid IP address: 'not-an-ip'. Only exact IPv4 or IPv6 addresses are accepted."
        )
      )

      const res = await appTrafficRoutes.handle(
        new Request("http://localhost/deploy/apps/my-app/traffic/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ipAddress: "not-an-ip",
            reason: "Malicious traffic",
            duration: "1h",
          }),
        })
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe("INVALID_BLOCK_REQUEST")
    })
  })

  describe("DELETE /deploy/apps/:slug/traffic/blocks/:ip", () => {
    it("revokes block successfully", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        organizationId: "org_1",
      })
      mockUnblockIpAddress.mockResolvedValueOnce({
        id: "blk_10",
        ipAddress: "198.51.100.55",
        status: "revoked",
      })

      const res = await appTrafficRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/traffic/blocks/198.51.100.55",
          { method: "DELETE" }
        )
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.status).toBe("revoked")
    })

    it("returns 404 when block does not exist", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValueOnce({
        id: "st_1",
        organizationId: "org_1",
      })
      mockUnblockIpAddress.mockRejectedValueOnce(
        new Error("No active or pending block found for IP: 198.51.100.99")
      )

      const res = await appTrafficRoutes.handle(
        new Request(
          "http://localhost/deploy/apps/my-app/traffic/blocks/198.51.100.99",
          { method: "DELETE" }
        )
      )
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("BLOCK_NOT_FOUND")
    })
  })
})
