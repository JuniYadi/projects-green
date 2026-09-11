import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockSearch = mock()

class MockOpenSearchClient {
  search = mockSearch
}

mock.module("@opensearch-project/opensearch", () => ({
  Client: MockOpenSearchClient,
}))

const mockStackFindFirst = mock()
const mockClusterFindFirst = mock()

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationStack: {
      findFirst: mockStackFindFirst,
    },
    appHostingCluster: {
      findFirst: mockClusterFindFirst,
    },
  },
}))

const mockResolveClusterIntegration = mock()
const mockResolveClusterIntegrationByClusterCode = mock()

mock.module("../cluster-integration.service", () => ({
  resolveClusterIntegration: mockResolveClusterIntegration,
  resolveClusterIntegrationByClusterCode:
    mockResolveClusterIntegrationByClusterCode,
}))

const mockGetOpenSearchClient = mock(() => new MockOpenSearchClient())
mock.module("@/lib/opensearch", () => ({
  getOpenSearchClient: mockGetOpenSearchClient,
}))

const { queryAppLogs, resolveOpenSearchClientForApp } =
  await import("./opensearch-query.service")

describe("opensearch-query.service", () => {
  beforeEach(() => {
    mockSearch.mockClear()
    mockStackFindFirst.mockClear()
    mockClusterFindFirst.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockResolveClusterIntegrationByClusterCode.mockClear()
    mockGetOpenSearchClient.mockClear()

    mockStackFindFirst.mockResolvedValue({
      id: "stack-123",
      clusterId: "cluster-sgp",
      organizationId: null,
    })
    mockClusterFindFirst.mockResolvedValue({
      id: "cluster-sgp",
      code: "sgp",
    })
    mockResolveClusterIntegration.mockResolvedValue({
      endpoint: "https://opensearch.example.com",
      username: "admin",
      password: "secret",
      sslVerify: true,
      timeout: 30,
    })
    mockResolveClusterIntegrationByClusterCode.mockResolvedValue({
      endpoint: "https://opensearch.example.com",
      username: "admin",
      password: "secret",
      sslVerify: true,
      timeout: 30,
    })
  })

  describe("resolveOpenSearchClientForApp", () => {
    it("resolves org namespace and uses cached client", async () => {
      mockStackFindFirst.mockResolvedValueOnce({
        id: "stack-org",
        clusterId: "cluster-sgp",
        organizationId: "org_acme_corp",
      })

      const first = await resolveOpenSearchClientForApp("billing-api")
      expect(first.namespace).toBe("app-billing-api")
      expect(first.organizationId).toBe("org_acme_corp")
      expect(first.orgNamespace).toBe("app-acme-corp")

      // Second resolution hits client cache
      mockStackFindFirst.mockResolvedValueOnce({
        id: "stack-org",
        clusterId: "cluster-sgp",
        organizationId: "org_acme_corp",
      })
      const second = await resolveOpenSearchClientForApp("billing-api")
      expect(second.client).toBe(first.client)
    })

    it("falls back to default active cluster when stack integration fails", async () => {
      mockResolveClusterIntegration.mockRejectedValueOnce(
        new Error("No integration on stack")
      )
      mockClusterFindFirst.mockResolvedValueOnce({
        code: "cluster-default-code",
      })

      const resolved = await resolveOpenSearchClientForApp("app-orphan")
      expect(mockResolveClusterIntegrationByClusterCode).toHaveBeenCalledWith(
        "cluster-default-code",
        "OPENSEARCH"
      )
      expect(resolved.namespace).toBe("app-app-orphan")
    })

    it("falls back to env OpenSearch client when default cluster fails", async () => {
      mockResolveClusterIntegration.mockRejectedValueOnce(
        new Error("No stack integration")
      )
      mockClusterFindFirst.mockRejectedValueOnce(new Error("DB timeout"))

      const resolved = await resolveOpenSearchClientForApp("no-cluster-app")
      expect(mockGetOpenSearchClient).toHaveBeenCalled()
      expect(resolved.client).toBeDefined()
    })

    it("falls back to env client when stack and default cluster are not found", async () => {
      mockStackFindFirst.mockResolvedValueOnce(null)
      mockClusterFindFirst.mockResolvedValueOnce(null)

      const resolved = await resolveOpenSearchClientForApp("missing-stack")
      expect(mockGetOpenSearchClient).toHaveBeenCalled()
      expect(resolved.orgNamespace).toBeNull()
    })
  })

  it("queries app index and normalizes returned hits", async () => {
    mockSearch.mockResolvedValueOnce({
      body: {
        took: 12,
        _shards: { total: 1 },
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "hit-1",
              _source: {
                "@timestamp": "2026-09-08T22:18:01.747Z",
                stream: "stdout",
                message: "Starting worker",
                kubernetes: {
                  container_name: "deploy",
                },
              },
            },
          ],
        },
      },
    })

    const result = await queryAppLogs({ slug: "metacard-prod" })
    expect(result.took).toBe(12)
    expect(result.total).toBe(1)
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].message).toBe("Starting worker")
    expect(result.hits[0].source).toBe("deploy")
    expect(result.hits[0].level).toBe("INFO")

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        index: "app-metacard-prod-*",
      })
    )
  })

  it("handles empty shards by querying fallback index", async () => {
    // First call has 0 shards (index doesn't exist)
    mockSearch.mockResolvedValueOnce({
      body: {
        took: 1,
        _shards: { total: 0 },
        hits: { total: { value: 0 }, hits: [] },
      },
    })

    // Second call to fallback
    mockSearch.mockResolvedValueOnce({
      body: {
        took: 5,
        _shards: { total: 2 },
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "fb-1",
              _source: {
                "@timestamp": "2026-09-08T22:18:01.747Z",
                message: "fallback log message",
              },
            },
          ],
        },
      },
    })

    const result = await queryAppLogs({ slug: "pulsar" })
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].message).toBe("fallback log message")
    expect(mockSearch).toHaveBeenCalledTimes(2)
  })

  it("returns empty result gracefully when OpenSearch throws", async () => {
    mockSearch.mockRejectedValueOnce(new Error("Connection refused"))
    const result = await queryAppLogs({ slug: "broken-app" })
    expect(result.hits).toEqual([])
    expect(result.total).toBe(0)
  })

  it("builds search query with text search, source, level, and timestamp range", async () => {
    mockSearch.mockResolvedValueOnce({
      body: {
        took: 8,
        hits: {
          total: 42,
          hits: [],
        },
      },
    })

    const result = await queryAppLogs({
      slug: "metacard-prod",
      q: "connection timeout",
      source: "sidecar",
      level: "ERROR",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-08T23:59:59.999Z",
      limit: 2500, // should clamp to 1000
      order: "asc",
    })

    expect(result.total).toBe(42)
    const searchCall = mockSearch.mock.calls[0][0]
    expect(searchCall.body.size).toBe(1000)
    expect(searchCall.body.sort).toEqual([
      { "@timestamp": { order: "asc", unmapped_type: "date" } },
    ])

    const query = searchCall.body.query
    expect(query.bool.must).toEqual([
      {
        multi_match: {
          query: "connection timeout",
          fields: ["message", "msg", "log"],
          type: "phrase_prefix",
        },
      },
    ])

    // Contains pod isolation, source, level, and range filters
    expect(query.bool.filter).toHaveLength(4)
  })

  it("supports WARN, INFO, and ALL level filters and clamps lower-bound limit", async () => {
    mockSearch.mockResolvedValue({
      took: 3,
      hits: {
        total: { value: 0 },
        hits: [],
      },
    })

    // WARN filter
    await queryAppLogs({
      slug: "metacard-prod",
      level: "WARN",
      limit: -10, // should clamp to 1
    })
    let searchCall = mockSearch.mock.calls[0][0]
    expect(searchCall.body.size).toBe(1)
    expect(JSON.stringify(searchCall.body.query)).toContain(
      '"term":{"level":40}'
    )

    mockSearch.mockClear()
    mockSearch.mockResolvedValue({
      took: 2,
      hits: { total: 0, hits: [] },
    })

    // INFO filter with only `from` date
    await queryAppLogs({
      slug: "metacard-prod",
      level: "INFO",
      from: "2026-09-01T00:00:00.000Z",
    })
    searchCall = mockSearch.mock.calls[0][0]
    expect(JSON.stringify(searchCall.body.query)).toContain(
      '"level.keyword":"INFO"'
    )

    mockSearch.mockClear()
    mockSearch.mockResolvedValue({
      took: 2,
      hits: { total: 0, hits: [] },
    })

    // ALL filter with only `to` date
    await queryAppLogs({
      slug: "metacard-prod",
      level: "ALL",
      to: "2026-09-08T00:00:00.000Z",
    })
    searchCall = mockSearch.mock.calls[0][0]
    expect(JSON.stringify(searchCall.body.query)).not.toContain(
      '"level.keyword"'
    )
  })

  it("handles fallback failure gracefully when fallback throws", async () => {
    mockSearch.mockResolvedValueOnce({
      body: {
        took: 1,
        _shards: { total: 0 },
        hits: { total: 0, hits: [] },
      },
    })
    // Fallback throws
    mockSearch.mockRejectedValueOnce(new Error("Cluster unavailable"))

    const result = await queryAppLogs({ slug: "app-shards-fail" })
    expect(result.hits).toEqual([])
    expect(result.total).toBe(0)
  })

  it("silently handles index_not_found_exception without error logging", async () => {
    mockSearch.mockRejectedValueOnce(
      new Error("index_not_found_exception [no such index [app-ghost-*]]")
    )
    const result = await queryAppLogs({ slug: "ghost" })
    expect(result.hits).toEqual([])
    expect(result.total).toBe(0)
  })
})
