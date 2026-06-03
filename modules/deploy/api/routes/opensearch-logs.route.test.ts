import { describe, expect, it, mock } from "bun:test"

mock.module("@/modules/deploy/opensearch/opensearch-log.service", () => ({
  queryLogs: mock(() =>
    Promise.resolve({ hits: [], total: 0, took: 5 })
  ),
  getDeployAggregation: mock(() =>
    Promise.resolve({
      deployFrequency: [],
      successRate: { total: 0, success: 0, failed: 0, rate: 0 },
      avgDurationMs: 0,
    })
  ),
}))

const { opensearchLogsRoutes } = await import("./opensearch-logs.route")

describe("OpenSearch Logs Routes", () => {
  it("exports Elysia routes", () => {
    expect(opensearchLogsRoutes).toBeDefined()
  })
})
