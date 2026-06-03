import { describe, expect, it, mock } from "bun:test"

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(() =>
    Promise.resolve({
      user: {
        id: "user-123",
        email: "test@example.com",
        metadata: { orgSlug: "test-org" },
      },
    })
  ),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(() => Promise.resolve("none")),
}))

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

  it("allows access when tenantSlug matches user orgSlug", async () => {
    const response = await opensearchLogsRoutes.handle(
      new Request("http://localhost/deploy/logs/test-org/search")
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it("returns 403 when tenantSlug does not match user orgSlug", async () => {
    const response = await opensearchLogsRoutes.handle(
      new Request("http://localhost/deploy/logs/other-org/search")
    )
    expect(response.status).toBe(403)
    const body = await response.json() as { error: string }
    expect(body.error).toBe("FORBIDDEN")
  })
})
