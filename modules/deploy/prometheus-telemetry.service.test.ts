import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockResolveClusterIntegrationByClusterCode = mock(
  async (_code: string, _type: string) => ({
    endpoint: "https://prometheus.test.local",
    username: "prom-user",
    password: "prom-password",
  })
)

mock.module("./cluster-integration.service", () => ({
  resolveClusterIntegrationByClusterCode:
    mockResolveClusterIntegrationByClusterCode,
}))

// Test seam: dynamic import after mock.module to ensure mock resolution
const {
  DEFAULT_CLUSTER_CODE,
  FALLBACK_CPU_LIMIT_CORES,
  FALLBACK_MEMORY_LIMIT_BYTES,
  fetchNamespaceTelemetry,
  formatTenantNamespace,
} = await import("./prometheus-telemetry.service")

describe("formatTenantNamespace", () => {
  it("handles empty or falsy organization ID with default", () => {
    expect(formatTenantNamespace("")).toBe("app-default")
    // @ts-expect-error test undefined runtime safety
    expect(formatTenantNamespace(undefined)).toBe("app-default")
    // @ts-expect-error test null runtime safety
    expect(formatTenantNamespace(null)).toBe("app-default")
  })

  it("converts org_ prefix to app- and lowercases", () => {
    expect(formatTenantNamespace("org_01ks2abc")).toBe("app-01ks2abc")
    expect(formatTenantNamespace("org_TEST123")).toBe("app-test123")
    expect(formatTenantNamespace("org_prod_tenant")).toBe("app-prod_tenant")
  })

  it("preserves strings that already start with app-", () => {
    expect(formatTenantNamespace("app-test")).toBe("app-test")
    expect(formatTenantNamespace("app-frontend-staging")).toBe(
      "app-frontend-staging"
    )
  })

  it("prepends app- to bare strings", () => {
    expect(formatTenantNamespace("my-team")).toBe("app-my-team")
    expect(formatTenantNamespace("tenant42")).toBe("app-tenant42")
  })
})

describe("fetchNamespaceTelemetry", () => {
  beforeEach(() => {
    mockResolveClusterIntegrationByClusterCode.mockClear()
  })

  it("fetches 1h namespace telemetry with standard metric responses", async () => {
    const requestedUrls: string[] = []
    const requestedHeaders: Array<Record<string, string>> = []

    const mockFetch = mock(
      async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString()
        requestedUrls.push(urlStr)
        if (init?.headers) {
          requestedHeaders.push(init.headers as Record<string, string>)
        }

        // Instant limit queries
        if (
          urlStr.includes("kube_pod_container_resource_limits") &&
          urlStr.includes("cpu")
        ) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                resultType: "vector",
                result: [{ metric: {}, value: [1710003600, "4.0"] }],
              },
            }),
            { status: 200 }
          )
        }

        if (
          urlStr.includes("kube_pod_container_resource_limits") &&
          urlStr.includes("memory")
        ) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                resultType: "vector",
                result: [
                  {
                    metric: {},
                    value: [1710003600, String(16 * 1024 * 1024 * 1024)],
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }

        // Range queries
        const timestamps = [1710000300, 1710000600, 1710000900]

        if (urlStr.includes("container_cpu_usage_seconds_total")) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                resultType: "matrix",
                result: [
                  {
                    metric: {},
                    values: [
                      [timestamps[0], "0.5"],
                      [timestamps[1], "1.2"],
                      [timestamps[2], "0.8"],
                    ],
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }

        if (urlStr.includes("container_memory_working_set_bytes")) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                resultType: "matrix",
                result: [
                  {
                    metric: {},
                    values: [
                      [timestamps[0], String(2 * 1024 * 1024 * 1024)],
                      [timestamps[1], String(4 * 1024 * 1024 * 1024)],
                      [timestamps[2], String(3 * 1024 * 1024 * 1024)],
                    ],
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }

        if (urlStr.includes("container_network_receive_bytes_total")) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                resultType: "matrix",
                result: [
                  {
                    metric: {},
                    values: [
                      [timestamps[0], "100000"],
                      [timestamps[1], "200000"],
                      [timestamps[2], "150000"],
                    ],
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }

        if (urlStr.includes("container_network_transmit_bytes_total")) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                resultType: "matrix",
                result: [
                  {
                    metric: {},
                    values: [
                      [timestamps[0], "50000"],
                      [timestamps[1], "80000"],
                      [timestamps[2], "60000"],
                    ],
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }

        return new Response(
          JSON.stringify({ status: "success", data: { result: [] } }),
          {
            status: 200,
          }
        )
      }
    )

    const summary = await fetchNamespaceTelemetry({
      organizationId: "org_alpha123",
      timeRange: "1h",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(mockResolveClusterIntegrationByClusterCode).toHaveBeenCalledWith(
      DEFAULT_CLUSTER_CODE,
      "PROMETHEUS"
    )

    // Verify Basic Auth header
    const expectedAuth = `Basic ${Buffer.from(
      "prom-user:prom-password"
    ).toString("base64")}`
    for (const h of requestedHeaders) {
      expect(h.Authorization).toBe(expectedAuth)
    }

    // Verify metadata
    expect(summary.clusterId).toBe(DEFAULT_CLUSTER_CODE)
    expect(summary.clusterName).toBe("Singapore Production")
    expect(summary.isPrimary).toBe(true)
    expect(summary.timeRange).toBe("1h")
    expect(summary.namespace).toBe("app-alpha123")

    // Verify points
    expect(summary.points).toHaveLength(3)
    expect(summary.points[0].cpuUsageCores).toBe(0.5)
    expect(summary.points[0].cpuLimitCores).toBe(4.0)
    expect(summary.points[0].memoryUsageBytes).toBe(2 * 1024 * 1024 * 1024)
    expect(summary.points[0].memoryLimitBytes).toBe(16 * 1024 * 1024 * 1024)
    expect(summary.points[0].networkRxBytesPerSec).toBe(100000)
    expect(summary.points[0].networkTxBytesPerSec).toBe(50000)
    expect(summary.points[0].timestamp).toMatch(/^\d{2}:\d{2}$/)

    // Verify CPU calculations
    expect(summary.cpu.currentCores).toBe(0.8)
    expect(summary.cpu.limitCores).toBe(4.0)
    expect(summary.cpu.avgCores).toBe(0.83) // (0.5 + 1.2 + 0.8) / 3 = 0.8333... -> 0.83
    expect(summary.cpu.peakCores).toBe(1.2)

    // Verify Memory calculations
    expect(summary.memory.currentBytes).toBe(3 * 1024 * 1024 * 1024)
    expect(summary.memory.limitBytes).toBe(16 * 1024 * 1024 * 1024)
    expect(summary.memory.avgBytes).toBe(3 * 1024 * 1024 * 1024)
    expect(summary.memory.peakBytes).toBe(4 * 1024 * 1024 * 1024)

    // Verify Network calculations
    expect(summary.network.currentRxBytes).toBe(150000)
    expect(summary.network.currentTxBytes).toBe(60000)
    // totalRx = (100000 + 200000 + 150000) * 300 = 450000 * 300 = 135000000
    expect(summary.network.totalRxBytes).toBe(135000000)
    // totalTx = (50000 + 80000 + 60000) * 300 = 190000 * 300 = 57000000
    expect(summary.network.totalTxBytes).toBe(57000000)
  })

  it("handles 6h and 24h time ranges with appropriate query step parameters", async () => {
    const captured6hUrls: string[] = []
    const mockFetch6h = mock(async (url: string | URL | Request) => {
      captured6hUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const summary6h = await fetchNamespaceTelemetry({
      organizationId: "org_six_hours",
      timeRange: "6h",
      fetchFn: mockFetch6h as unknown as typeof fetch,
    })

    expect(summary6h.timeRange).toBe("6h")
    // Step for 6h should be 1800 (30m)
    const rangeUrl6h = captured6hUrls.find((u) => u.includes("query_range"))
    expect(rangeUrl6h).toBeDefined()
    expect(rangeUrl6h).toContain("step=1800")

    const captured24hUrls: string[] = []
    const mockFetch24h = mock(async (url: string | URL | Request) => {
      captured24hUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const summary24h = await fetchNamespaceTelemetry({
      organizationId: "org_twenty_four",
      timeRange: "24h",
      fetchFn: mockFetch24h as unknown as typeof fetch,
    })

    expect(summary24h.timeRange).toBe("24h")
    // Step for 24h should be 7200 (2h)
    const rangeUrl24h = captured24hUrls.find((u) => u.includes("query_range"))
    expect(rangeUrl24h).toBeDefined()
    expect(rangeUrl24h).toContain("step=7200")
  })

  it("handles custom cluster code and custom step seconds", async () => {
    const capturedUrls: string[] = []
    const mockFetch = mock(async (url: string | URL | Request) => {
      capturedUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const summary = await fetchNamespaceTelemetry({
      organizationId: "app-custom",
      clusterCode: "sg-sin-1",
      stepSeconds: 60,
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(mockResolveClusterIntegrationByClusterCode).toHaveBeenCalledWith(
      "sg-sin-1",
      "PROMETHEUS"
    )
    expect(summary.clusterId).toBe("sg-sin-1")
    expect(summary.clusterName).toBe("Singapore Edge Cluster")
    expect(summary.isPrimary).toBe(false)

    const rangeUrl = capturedUrls.find((u) => u.includes("query_range"))
    expect(rangeUrl).toContain("step=60")
  })

  it("applies zero-pod fallback handling when Prometheus returns 0 metrics", async () => {
    // Return empty results for all queries
    const mockFetch = mock(async () => {
      return new Response(
        JSON.stringify({
          status: "success",
          data: {
            resultType: "matrix",
            result: [],
          },
        }),
        { status: 200 }
      )
    })

    const summary = await fetchNamespaceTelemetry({
      organizationId: "org_empty_namespace",
      timeRange: "1h",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    // Produces 12 points for 1h (3600 / 300)
    expect(summary.points).toHaveLength(12)

    // Flat baseline with standard fallback limits
    for (const point of summary.points) {
      expect(point.cpuUsageCores).toBe(0)
      expect(point.cpuLimitCores).toBe(FALLBACK_CPU_LIMIT_CORES)
      expect(point.memoryUsageBytes).toBe(0)
      expect(point.memoryLimitBytes).toBe(FALLBACK_MEMORY_LIMIT_BYTES)
      expect(point.networkRxBytesPerSec).toBe(0)
      expect(point.networkTxBytesPerSec).toBe(0)
      expect(point.timestamp).toMatch(/^\d{2}:\d{2}$/)
    }

    // Baseline aggregated stats
    expect(summary.cpu.currentCores).toBe(0)
    expect(summary.cpu.limitCores).toBe(FALLBACK_CPU_LIMIT_CORES)
    expect(summary.cpu.avgCores).toBe(0)
    expect(summary.cpu.peakCores).toBe(0)

    expect(summary.memory.currentBytes).toBe(0)
    expect(summary.memory.limitBytes).toBe(FALLBACK_MEMORY_LIMIT_BYTES)
    expect(summary.memory.avgBytes).toBe(0)
    expect(summary.memory.peakBytes).toBe(0)

    expect(summary.network.currentRxBytes).toBe(0)
    expect(summary.network.currentTxBytes).toBe(0)
    expect(summary.network.totalRxBytes).toBe(0)
    expect(summary.network.totalTxBytes).toBe(0)
  })

  it("throws descriptive error when Prometheus query returns HTTP error", async () => {
    const mockFetch = mock(async () => {
      return new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      })
    })

    await expect(
      fetchNamespaceTelemetry({
        organizationId: "org_failing",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow("Prometheus query failed (500): Internal Server Error")
  })
})
