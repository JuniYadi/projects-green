import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockSearch = mock()

mock.module("@opensearch-project/opensearch", () => ({
  Client: class MockClient {
    search = mockSearch
  },
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationStack: {
      findFirst: mock(async () => ({
        id: "stack-123",
        clusterId: "cluster-sgp",
      })),
    },
    appHostingCluster: {
      findFirst: mock(async () => ({
        id: "cluster-sgp",
        code: "sgp",
      })),
    },
  },
}))
mock.module("../cluster-integration.service", () => ({
  resolveClusterIntegration: mock(async () => ({
    endpoint: "https://opensearch.example.com",
    username: "admin",
    password: "secret",
    sslVerify: true,
    timeout: 30,
  })),
  resolveClusterIntegrationByClusterCode: mock(async () => ({
    endpoint: "https://opensearch.example.com",
    username: "admin",
    password: "secret",
    sslVerify: true,
    timeout: 30,
  })),
}))

const { queryAppLogs } = await import("./opensearch-query.service")

describe("opensearch-query.service", () => {
  beforeEach(() => {
    mockSearch.mockClear()
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
})
