import { describe, expect, it, mock, beforeEach } from "bun:test"

const mockClient = {
  index: mock(() =>
    Promise.resolve({ body: { _id: "1", result: "created" } })
  ),
  search: mock(() =>
    Promise.resolve({
      body: {
        hits: { hits: [], total: { value: 0 } },
        took: 5,
      },
    })
  ),
  bulk: mock(() =>
    Promise.resolve({
      body: {
        items: [],
      },
    })
  ),
  indices: {
    exists: mock(() => Promise.resolve({ body: true })),
  },
}

mock.module("@/lib/opensearch", () => ({
  getOpenSearchClient: () => mockClient,
}))

mock.module("./opensearch-index.service", () => ({
  ensureLogIndex: mock(() => Promise.resolve("deploy-logs-test-2026.06")),
  getLogIndexName: mock(() => "deploy-logs-test-2026.06"),
}))

const { ingestLog, ingestLogBatch, queryLogs, getDeployAggregation } = await import(
  "./opensearch-log.service"
)

describe("OpenSearch Log Service", () => {
  beforeEach(() => {
    mockClient.index.mockClear()
    mockClient.search.mockClear()
    mockClient.bulk.mockClear()
    mockClient.indices.exists.mockClear()
  })

  it("indexes a log entry", async () => {
    const result = await ingestLog({
      timestamp: new Date().toISOString(),
      level: "INFO",
      source: "nginx",
      message: "GET / 200",
      tenantSlug: "test",
    })
    expect(result).toBe(true)
    expect(mockClient.index).toHaveBeenCalled()
  })

  it("batch indexes log entries", async () => {
    const result = await ingestLogBatch([
      {
        timestamp: new Date().toISOString(),
        level: "INFO",
        source: "nginx",
        message: "GET / 200",
        tenantSlug: "test",
      },
      {
        timestamp: new Date().toISOString(),
        level: "ERROR",
        source: "app",
        message: "Error occurred",
        tenantSlug: "test",
      },
    ])
    expect(result.success).toBe(2)
    expect(result.failed).toBe(0)
    expect(mockClient.bulk).toHaveBeenCalled()
  })

  it("returns empty batch for empty input", async () => {
    const result = await ingestLogBatch([])
    expect(result.success).toBe(0)
    expect(result.failed).toBe(0)
    expect(mockClient.bulk).not.toHaveBeenCalled()
  })

  it("queries logs with filters", async () => {
    const result = await queryLogs({
      tenantSlug: "test",
      level: "ERROR",
      size: 10,
    })
    expect(result.hits).toEqual([])
    expect(result.total).toBe(0)
  })

  it("returns empty result when index does not exist", async () => {
    mockClient.indices.exists.mockResolvedValueOnce({ body: false })

    const result = await queryLogs({
      tenantSlug: "nonexistent",
      size: 10,
    })
    expect(result.hits).toEqual([])
    expect(result.total).toBe(0)
    expect(result.took).toBe(0)
  })

  it("returns empty result when search throws an error", async () => {
    mockClient.search.mockRejectedValueOnce(new Error("Connection refused"))

    const result = await queryLogs({
      tenantSlug: "test",
      size: 10,
    })
    expect(result.hits).toEqual([])
    expect(result.total).toBe(0)
    expect(result.took).toBe(0)
  })

  it("returns deployment aggregations", async () => {
    const result = await getDeployAggregation("test")
    expect(result.deployFrequency).toEqual([])
    expect(result.successRate).toBeDefined()
    expect(result.avgDurationMs).toBe(0)
  })
})
