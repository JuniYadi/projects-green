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
  computeTopCountries,
  mergeAudienceBreakdown,
  computeRequestQuality,
  computeDailyTrafficSnapshotFromOpenSearch,
  getAppTrafficReport,
  getLiveTrafficLogs,
  getAppTrafficIps,
  getAppTrafficIpDetail,
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

  describe("computeTopCountries", () => {
    it("aggregates requests per country and calculates percentage correctly", () => {
      const noStatusEvidence = {
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
        successRatio: 100,
      }
      const topIps = [
        {
          ip: "1.1.1.1",
          countryCode: "SG",
          countryName: "Singapore",
          requestsCount: 60,
          ...noStatusEvidence,
        },
        {
          ip: "1.1.1.2",
          countryCode: "SG",
          countryName: "Singapore",
          requestsCount: 40,
          ...noStatusEvidence,
        },
        {
          ip: "2.2.2.2",
          countryCode: "ID",
          countryName: "Indonesia",
          requestsCount: 100,
          ...noStatusEvidence,
        },
      ]
      const countries = computeTopCountries(topIps)
      expect(countries.length).toBe(2)
      expect(countries[0]).toEqual({
        countryCode: "SG",
        countryName: "Singapore",
        requests: 100,
        percentage: 50,
      })
      expect(countries[1]).toEqual({
        countryCode: "ID",
        countryName: "Indonesia",
        requests: 100,
        percentage: 50,
      })
    })
  })

  describe("mergeAudienceBreakdown", () => {
    it("sums matching labels across days and re-derives top 5 + Other", () => {
      const merged = mergeAudienceBreakdown([
        {
          device: [{ label: "desktop", count: 80, percentage: 80 }],
          browser: [{ label: "Chrome", count: 80, percentage: 80 }],
          os: [{ label: "Windows", count: 80, percentage: 80 }],
        },
        {
          device: [{ label: "desktop", count: 20, percentage: 100 }],
          browser: [{ label: "Firefox", count: 20, percentage: 100 }],
          os: [{ label: "Windows", count: 20, percentage: 100 }],
        },
      ])

      expect(merged.device).toEqual([
        { label: "desktop", count: 100, percentage: 100 },
      ])
      expect(merged.os).toEqual([
        { label: "Windows", count: 100, percentage: 100 },
      ])
      expect(merged.browser).toEqual([
        { label: "Chrome", count: 80, percentage: 80 },
        { label: "Firefox", count: 20, percentage: 20 },
      ])
    })

    it("returns empty buckets when given no data", () => {
      expect(mergeAudienceBreakdown([])).toEqual({
        device: [],
        browser: [],
        os: [],
      })
    })
  })

  describe("computeRequestQuality", () => {
    it("computes percentages against the sum of the 4 buckets", () => {
      expect(computeRequestQuality(90, 5, 4, 1)).toEqual({
        status2xx: 90,
        status3xx: 5,
        status4xx: 4,
        status5xx: 1,
        status2xxPct: 90,
        status3xxPct: 5,
        status4xxPct: 4,
        status5xxPct: 1,
        hasBreakdown: true,
      })
    })

    it("reads an all-zero period as unknown, not 0%", () => {
      expect(computeRequestQuality(0, 0, 0, 0)).toEqual({
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
        status2xxPct: 0,
        status3xxPct: 0,
        status4xxPct: 0,
        status5xxPct: 0,
        hasBreakdown: false,
      })
    })

    it("defaults undefined inputs to 0 instead of producing NaN", () => {
      // @ts-expect-error -- exercising the runtime guard against a
      // legacy/nullable DB read, not a type-valid call.
      const result = computeRequestQuality(undefined, undefined, 4, 1)
      expect(result.status2xx).toBe(0)
      expect(result.hasBreakdown).toBe(true)
      expect(result.status4xxPct).toBe(80)
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
              visitor_cardinality: { value: 42 },
              hourly_trend: {
                buckets: [
                  {
                    key_as_string: "2026-09-10T00:00:00.000Z",
                    doc_count: 10,
                    errors: { doc_count: 0 },
                    automated: { doc_count: 1 },
                    visitor_cardinality: { value: 8 },
                  },
                  {
                    key_as_string: "2026-09-10T01:00:00.000Z",
                    doc_count: 20,
                    errors: { doc_count: 1 },
                    automated: { doc_count: 3 },
                    visitor_cardinality: { value: 15 },
                  },
                ],
              },
              top_paths: {
                buckets: [{ key: "/home", doc_count: 80 }],
              },
              user_agent_buckets: {
                buckets: [
                  {
                    key: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    doc_count: 90,
                  },
                  { key: "curl/7.68.0", doc_count: 10 },
                ],
              },
              top_ips: {
                buckets: [
                  {
                    key: "10.0.0.5",
                    doc_count: 12,
                    status_class: {
                      buckets: [
                        { key: "2xx", doc_count: 9 },
                        { key: "3xx", doc_count: 1 },
                        { key: "4xx", doc_count: 1 },
                        { key: "5xx", doc_count: 1 },
                      ],
                    },
                  },
                ],
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
      expect(result.hourlyTrend[0]).toEqual({
        hour: 0,
        requests: 10,
        errors: 0,
        visitors: 8,
        automated: 1,
      })
      expect(result.visitorEstimate).toBe(42)
      expect(result.visitorEstimateMethod).toBe("ip_cardinality_v1")
      expect(result.automatedRequests).toBe(4) // 1 + 3 across the 2 hourly buckets
      expect(result.topPaths).toEqual([{ path: "/home", views: 80 }])
      expect(result.errorPaths).toEqual([
        { path: "/missing", errors: 5, sampleStatus: 404 },
      ])
      expect(result.audience.device).toEqual([
        { label: "desktop", count: 90, percentage: 90 },
        { label: "bot", count: 10, percentage: 10 },
      ])
      expect(result.audience.browser).toEqual([
        { label: "Chrome", count: 90, percentage: 90 },
        { label: "CLI/HTTP Client", count: 10, percentage: 10 },
      ])
      expect(result.audience.os).toEqual([
        { label: "Windows", count: 90, percentage: 90 },
        { label: "Unknown", count: 10, percentage: 10 },
      ])
      expect(result.status2xx).toBe(100)
      expect(result.status3xx).toBe(0)
      expect(result.status4xx).toBe(5)
      expect(result.status5xx).toBe(2)
      expect(result.topIps).toEqual([
        {
          ip: "10.0.0.5",
          requestsCount: 12,
          countryCode: "LOCAL",
          countryName: "Jaringan Internal",
          city: "Local",
          status2xx: 9,
          status3xx: 1,
          status4xx: 1,
          status5xx: 1,
          successRatio: 75,
        },
      ])
    })

    it("throws error when stack is not found in computeDailyTrafficSnapshotFromOpenSearch", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue(null)
      const mockClient = { search: mock() }
      expect(
        computeDailyTrafficSnapshotFromOpenSearch(
          "unknown",
          new Date(),
          mockClient as unknown as import("@opensearch-project/opensearch").Client
        )
      ).rejects.toThrow("not found")
    })

    it("handles OpenSearch search error gracefully in snapshot compute", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })
      const mockClient = {
        search: mock(async () => {
          throw new Error("OpenSearch down")
        }),
      }
      const result = await computeDailyTrafficSnapshotFromOpenSearch(
        "my-app",
        new Date(),
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )
      expect(result.totalRequests).toBe(0)
      expect(result.topIps).toEqual([])
      expect(result.status2xx).toBe(0)
      expect(result.status5xx).toBe(0)
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
        status2xxCount: 900,
        status3xxCount: 50,
        status4xxCount: 40,
        status5xxCount: 10,
        totalBytes: BigInt(5000000),
        avgLatencyMs: 30,
        hourlyTrendJson: [
          { hour: 0, requests: 50, errors: 0 },
          { hour: 1, requests: 100, errors: 1 },
        ],
        topPathsJson: [{ path: "/api", views: 500 }],
        errorPathsJson: [{ path: "/api/bad", errors: 10, sampleStatus: 400 }],
        audienceJson: {
          device: [{ label: "mobile", count: 700, percentage: 70 }],
          browser: [{ label: "Safari", count: 700, percentage: 70 }],
          os: [{ label: "iOS", count: 700, percentage: 70 }],
        },
        visitorEstimate: 250,
        visitorEstMethod: "ip_cardinality_v1",
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
      // hourlyTrendJson here predates the visitors/automated fields --
      // must degrade to 0/humanLike=requests, not crash or read undefined.
      expect(report.trend[0].visitors).toBe(0)
      expect(report.trend[0].automated).toBe(0)
      expect(report.trend[0].humanLike).toBe(50)
      expect(report.topPages).toEqual([{ path: "/api", views: 500 }])
      expect(report.troubledPages).toEqual([
        { path: "/api/bad", errors: 10, sampleStatus: 400 },
      ])
      expect(report.audience.device).toEqual([
        { label: "mobile", count: 700, percentage: 70 },
      ])
      expect(report.visitorEstimate).toBe(250)
      expect(report.visitorEstimateMethod).toBe("ip_cardinality_v1")
      expect(report.requestQuality).toEqual({
        status2xx: 900,
        status3xx: 50,
        status4xx: 40,
        status5xx: 10,
        status2xxPct: 90,
        status3xxPct: 5,
        status4xxPct: 4,
        status5xxPct: 1,
        hasBreakdown: true,
      })
    })

    it("degrades a legacy snapshot with no audienceJson keys to empty buckets", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })
      mockPrisma.appHostingDailyTrafficSnapshot.findUnique.mockResolvedValue({
        id: "snap_legacy",
        stackId: "st_123",
        date: new Date(Date.UTC(2026, 8, 10)),
        totalRequests: 500,
        successCount: 500,
        errorCount: 0,
        totalBytes: BigInt(1000),
        avgLatencyMs: 10,
        hourlyTrendJson: [],
        topPathsJson: [],
        errorPathsJson: [],
        audienceJson: {}, // the column default for pre-migration rows
      })

      const report = await getAppTrafficReport("my-app", {
        granularity: "daily",
        date: "2026-09-10",
      })

      expect(report.audience).toEqual({ device: [], browser: [], os: [] })
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
          status2xxCount: 90,
          status3xxCount: 5,
          status4xxCount: 4,
          status5xxCount: 1,
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
          status2xxCount: 180,
          status3xxCount: 10,
          status4xxCount: 8,
          status5xxCount: 2,
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
      expect(report.requestQuality).toMatchObject({
        status2xx: 270,
        status3xx: 15,
        status4xx: 12,
        status5xx: 3,
        hasBreakdown: true,
      })
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
          topIpsJson: [
            {
              ip: "1.1.1.1",
              requestsCount: 100,
              countryCode: "SG",
              countryName: "Singapura",
            },
          ],
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
          topIpsJson: [
            {
              ip: "1.1.1.1",
              requestsCount: 200,
              countryCode: "SG",
              countryName: "Singapura",
            },
          ],
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
        visitors: 0,
        automated: 0,
        humanLike: 1000,
      })
      expect(report.trend[1]).toEqual({
        label: "Feb",
        requests: 2000,
        errors: 40,
        visitors: 0,
        automated: 0,
        humanLike: 2000,
      })
      expect(report.topIps[0].requestsCount).toBe(300)
      // Both snapshots predate the status-family columns -- no breakdown was
      // ever recorded, so this must read as "unknown", not a fabricated 0%.
      expect(report.requestQuality).toEqual({
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
        status2xxPct: 0,
        status3xxPct: 0,
        status4xxPct: 0,
        status5xxPct: 0,
        hasBreakdown: false,
      })
      expect(report.topIps[0].status2xx).toBe(0)
      expect(report.topIps[0].successRatio).toBe(100)
    })

    it("sums per-IP status breakdown across rolled-up snapshots", async () => {
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
          successCount: 90,
          errorCount: 10,
          totalBytes: BigInt(1000),
          avgLatencyMs: 20,
          topPathsJson: [],
          errorPathsJson: [],
          topIpsJson: [
            {
              ip: "10.0.0.5",
              requestsCount: 100,
              countryCode: "LOCAL",
              countryName: "Jaringan Internal",
              status2xx: 90,
              status3xx: 0,
              status4xx: 10,
              status5xx: 0,
              successRatio: 90,
            },
          ],
        },
        {
          id: "snap_2",
          stackId: "st_123",
          date: new Date(Date.UTC(2026, 8, 2)),
          totalRequests: 200,
          successCount: 190,
          errorCount: 10,
          totalBytes: BigInt(2000),
          avgLatencyMs: 20,
          topPathsJson: [],
          errorPathsJson: [],
          topIpsJson: [
            {
              ip: "10.0.0.5",
              requestsCount: 200,
              countryCode: "LOCAL",
              countryName: "Jaringan Internal",
              status2xx: 190,
              status3xx: 0,
              status4xx: 0,
              status5xx: 10,
              successRatio: 95,
            },
          ],
        },
      ])

      const report = await getAppTrafficReport("my-app", {
        granularity: "monthly",
        month: "2026-09",
      })

      expect(report.topIps[0]).toMatchObject({
        ip: "10.0.0.5",
        requestsCount: 300,
        status2xx: 280,
        status3xx: 0,
        status4xx: 10,
        status5xx: 10,
        successRatio: 93.3,
      })
    })

    it("excludes unevidenced legacy volume from the merged success ratio instead of diluting it", async () => {
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
          totalRequests: 1000,
          successCount: 1000,
          errorCount: 0,
          totalBytes: BigInt(1000),
          avgLatencyMs: 20,
          topPathsJson: [],
          errorPathsJson: [],
          // Legacy row: real request volume, no status breakdown recorded.
          topIpsJson: [
            {
              ip: "10.0.0.9",
              requestsCount: 1000,
              countryCode: "LOCAL",
              countryName: "Jaringan Internal",
            },
          ],
        },
        {
          id: "snap_2",
          stackId: "st_123",
          date: new Date(Date.UTC(2026, 8, 2)),
          totalRequests: 10,
          successCount: 8,
          errorCount: 2,
          totalBytes: BigInt(10),
          avgLatencyMs: 20,
          topPathsJson: [],
          errorPathsJson: [],
          topIpsJson: [
            {
              ip: "10.0.0.9",
              requestsCount: 10,
              countryCode: "LOCAL",
              countryName: "Jaringan Internal",
              status2xx: 8,
              status3xx: 0,
              status4xx: 2,
              status5xx: 0,
              successRatio: 80,
            },
          ],
        },
      ])

      const report = await getAppTrafficReport("my-app", {
        granularity: "monthly",
        month: "2026-09",
      })

      // 8/10 evidenced requests succeeded -> 80%, not 8/1010 (~0.8%) diluted
      // by the 1000 legacy requests that carry no status evidence at all.
      expect(report.topIps[0]).toMatchObject({
        ip: "10.0.0.9",
        requestsCount: 1010,
        status2xx: 8,
        status4xx: 2,
        successRatio: 80,
      })
    })

    it("returns empty default report when snapshot is absent", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        name: "My App",
      })
      mockPrisma.appHostingDailyTrafficSnapshot.findUnique.mockResolvedValue(
        null
      )

      const report = await getAppTrafficReport("my-app", {
        granularity: "daily",
      })

      expect(report.totalRequests).toBe(0)
      expect(report.totalBytes).toBe(0)
      expect(report.totalBytesFormatted).toBe("0 B")
      expect(report.topPages).toEqual([])
      expect(report.topIps).toEqual([])
      expect(report.topCountries).toEqual([])
      expect(report.requestQuality.hasBreakdown).toBe(false)
    })

    it("throws error when stack is not found", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue(null)
      expect(getAppTrafficReport("unknown", {})).rejects.toThrow("not found")
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
        status2xx: 45,
        status3xx: 3,
        status4xx: 1,
        status5xx: 1,
        totalBytes: BigInt(5000),
        avgLatencyMs: 25,
        hourlyTrend: [],
        topPaths: [],
        errorPaths: [],
        topIps: [],
        audience: { device: [], browser: [], os: [] },
        automatedRequests: 3,
        visitorEstimate: 20,
        visitorEstimateMethod: "ip_cardinality_v1",
      })
      expect(
        mockPrisma.appHostingDailyTrafficSnapshot.upsert
      ).toHaveBeenCalled()
      const call = mockPrisma.appHostingDailyTrafficSnapshot.upsert.mock
        .calls[0][0] as { create: Record<string, unknown> }
      expect(call.create.automatedCount).toBe(3)
      expect(call.create.visitorEstimate).toBe(20)
      expect(call.create.visitorEstMethod).toBe("ip_cardinality_v1")
      expect(call.create.status2xxCount).toBe(45)
      expect(call.create.status5xxCount).toBe(1)
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

  describe("getAppTrafficIps and getAppTrafficIpDetail", () => {
    it("getAppTrafficIps aggregates and classifies top IPs with coverage metrics", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        customDomain: "myapp.com",
        subdomain: "myapp.green.id",
        domains: [],
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            hits: { total: { value: 150 } },
            aggregations: {
              top_ips: {
                sum_other_doc_count: 50,
                buckets: [
                  {
                    key: "10.1.1.1",
                    doc_count: 80,
                    status_class: {
                      buckets: [
                        { key: "2xx", doc_count: 75 },
                        { key: "3xx", doc_count: 5 },
                        { key: "4xx", doc_count: 0 },
                        { key: "5xx", doc_count: 0 },
                      ],
                    },
                    first_seen: { value_as_string: "2026-09-16T01:00:00.000Z" },
                    last_seen: { value_as_string: "2026-09-16T12:00:00.000Z" },
                    user_agents: {
                      buckets: [
                        {
                          key: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                          doc_count: 80,
                        },
                      ],
                    },
                    top_paths: {
                      buckets: [{ key: "/dashboard", doc_count: 50 }],
                    },
                    automated_uas: { doc_count: 0 },
                  },
                  {
                    key: "10.2.2.2",
                    doc_count: 20,
                    status_class: {
                      buckets: [
                        { key: "2xx", doc_count: 0 },
                        { key: "3xx", doc_count: 0 },
                        { key: "4xx", doc_count: 20 },
                        { key: "5xx", doc_count: 0 },
                      ],
                    },
                    first_seen: { value_as_string: "2026-09-16T03:00:00.000Z" },
                    last_seen: { value_as_string: "2026-09-16T03:05:00.000Z" },
                    user_agents: {
                      buckets: [{ key: "curl/7.68.0", doc_count: 20 }],
                    },
                    top_paths: {
                      buckets: [{ key: "/.env", doc_count: 15 }],
                    },
                    automated_uas: { doc_count: 20 },
                  },
                ],
              },
            },
          },
        })),
      }

      const res = await getAppTrafficIps(
        "my-app",
        { page: 1, limit: 10 },
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )

      expect(res.total).toBe(2)
      expect(res.otherRequestCount).toBe(50)
      expect(res.coveragePercentage).toBeCloseTo(66.7, 1)
      expect(res.items[0].ip).toBe("10.1.1.1")
      expect(res.items[0].signal).toBe("likely_human")
      expect(res.items[0].successRatio).toBeCloseTo(93.8, 1)
      expect(res.items[1].ip).toBe("10.2.2.2")
      expect(res.items[1].signal).toBe("likely_automated")
      expect(res.items[1].successRatio).toBe(0)
    })

    it("getAppTrafficIps filters by signal and status family", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        customDomain: "myapp.com",
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            hits: { total: { value: 100 } },
            aggregations: {
              top_ips: {
                sum_other_doc_count: 0,
                buckets: [
                  {
                    key: "10.1.1.1",
                    doc_count: 50,
                    status_class: {
                      buckets: [{ key: "2xx", doc_count: 50 }],
                    },
                    user_agents: {
                      buckets: [
                        {
                          key: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
                          doc_count: 50,
                        },
                      ],
                    },
                    top_paths: { buckets: [{ key: "/", doc_count: 50 }] },
                  },
                  {
                    key: "10.2.2.2",
                    doc_count: 50,
                    status_class: {
                      buckets: [{ key: "4xx", doc_count: 50 }],
                    },
                    user_agents: {
                      buckets: [{ key: "python-requests/2.28", doc_count: 50 }],
                    },
                    top_paths: { buckets: [{ key: "/.git", doc_count: 50 }] },
                    automated_uas: { doc_count: 50 },
                  },
                ],
              },
            },
          },
        })),
      }

      const resFiltered = await getAppTrafficIps(
        "my-app",
        { signal: "likely_automated" },
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )

      expect(resFiltered.total).toBe(1)
      expect(resFiltered.items[0].ip).toBe("10.2.2.2")
    })

    it("getAppTrafficIpDetail returns comprehensive evidence for an IP", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "st_123",
        slug: "my-app",
        customDomain: "myapp.com",
      })

      const mockClient = {
        search: mock(async () => ({
          body: {
            hits: { total: { value: 30 } },
            aggregations: {
              status_class: {
                buckets: [
                  { key: "2xx", doc_count: 5 },
                  { key: "4xx", doc_count: 25 },
                ],
              },
              paths_2xx: {
                paths: { buckets: [{ key: "/", doc_count: 5 }] },
              },
              paths_4xx: {
                paths: { buckets: [{ key: "/.env", doc_count: 20 }] },
              },
              all_paths: {
                buckets: [
                  { key: "/.env", doc_count: 20 },
                  { key: "/favicon.ico", doc_count: 5 },
                  { key: "/", doc_count: 5 },
                ],
              },
              user_agents: {
                buckets: [{ key: "curl/7.81.0", doc_count: 30 }],
              },
              first_seen: { value_as_string: "2026-09-16T08:00:00.000Z" },
              last_seen: { value_as_string: "2026-09-16T08:30:00.000Z" },
              timeline: {
                buckets: [
                  {
                    key_as_string: "2026-09-16T08:00:00.000Z",
                    doc_count: 30,
                    errors: { doc_count: 25 },
                  },
                ],
              },
              automated_uas: { doc_count: 30 },
            },
          },
        })),
      }

      const detail = await getAppTrafficIpDetail(
        "my-app",
        "10.50.0.1",
        {},
        mockClient as unknown as import("@opensearch-project/opensearch").Client
      )

      expect(detail.ip).toBe("10.50.0.1")
      expect(detail.totalRequests).toBe(30)
      expect(detail.statusCounts.status2xx).toBe(5)
      expect(detail.statusCounts.status4xx).toBe(25)
      expect(detail.signal.classification).toBe("likely_automated")
      expect(detail.pathsByStatus.status4xx[0].path).toBe("/.env")
      expect(detail.userAgents[0].browser).toBe("CLI/HTTP Client")
      expect(detail.staticAssetShare).toBeCloseTo(16.7, 1)
      expect(detail.timeline.length).toBe(1)
    })

    it("getAppTrafficIpDetail rejects invalid IP addresses", async () => {
      await expect(
        getAppTrafficIpDetail("my-app", "invalid-ip")
      ).rejects.toThrow("Invalid IP address")
    })
  })
})
