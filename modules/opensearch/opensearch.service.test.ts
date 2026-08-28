import { beforeEach, describe, expect, it, mock, type Mock } from "bun:test"
import { OpenSearchService } from "./opensearch.service"
import type { OpenSearchClient } from "./opensearch.client"
import type { OpenSearchSearchFilters } from "./opensearch.types"

describe("OpenSearchService", () => {
  let mockSearch: Mock<(...args: unknown[]) => Promise<unknown>>
  let mockGetMapping: Mock<(...args: unknown[]) => Promise<unknown>>
  let mockTestConnection: Mock<(...args: unknown[]) => Promise<unknown>>
  let mockHealthCheck: Mock<(...args: unknown[]) => Promise<unknown>>
  let mockClient: Partial<OpenSearchClient>
  let service: OpenSearchService

  beforeEach(() => {
    mockSearch = mock(async () => ({
      took: 15,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
      hits: {
        total: { value: 1, relation: "eq" },
        max_score: 1.0,
        hits: [],
      },
    }))
    mockGetMapping = mock(async () => ({}))
    mockTestConnection = mock(async () => ({
      success: true,
      host: "localhost:9200",
      message: "Connected",
    }))
    mockHealthCheck = mock(async () => ({
      healthy: true,
      status: "green",
      clusterName: "opensearch-cluster",
    }))

    mockClient = {
      search: mockSearch as unknown as OpenSearchClient["search"],
      getMapping: mockGetMapping as unknown as OpenSearchClient["getMapping"],
      testConnection:
        mockTestConnection as unknown as OpenSearchClient["testConnection"],
      healthCheck:
        mockHealthCheck as unknown as OpenSearchClient["healthCheck"],
    }

    service = new OpenSearchService(mockClient as OpenSearchClient, "id-jkt")
  })

  describe("static fromRegion", () => {
    it("instantiates OpenSearchService with regional client", () => {
      const regionalService = OpenSearchService.fromRegion("id-jkt")
      expect(regionalService).toBeInstanceOf(OpenSearchService)
    })
  })

  describe("searchLogs", () => {
    it("returns error result when stackSlugs is empty", async () => {
      const result = await service.searchLogs({
        stackSlugs: [],
      })

      expect(result).toEqual({
        success: false,
        error: "No valid index pattern found for the specified stacks",
        data: [],
        total: 0,
        took: 0,
      })
      expect(mockClient.search).not.toHaveBeenCalled()
    })

    it("builds single day index pattern and executes search query with full hit formatting", async () => {
      const sampleHits = [
        {
          _id: "hit-1",
          _source: {
            "@timestamp": "2026-08-28T10:00:00.000Z",
            level_name: "info",
            message: "User logged in",
            kubernetes: {
              pod_name: "auth-pod-abc",
              container_name: "auth-container",
              container_image: "auth:v1.0",
              namespace_name: "production",
              host: "node-1",
            },
            remote_addr: "192.168.1.100",
            http_x_forwarded_for: "203.0.113.195",
            status: 200,
            responseTime: 150,
            request_method: "POST",
            request_uri: "/api/login",
            http_user_agent: "Mozilla/5.0",
          },
        },
        {
          _id: "hit-2",
          _source: {
            timestamp: "2026-08-28T10:05:00.000Z",
            level: 50, // numeric pino level -> error
            raw: {
              msg: "Database connection failed",
              req: {
                method: "GET",
                url: "/api/users",
                remoteAddress: "10.0.0.1",
                headers: {
                  "x-forwarded-for": "198.51.100.1",
                  "user-agent": "curl/7.68.0",
                },
              },
              res: {
                statusCode: 500,
              },
              responseTime: 2500,
            },
          },
        },
      ]

      mockSearch.mockResolvedValueOnce({
        took: 25,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          total: { value: 2, relation: "eq" },
          max_score: 1.0,
          hits: sampleHits,
        },
      })

      const filters: OpenSearchSearchFilters = {
        stackSlugs: ["app-stack"],
        startDate: "2026-08-28T00:00:00.000Z",
        endDate: "2026-08-28T23:59:59.000Z",
        logLevel: "error",
        containerName: "auth-container",
        httpStatus: "500",
        httpMethod: "POST",
        httpUri: "/api/login",
        podName: "auth-pod-abc",
        remoteAddr: "192.168.1.100",
        eventType: "auth_event",
        host: "node-1",
        searchQuery: "login",
        searchColumn: "message",
        from: 10,
        size: 20,
      }

      const result = await service.searchLogs(filters)

      expect(result.success).toBe(true)
      expect(result.total).toBe(2)
      expect(result.took).toBe(25)
      expect(result.data).toHaveLength(2)

      // Verify search call query construction
      expect(mockSearch).toHaveBeenCalledWith(
        "app-stack-2026-08-28",
        expect.objectContaining({
          query: {
            bool: {
              must: expect.arrayContaining([
                {
                  range: {
                    "@timestamp": {
                      gte: "2026-08-28T00:00:00.000Z",
                      lte: "2026-08-28T23:59:59.000Z",
                    },
                  },
                },
                { term: { "level_name.keyword": "error" } },
                {
                  term: {
                    "kubernetes.container_name.keyword": "auth-container",
                  },
                },
                { term: { "level.keyword": "500" } },
                { term: { "request_method.keyword": "POST" } },
                { wildcard: { "request_uri.keyword": "*/api/login*" } },
                { term: { "kubernetes.pod_name.keyword": "auth-pod-abc" } },
                { term: { "remote_addr.keyword": "192.168.1.100" } },
                { term: { "event_type.keyword": "auth_event" } },
                { term: { "host.keyword": "node-1" } },
                {
                  wildcard: {
                    message: {
                      value: "*login*",
                      case_insensitive: true,
                    },
                  },
                },
              ]),
            },
          },
          sort: [{ "@timestamp": { order: "desc" } }],
          from: 10,
          size: 20,
        }),
        20,
        10
      )

      // Verify formatted hit #1
      const entry1 = result.data[0]
      expect(entry1.id).toBe("hit-1")
      expect(entry1.timestamp).toBe("2026-08-28T10:00:00.000Z")
      expect(entry1.level).toBe("info")
      expect(entry1.message).toBe("User logged in")
      expect(entry1.pod).toBe("auth-pod-abc")
      expect(entry1.container).toBe("auth-container")
      expect(entry1.containerImage).toBe("auth:v1.0")
      expect(entry1.namespace).toBe("production")
      expect(entry1.host).toBe("node-1")
      expect(entry1.ip).toBe("192.168.1.100")
      expect(entry1.forwarded_ip).toBe("203.0.113.195")
      expect(entry1.status).toBe("200")
      expect(entry1.request_time).toBe(0.15)
      expect(entry1.method).toBe("POST")
      expect(entry1.uri).toBe("/api/login")
      expect(entry1.user_agent).toBe("Mozilla/5.0")

      // Verify formatted hit #2
      const entry2 = result.data[1]
      expect(entry2.id).toBe("hit-2")
      expect(entry2.timestamp).toBe("2026-08-28T10:05:00.000Z")
      expect(entry2.level).toBe("error")
      expect(entry2.message).toBe("Database connection failed")
      expect(entry2.ip).toBe("10.0.0.1")
      expect(entry2.forwarded_ip).toBe("198.51.100.1")
      expect(entry2.status).toBe("500")
      expect(entry2.request_time).toBe(2.5)
      expect(entry2.method).toBe("GET")
      expect(entry2.uri).toBe("/api/users")
      expect(entry2.user_agent).toBe("curl/7.68.0")
    })

    it("formats generic pino http message to method and uri", async () => {
      mockSearch.mockResolvedValueOnce({
        took: 5,
        hits: {
          total: { value: 1, relation: "eq" },
          hits: [
            {
              _id: "hit-http",
              _source: {
                "@timestamp": "2026-08-28T10:00:00.000Z",
                message: "request completed",
                raw: {
                  req: { method: "DELETE", url: "/api/items/123" },
                },
              },
            },
          ],
        },
      })

      const result = await service.searchLogs({
        stackSlugs: ["app"],
        startDate: "2026-08-28T00:00:00.000Z",
        endDate: "2026-08-28T23:59:59.000Z",
      })

      expect(result.success).toBe(true)
      expect(result.data[0].message).toBe("DELETE /api/items/123")
    })

    it("handles multi-day wildcard index pattern when diffDays >= 7", async () => {
      mockSearch.mockResolvedValueOnce({
        took: 10,
        hits: { total: { value: 0 }, hits: [] },
      })

      await service.searchLogs({
        stackSlugs: ["stack-a", "stack-b"],
        startDate: "2026-08-01T00:00:00.000Z",
        endDate: "2026-08-20T00:00:00.000Z",
      })

      expect(mockSearch).toHaveBeenCalledWith(
        "stack-a-*,stack-b-*",
        expect.any(Object),
        50,
        0
      )
    })

    it("handles multi-day discrete index pattern when diffDays < 7", async () => {
      mockSearch.mockResolvedValueOnce({
        took: 10,
        hits: { total: { value: 0 }, hits: [] },
      })

      await service.searchLogs({
        stackSlugs: ["stack-a"],
        startDate: "2026-08-01T00:00:00.000Z",
        endDate: "2026-08-03T00:00:00.000Z",
      })

      expect(mockSearch).toHaveBeenCalledWith(
        "stack-a-2026-08-01,stack-a-2026-08-02,stack-a-2026-08-03",
        expect.any(Object),
        50,
        0
      )
    })

    it("uses multi_match when searchColumn is not in searchableColumns", async () => {
      mockSearch.mockResolvedValueOnce({
        took: 5,
        hits: { total: { value: 0 }, hits: [] },
      })

      await service.searchLogs({
        stackSlugs: ["stack-a"],
        startDate: "2026-08-28T00:00:00.000Z",
        endDate: "2026-08-28T23:59:59.000Z",
        searchQuery: "syntax error",
        searchColumn: "custom_unsupported_column",
      })

      expect(mockSearch).toHaveBeenCalledWith(
        "stack-a-2026-08-28",
        expect.objectContaining({
          query: {
            bool: {
              must: expect.arrayContaining([
                {
                  multi_match: {
                    query: "syntax error",
                    fields: ["message^2", "log", "container", "pod"],
                  },
                },
              ]),
            },
          },
        }),
        50,
        0
      )
    })

    it("catches client search error and returns failure response", async () => {
      mockSearch.mockRejectedValueOnce(new Error("Connection timeout"))

      const result = await service.searchLogs({
        stackSlugs: ["stack-a"],
      })

      expect(result).toEqual({
        success: false,
        error: "OpenSearch query failed: Connection timeout",
        data: [],
        total: 0,
        took: 0,
      })
    })
  })

  describe("getLogCounts", () => {
    it("returns error result when stackSlugs is empty", async () => {
      const result = await service.getLogCounts({
        stackSlugs: [],
      })

      expect(result).toEqual({
        success: false,
        error: "No valid index pattern found for the specified stacks",
        totalLogs: 0,
        logLevels: [],
        timeline: [],
      })
    })

    it("executes aggregation query with appropriate timeline interval", async () => {
      mockSearch.mockResolvedValueOnce({
        took: 12,
        hits: { total: { value: 1250 } },
      })

      const result = await service.getLogCounts({
        stackSlugs: ["app-stack"],
        startDate: "2026-08-28T00:00:00.000Z",
        endDate: "2026-08-28T23:59:59.000Z",
        timeRange: "15m",
      })

      expect(result).toEqual({
        success: true,
        totalLogs: 1250,
        logLevels: [],
        timeline: [],
      })

      expect(mockSearch).toHaveBeenCalledWith(
        "app-stack-2026-08-28",
        expect.objectContaining({
          size: 0,
          aggs: {
            log_levels: {
              terms: { field: "level.keyword", size: 10 },
            },
            log_timeline: {
              date_histogram: {
                field: "@timestamp",
                fixed_interval: "1m",
                time_zone: "UTC",
              },
            },
          },
        }),
        0,
        0
      )
    })

    it("catches aggregation error and returns error result", async () => {
      mockSearch.mockRejectedValueOnce(
        new Error("OpenSearch aggregation failed")
      )

      const result = await service.getLogCounts({
        stackSlugs: ["app-stack"],
      })

      expect(result).toEqual({
        success: false,
        error:
          "OpenSearch aggregation query failed: OpenSearch aggregation failed",
        totalLogs: 0,
        logLevels: [],
        timeline: [],
      })
    })
  })

  describe("getAvailableFields", () => {
    it("returns default fields when stackSlugs is empty", async () => {
      const fields = await service.getAvailableFields([])
      expect(fields).toEqual({
        "@timestamp": "date",
        timestamp: "date",
        level: "keyword",
        message: "text",
        log: "text",
        container: "keyword",
        container_name: "keyword",
        namespace: "keyword",
        pod: "keyword",
        "kubernetes.namespace_name": "keyword",
        "kubernetes.pod_name": "keyword",
      })
      expect(mockGetMapping).not.toHaveBeenCalled()
    })

    it("extracts and formats property mappings from index mapping result", async () => {
      mockGetMapping.mockResolvedValueOnce({
        "index-2026-08-28": {
          mappings: {
            properties: {
              "@timestamp": { type: "date" },
              level: { type: "keyword" },
              message: { type: "text" },
              custom_tag: {}, // tests default "text" fallback when type undefined
            },
          },
        },
      })

      const fields = await service.getAvailableFields(["app-stack"])

      expect(fields).toEqual({
        "@timestamp": "date",
        level: "keyword",
        message: "text",
        custom_tag: "text",
      })
    })

    it("falls back to default fields when getMapping throws", async () => {
      mockGetMapping.mockRejectedValueOnce(new Error("Mapping fetch failed"))

      const fields = await service.getAvailableFields(["app-stack"])
      expect(fields["@timestamp"]).toBe("date")
      expect(fields["level"]).toBe("keyword")
      expect(fields["kubernetes.pod_name"]).toBe("keyword")
    })
  })

  describe("testConnection and healthCheck delegation", () => {
    it("delegates testConnection to client", async () => {
      const res = await service.testConnection()
      expect(res).toEqual({
        success: true,
        host: "localhost:9200",
        message: "Connected",
      })
      expect(mockTestConnection).toHaveBeenCalled()
    })

    it("delegates healthCheck to client", async () => {
      const res = await service.healthCheck()
      expect(res).toEqual({
        healthy: true,
        status: "green",
        clusterName: "opensearch-cluster",
      })
      expect(mockHealthCheck).toHaveBeenCalled()
    })
  })
})
