import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWithAuth = mock(async () => ({
  user: {
    id: "user-123",
    email: "test@example.com",
  },
  organizationId: "org-1",
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockFetchNamespaceTelemetry = mock(async () => ({
  clusterName: "Singapore Production",
  region: "Singapore (sgp)",
  isPrimary: true,
  namespace: "app-org-1",
  timeRange: "1h",
  currentCpuLimitCores: 2,
  currentMemoryLimitBytes: 8589934592,
  metrics: [],
}))

mock.module("@/modules/deploy/prometheus-telemetry.service", () => ({
  fetchNamespaceTelemetry: mockFetchNamespaceTelemetry,
}))

const mockFindFirst = mock(
  async (): Promise<{ cpu: number | null; memory: number | null } | null> =>
    null
)

mock.module("@/lib/prisma", () => ({
  prisma: { applicationStack: { findFirst: mockFindFirst } },
}))

// Dynamic import required so mock.module registrations take effect prior to module evaluation.
const { appTelemetryRoutes } = await import("./app-telemetry.route")
const { deployRoutes } = await import("../deploy.route")

describe("appTelemetryRoutes", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockFetchNamespaceTelemetry.mockClear()
    mockFindFirst.mockClear()
    mockFindFirst.mockResolvedValue(null)
    mockWithAuth.mockResolvedValue({
      user: {
        id: "user-123",
        email: "test@example.com",
      },
      organizationId: "org-1",
    })
  })

  it("returns 401 if user is unauthenticated", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: null,
      organizationId: null,
    } as never)

    const response = await appTelemetryRoutes.handle(
      new Request("http://localhost/deploy/telemetry")
    )

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Unauthorized",
    })
  })

  it("returns 403 if user has no organizationId", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: {
        id: "user-123",
        email: "test@example.com",
      },
      organizationId: null,
    } as never)

    const response = await appTelemetryRoutes.handle(
      new Request("http://localhost/deploy/telemetry")
    )

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Organization required",
    })
  })

  it("returns 200 with telemetry data when authenticated, passing range & cluster to service", async () => {
    const mockData = {
      clusterName: "Jakarta Production Cluster",
      region: "Jakarta (id-cgk-1)",
      isPrimary: true,
      namespace: "app-org-1",
      timeRange: "6h" as const,
      currentCpuLimitCores: 2,
      currentMemoryLimitBytes: 8589934592,
      metrics: [],
    }
    mockFetchNamespaceTelemetry.mockResolvedValueOnce(mockData as never)

    const response = await appTelemetryRoutes.handle(
      new Request("http://localhost/deploy/telemetry?range=6h&cluster=id-cgk-1")
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({
      ok: true,
      data: mockData,
    })
    expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith({
      organizationId: "org-1",
      timeRange: "6h",
      clusterCode: "id-cgk-1",
    })
  })

  it("uses default range and cluster when omitted in query", async () => {
    const response = await appTelemetryRoutes.handle(
      new Request("http://localhost/deploy/telemetry")
    )

    expect(response.status).toBe(200)
    expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith({
      organizationId: "org-1",
      timeRange: "1h",
      clusterCode: "sgp",
    })
  })
  it("reports the app's configured limits instead of the cluster placeholder", async () => {
    mockFindFirst.mockResolvedValueOnce({ cpu: 1000, memory: 2048 })

    const response = await appTelemetryRoutes.handle(
      new Request("http://localhost/deploy/telemetry?appSlug=my-app")
    )

    expect(response.status).toBe(200)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { slug: "my-app", organizationId: "org-1" },
      select: { cpu: true, memory: true },
    })
    // Same floors the Helm builder applies: request 2048Mi -> limit 4096Mi.
    expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        limitsFallback: { cpuCores: 1, memoryBytes: 4096 * 1024 * 1024 },
      })
    )
  })

  it("supports fast ranges 5m, 15m, and 30m in query", async () => {
    for (const fastRange of ["5m", "15m", "30m"] as const) {
      mockFetchNamespaceTelemetry.mockClear()
      const response = await appTelemetryRoutes.handle(
        new Request(`http://localhost/deploy/telemetry?range=${fastRange}`)
      )

      expect(response.status).toBe(200)
      expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith({
        organizationId: "org-1",
        timeRange: fastRange,
        clusterCode: "sgp",
      })
    }
  })

  it("passes custom from, to, and tz query parameters to service", async () => {
    mockFetchNamespaceTelemetry.mockClear()
    const response = await appTelemetryRoutes.handle(
      new Request(
        "http://localhost/deploy/telemetry?from=1710000000&to=1710003600&tz=Asia/Jakarta&cluster=sg-sin-1"
      )
    )

    expect(response.status).toBe(200)
    expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith({
      organizationId: "org-1",
      timeRange: "custom",
      clusterCode: "sg-sin-1",
      from: "1710000000",
      to: "1710003600",
      timeZone: "Asia/Jakarta",
    })
  })

  it("preserves explicit range=custom with ISO from and to dates", async () => {
    mockFetchNamespaceTelemetry.mockClear()
    const fromIso = "2026-09-08T10:00:00Z"
    const toIso = "2026-09-08T11:00:00Z"
    const response = await appTelemetryRoutes.handle(
      new Request(
        `http://localhost/deploy/telemetry?range=custom&from=${encodeURIComponent(
          fromIso
        )}&to=${encodeURIComponent(toIso)}`
      )
    )

    expect(response.status).toBe(200)
    expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith({
      organizationId: "org-1",
      timeRange: "custom",
      clusterCode: "sgp",
      from: fromIso,
      to: toIso,
    })
  })

  it("passes view query parameter (compute or ingress) to service", async () => {
    for (const view of ["compute", "ingress"] as const) {
      mockFetchNamespaceTelemetry.mockClear()
      const response = await appTelemetryRoutes.handle(
        new Request(
          `http://localhost/deploy/telemetry?view=${view}&appSlug=my-app`
        )
      )
      expect(response.status).toBe(200)
      expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          view,
          appSlug: "my-app",
        })
      )
    }
  })

  it("returns 500 when service throws an unexpected error", async () => {
    mockFetchNamespaceTelemetry.mockRejectedValueOnce(
      new Error("Prometheus connection failed")
    )

    const response = await appTelemetryRoutes.handle(
      new Request("http://localhost/deploy/telemetry")
    )

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json).toEqual({
      ok: false,
      error: "TELEMETRY_ERROR",
      message: "Prometheus connection failed",
    })
  })

  it("is mounted and accessible via deployRoutes", async () => {
    const response = await deployRoutes.handle(
      new Request("http://localhost/deploy/telemetry")
    )

    expect(response.status).toBe(200)
    expect(mockFetchNamespaceTelemetry).toHaveBeenCalledWith({
      organizationId: "org-1",
      timeRange: "1h",
      clusterCode: "sgp",
    })
  })
})
