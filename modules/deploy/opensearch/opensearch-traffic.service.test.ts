import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockPrisma = {
  applicationStack: {
    findFirst: mock(),
    findMany: mock(),
  },
  appHostingDailyTrafficSnapshot: {
    findUnique: mock(),
    findMany: mock(),
    upsert: mock(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockResolveClusterIntegration = mock()
mock.module("../cluster-integration.service", () => ({
  resolveClusterIntegrationByClusterCode: mockResolveClusterIntegration,
}))

// Dynamic import required after mock.module setup in Bun test
const {
  formatBytes,
  computeDailyTrafficSnapshotFromOpenSearch,
  getAppTrafficReport,
  getLiveTrafficLogs,
} = await import("./opensearch-traffic.service")

describe("opensearch-traffic.service", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockResolveClusterIntegration.mockResolvedValue({
      endpoint: "https://mock-opensearch:9200",
      username: "user",
      password: "pwd",
      sslVerify: true,
    })
  })

  describe("formatBytes", () => {
    it("formats bytes accurately into human readable units", () => {
      expect(formatBytes(0)).toBe("0 B")
      expect(formatBytes(1024)).toBe("1.0 KB")
      expect(formatBytes(1048576)).toBe("1.0 MB")
      expect(formatBytes(BigInt(1073741824))).toBe("1.0 GB")
    })
  })

  describe("computeDailyTrafficSnapshotFromOpenSearch", () => {
    it("computes calendar day traffic metrics from OpenSearch aggregations", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
        organizationId: "org_1",
        clusterId: "cl_sgp",
        cluster: { code: "sgp" },
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            aggregations: {
              status_codes: {
                buckets: [
                  { key: 200, doc_count: 100 },
                  { key: 404, doc_count: 5 },
                  { key: 503, doc_count: 2 },
                ],
              },
              avg_latency: { value: 45.4 },
              total_bytes: { value: 204800 },
              hourly_trend: {
                buckets: [
                  {
                    key_as_string: "2026-09-10T00:00:00.000Z",
                    doc_count: 10,
                    errors: { doc_count: 0 },
                  },
                  {
                    key_as_string: "2026-09-10T01:00:00.000Z",
                    doc_count: 20,
                    errors: { doc_count: 1 },
                  },
                ],
              },
              top_paths: {
                buckets: [{ key: "/home", doc_count: 80 }],
              },
              error_paths: {
                paths: {
                  buckets: [
                    {
                      key: "/missing",
                      doc_count: 5,
                      sample_status: { buckets: [{ key: 404 }] },
                    },
                  ],
                },
              },
            },
          },
        })),
      }

      const result = await computeDailyTrafficSnapshotFromOpenSearch(
        "my-app",
        new Date("2026-09-10T12:00:00Z"),
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )

      expect(result.stackId).toBe("st_123")
      expect(result.totalRequests).toBe(107)
      expect(result.successCount).toBe(100)
      expect(result.errorCount).toBe(7)
      expect(result.avgLatencyMs).toBe(45)
      expect(result.totalBytes).toBe(BigInt(204800))
      expect(result.hourlyTrend.length).toBe(2)
      expect(result.topPaths).toEqual([{ path: "/home", views: 80 }])
      expect(result.errorPaths).toEqual([
        { path: "/missing", errors: 5, sampleStatus: 404 },
      ])
    })
  })

  describe("getAppTrafficReport", () => {
    it("returns daily report from database snapshot", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })

      mockPrisma.appHostingDailyTrafficSnapshot.findUnique.mockResolvedValue({
        id: "snap_1",
        stackId: "st_123",
        date: new Date(Date.UTC(2026, 8, 10)),
        totalRequests: 1000,
        successCount: 990,
        errorCount: 10,
        totalBytes: BigInt(5000000),
        avgLatencyMs: 30,
        hourlyTrendJson: [
          { hour: 0, requests: 50, errors: 0 },
          { hour: 1, requests: 100, errors: 1 },
        ],
        topPathsJson: [{ path: "/api", views: 500 }],
        errorPathsJson: [{ path: "/api/bad", errors: 10, sampleStatus: 400 }],
      })

      const report = await getAppTrafficReport("my-app", {
        granularity: "daily",
        date: "2026-09-10",
      })

      expect(report.granularity).toBe("daily")
      expect(report.totalRequests).toBe(1000)
      expect(report.successRate).toBe(99)
      expect(report.avgLatencyMs).toBe(30)
      expect(report.trend[0].requests).toBe(50)
      expect(report.trend[1].requests).toBe(100)
      expect(report.topPages).toEqual([{ path: "/api", views: 500 }])
      expect(report.troubledPages).toEqual([
        { path: "/api/bad", errors: 10, sampleStatus: 400 },
      ])
    })

    it("returns monthly rolled up report across daily snapshots", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })

      mockPrisma.appHostingDailyTrafficSnapshot.findMany.mockResolvedValue([
        {
          id: "snap_1",
          stackId: "st_123",
          date: new Date(Date.UTC(2026, 8, 1)),
          totalRequests: 100,
          successCount: 95,
          errorCount: 5,
          totalBytes: BigInt(100000),
          avgLatencyMs: 20,
          topPathsJson: [{ path: "/page1", views: 50 }],
          errorPathsJson: [],
        },
        {
          id: "snap_2",
          stackId: "st_123",
          date: new Date(Date.UTC(2026, 8, 2)),
          totalRequests: 200,
          successCount: 190,
          errorCount: 10,
          totalBytes: BigInt(200000),
          avgLatencyMs: 40,
          topPathsJson: [
            { path: "/page1", views: 80 },
            { path: "/page2", views: 70 },
          ],
          errorPathsJson: [{ path: "/err", errors: 10, sampleStatus: 500 }],
        },
      ])

      const report = await getAppTrafficReport("my-app", {
        granularity: "monthly",
        month: "2026-09",
      })

      expect(report.granularity).toBe("monthly")
      expect(report.totalRequests).toBe(300)
      expect(report.successRate).toBe(95)
      expect(report.trend.length).toBe(30)
      expect(report.topPages[0]).toEqual({ path: "/page1", views: 130 })
      expect(report.troubledPages).toEqual([
        { path: "/err", errors: 10, sampleStatus: 500 },
      ])
    })

    it("returns yearly rolled up report across monthly buckets", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })

      mockPrisma.appHostingDailyTrafficSnapshot.findMany.mockResolvedValue([
        {
          id: "snap_1",
          stackId: "st_123",
          date: new Date(Date.UTC(2026, 0, 15)), // Jan
          totalRequests: 1000,
          successCount: 990,
          errorCount: 10,
          totalBytes: BigInt(5000000),
          avgLatencyMs: 25,
          topPathsJson: [{ path: "/v1", views: 400 }],
          errorPathsJson: [],
        },
        {
          id: "snap_2",
          stackId: "st_123",
          date: new Date(Date.UTC(2026, 1, 10)), // Feb
          totalRequests: 2000,
          successCount: 1960,
          errorCount: 40,
          totalBytes: BigInt(10000000),
          avgLatencyMs: 30,
          topPathsJson: [{ path: "/v1", views: 800 }],
          errorPathsJson: [],
        },
      ])

      const report = await getAppTrafficReport("my-app", {
        granularity: "yearly",
        year: "2026",
      })

      expect(report.granularity).toBe("yearly")
      expect(report.totalRequests).toBe(3000)
      expect(report.trend[0]).toEqual({
        label: "Jan",
        requests: 1000,
        errors: 10,
      })
      expect(report.trend[1]).toEqual({
        label: "Feb",
        requests: 2000,
        errors: 40,
      })
    })
  })

  describe("getLiveTrafficLogs", () => {
    it("returns micro-batch of recent logs formatted into DTO items", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            hits: {
              total: { value: 1 },
              hits: [
                {
                  _id: "doc-1",
                  _source: {
                    "@timestamp": "2026-09-11T00:00:00.000Z",
                    http_method: "GET",
                    http_path: "/api/hello",
                    http_status: 200,
                    response_time_ms: 12,
                    bytes_read: 512,
                    client_ip: "1.2.3.4",
                  },
                },
              ],
            },
          },
        })),
      }

      const res = await getLiveTrafficLogs(
        "my-app",
        { limit: 10, status: "2xx" },
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )
      expect(res.logs.length).toBe(1)
      expect(res.logs[0]).toEqual({
        id: "doc-1",
        timestamp: "2026-09-11T00:00:00.000Z",
        method: "GET",
        path: "/api/hello",
        statusCode: 200,
        latencyMs: 12,
        bytes: 512,
        clientIp: "1.2.3.4",
      })
    })
    it("filters logs by status 4xx and 5xx correctly", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })

      const mockClient = {
        search: mock(async () => ({
          body: { hits: { total: 0, hits: [] } },
        })),
      }

      await getLiveTrafficLogs(
        "my-app",
        { limit: 10, status: "4xx", since: "2026-09-11T00:00:00Z" },
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )
      await getLiveTrafficLogs(
        "my-app",
        { limit: 10, status: "5xx" },
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )
      expect(mockClient.search).toHaveBeenCalledTimes(2)
    })

    it("handles OpenSearch search error gracefully by returning empty list", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })
      const mockClient = {
        search: mock(async () => {
          throw new Error("Cluster unreachable")
        }),
      }
      const res = await getLiveTrafficLogs(
        "my-app",
        {},
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )
      expect(res.logs).toEqual([])
      expect(res.total).toBe(0)
    })
  })

  describe("saveDailyTrafficSnapshot and processDailyTrafficSnapshotsJob", () => {
    it("saves snapshot to database via upsert", async () => {
      const { saveDailyTrafficSnapshot } =
        await import("./opensearch-traffic.service")
      await saveDailyTrafficSnapshot({
        stackId: "st_123",
        date: new Date(Date.UTC(2026, 8, 10)),
        totalRequests: 50,
        successCount: 48,
        errorCount: 2,
        totalBytes: BigInt(5000),
        avgLatencyMs: 25,
        hourlyTrend: [],
        topPaths: [],
        errorPaths: [],
      })
      expect(
        mockPrisma.appHostingDailyTrafficSnapshot.upsert
      ).toHaveBeenCalled()
    })

    it("processes all running stacks in daily cron job", async () => {
      const { processDailyTrafficSnapshotsJob } =
        await import("./opensearch-traffic.service")
      mockPrisma.applicationStack.findMany.mockResolvedValue([
        { id: "st_1", slug: "app-1" },
        { id: "st_2", slug: "app-2" },
      ])
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_1",
        slug: "app-1",
        name: "App 1",
        organizationId: "org_1",
        clusterId: "cl_1",
        cluster: { code: "sgp" },
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            aggregations: {
              status_codes: { buckets: [] },
            },
          },
        })),
      }

      const summary = await processDailyTrafficSnapshotsJob(
        new Date("2026-09-10")
      )
      expect(summary.processed).toBeGreaterThanOrEqual(1)
    })
  })
})
