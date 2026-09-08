import { beforeEach, describe, expect, it, mock } from "bun:test"

const actualClusterIntegration = await import("./cluster-integration.service")
const mockResolveClusterIntegrationByClusterCode = mock(
  async (_code: string, _type: string) => ({
    endpoint: "https://prometheus.test.local",
    username: "prom-user",
    password: "prom-password",
  })
)

mock.module("./cluster-integration.service", () => ({
  ...actualClusterIntegration,
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

  it("converts org_ prefix to app-, normalizes underscores, and lowercases", () => {
    expect(formatTenantNamespace("org_01ks2abc")).toBe("app-01ks2abc")
    expect(formatTenantNamespace("org_TEST123")).toBe("app-test123")
    expect(formatTenantNamespace("org_prod_tenant")).toBe("app-prod-tenant")
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
  it("rejects invalid characters to prevent PromQL injection", () => {
    expect(() => formatTenantNamespace('org_tenant"}[2m]')).toThrow(
      "Invalid tenant namespace"
    )
    expect(() => formatTenantNamespace("app-test;drop table")).toThrow(
      "Invalid tenant namespace"
    )
    expect(() => formatTenantNamespace("org_evil${ns}")).toThrow(
      "Invalid tenant namespace"
    )
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
  it("handles 5m, 15m, and 30m fast time ranges with appropriate query parameters", async () => {
    const captured5mUrls: string[] = []
    const mockFetch5m = mock(async (url: string | URL | Request) => {
      captured5mUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const summary5m = await fetchNamespaceTelemetry({
      organizationId: "org_fast_5m",
      timeRange: "5m",
      fetchFn: mockFetch5m as unknown as typeof fetch,
    })

    expect(summary5m.timeRange).toBe("5m")
    const rangeUrl5m = captured5mUrls.find((u) => u.includes("query_range"))
    expect(rangeUrl5m).toBeDefined()
    expect(rangeUrl5m).toContain("step=15")
    expect(rangeUrl5m).toContain(encodeURIComponent("[30s]"))
    // For <=900s (5m), timestamps include seconds (HH:mm:ss)
    expect(summary5m.points[0].timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/)

    const captured15mUrls: string[] = []
    const mockFetch15m = mock(async (url: string | URL | Request) => {
      captured15mUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const summary15m = await fetchNamespaceTelemetry({
      organizationId: "org_fast_15m",
      timeRange: "15m",
      fetchFn: mockFetch15m as unknown as typeof fetch,
    })

    expect(summary15m.timeRange).toBe("15m")
    const rangeUrl15m = captured15mUrls.find((u) => u.includes("query_range"))
    expect(rangeUrl15m).toBeDefined()
    expect(rangeUrl15m).toContain("step=30")
    expect(rangeUrl15m).toContain(encodeURIComponent("[1m]"))
    expect(summary15m.points[0].timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/)

    const captured30mUrls: string[] = []
    const mockFetch30m = mock(async (url: string | URL | Request) => {
      captured30mUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const summary30m = await fetchNamespaceTelemetry({
      organizationId: "org_fast_30m",
      timeRange: "30m",
      fetchFn: mockFetch30m as unknown as typeof fetch,
    })

    expect(summary30m.timeRange).toBe("30m")
    const rangeUrl30m = captured30mUrls.find((u) => u.includes("query_range"))
    expect(rangeUrl30m).toBeDefined()
    expect(rangeUrl30m).toContain("step=60")
    expect(rangeUrl30m).toContain(encodeURIComponent("[2m]"))
    // For 30m (>900s), timestamps are HH:mm
    expect(summary30m.points[0].timestamp).toMatch(/^\d{2}:\d{2}$/)
  })

  it("handles custom from and to range options with unix seconds and ISO strings", async () => {
    const capturedUrls: string[] = []
    const mockFetch = mock(async (url: string | URL | Request) => {
      capturedUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const summary = await fetchNamespaceTelemetry({
      organizationId: "org_custom_window",
      from: 1710000000,
      to: 1710003600,
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(summary.timeRange).toBe("custom")
    expect(summary.from).toBe(1710000000)
    expect(summary.to).toBe(1710003600)
    const rangeUrl = capturedUrls.find((u) => u.includes("query_range"))
    expect(rangeUrl).toBeDefined()
    expect(rangeUrl).toContain("start=1710000000")
    expect(rangeUrl).toContain("end=1710003600")

    // Test with ISO date strings
    const isoCapturedUrls: string[] = []
    const mockIsoFetch = mock(async (url: string | URL | Request) => {
      isoCapturedUrls.push(url.toString())
      return new Response(
        JSON.stringify({ status: "success", data: { result: [] } }),
        { status: 200 }
      )
    })

    const fromIso = "2026-09-08T10:00:00.000Z"
    const toIso = "2026-09-08T11:00:00.000Z"
    const expectedStart = Math.floor(Date.parse(fromIso) / 1000)
    const expectedEnd = Math.floor(Date.parse(toIso) / 1000)

    const isoSummary = await fetchNamespaceTelemetry({
      organizationId: "org_iso_custom",
      timeRange: "custom",
      from: fromIso,
      to: toIso,
      fetchFn: mockIsoFetch as unknown as typeof fetch,
    })

    expect(isoSummary.timeRange).toBe("custom")
    expect(isoSummary.from).toBe(expectedStart)
    expect(isoSummary.to).toBe(expectedEnd)
    const isoRangeUrl = isoCapturedUrls.find((u) => u.includes("query_range"))
    expect(isoRangeUrl).toContain(`start=${expectedStart}`)
    expect(isoRangeUrl).toContain(`end=${expectedEnd}`)
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

  it("injects pod regex when appSlug is passed in options", async () => {
    const recordedQueries: string[] = []
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlString = url.toString()
      const queryParam = new URL(urlString).searchParams.get("query")
      if (queryParam) recordedQueries.push(queryParam)
      return new Response(
        JSON.stringify({
          status: "success",
          data: { resultType: "vector", result: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    })

    await fetchNamespaceTelemetry({
      organizationId: "org_workload_tenant",
      appSlug: "hermes-vibrant-comet",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(recordedQueries.length).toBeGreaterThan(0)
    for (const q of recordedQueries) {
      expect(q).toContain('pod=~"hermes-vibrant-comet.*"')
    }
  })

  it("extracts per-pod metrics from vector queries or falls back to workload-level pod summary", async () => {
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlString = decodeURIComponent(url.toString())
      if (urlString.includes("by (pod)")) {
        if (urlString.includes("container_cpu_usage_seconds_total")) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                result: [
                  {
                    metric: { pod: "hermes-vibrant-comet-deploy-0" },
                    value: [1725822607, "0.165"],
                  },
                  {
                    metric: { pod: "hermes-vibrant-comet-deploy-1" },
                    value: [1725822607, "0.082"],
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }
        if (urlString.includes("container_memory_working_set_bytes")) {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                result: [
                  {
                    metric: { pod: "hermes-vibrant-comet-deploy-0" },
                    value: [1725822607, "150994944"],
                  },
                  {
                    metric: { pod: "hermes-vibrant-comet-deploy-1" },
                    value: [1725822607, "134217728"],
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }
      }
      return new Response(
        JSON.stringify({
          status: "success",
          data: { resultType: "vector", result: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    })

    const summary = await fetchNamespaceTelemetry({
      organizationId: "org_multi_pod",
      appSlug: "hermes-vibrant-comet",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(summary.pods).toBeDefined()
    expect(summary.pods?.length).toBe(2)
    expect(summary.pods?.[0].pod).toBe("hermes-vibrant-comet-deploy-0")
    expect(summary.pods?.[0].cpuUsageCores).toBe(0.165)
    expect(summary.pods?.[0].memoryUsageBytes).toBe(150994944)
    expect(summary.pods?.[1].pod).toBe("hermes-vibrant-comet-deploy-1")
    expect(summary.pods?.[1].cpuUsageCores).toBe(0.082)
  })
})
