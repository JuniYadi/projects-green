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

// Dynamic import required so mock.module registrations take effect prior to module evaluation.
const { appTelemetryRoutes } = await import("./app-telemetry.route")
const { deployRoutes } = await import("../deploy.route")

describe("appTelemetryRoutes", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockFetchNamespaceTelemetry.mockClear()
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
