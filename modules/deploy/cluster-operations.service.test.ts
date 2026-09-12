import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockClusterFindUnique = mock(async () => ({
  id: "cl_1",
  code: "sgp",
}))
const mockDeploymentFindFirst = mock(async () => null)
const mockStackFindMany = mock(async () => [
  { slug: "api", status: "RUNNING", updatedAt: new Date("2026-01-01") },
])
const mockResolveClusterIntegrationByClusterCode = mock(
  async (_clusterId: string, type: string) => {
    const configs: Record<string, unknown> = {
      KUBECONFIG: {
        apiServerUrl: "https://k8s.test",
        serviceAccountToken: "token",
        caCertificate: null,
        kubeconfig: null,
        namespacePattern: "app-{slug}",
        labelSelector: "app={slug}",
      },
      OPENSEARCH: {
        endpoint: "https://search.test",
        username: "user",
        password: "password",
        sslVerify: true,
        timeout: 5,
      },
      ARGOCD: {
        apiUrl: "https://argo.test",
        token: "argo-token",
        project: "default",
        appNamespace: "argocd",
        webhookSecret: null,
        chartRepo: null,
        chartVersion: null,
      },
      JENKINS: {
        baseUrl: "https://jenkins.test",
        username: "jenkins",
        apiToken: "jenkins-token",
        webhookToken: "webhook-token",
        dslOwner: "pfnapp",
        dslRepo: "Jenkins",
        gitCredentialId: "github",
        sharedLibraryName: null,
        sharedLibraryBranch: null,
      },
      PROMETHEUS: {
        endpoint: "https://prometheus.test",
        username: "prometheus",
        password: "prometheus-password",
      },
    }
    return configs[type]
  }
)
const mockJenkinsApiFetch = mock(async (path: string) => {
  if (path.startsWith("api/json")) {
    return {
      jobs: [
        {
          name: "api-build",
          url: "https://jenkins.test/job/api-build/",
          lastBuild: {
            number: 3,
            result: "SUCCESS",
            building: false,
            timestamp: 1767225600000,
            duration: 1200,
            artifacts: [{ fileName: "image.tar" }],
            actions: [
              {
                parameters: [{ name: "BRANCH", value: "main" }],
                lastBuiltRevision: { SHA1: "abc123", branch: "main" },
              },
            ],
          },
        },
        {
          name: "worker-build",
          lastBuild: {
            number: 2,
            result: "FAILURE",
            building: false,
            timestamp: 1767229200000,
            duration: 900,
            actions: [],
          },
        },
      ],
    }
  }
  return { nodeName: "controller", mode: "NORMAL" }
})

mock.module("@/lib/prisma", () => ({
  prisma: {
    appHostingCluster: { findUnique: mockClusterFindUnique },
    applicationDeployment: { findFirst: mockDeploymentFindFirst },
    applicationStack: { findMany: mockStackFindMany },
  },
}))
mock.module("./cluster-integration.service", () => ({
  resolveClusterIntegrationByClusterCode:
    mockResolveClusterIntegrationByClusterCode,
}))
mock.module("@/modules/jenkins/jenkins-api", () => ({
  jenkinsApiFetch: mockJenkinsApiFetch,
}))

const { getClusterOperations } = await import("./cluster-operations.service")

const providerResponse = (url: string): Response => {
  if (url.endsWith("/api/v1/nodes")) {
    return Response.json({
      items: [
        {
          status: {
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
      ],
    })
  }
  if (url.endsWith("/api/v1/pods")) {
    return Response.json({
      items: [
        {
          status: {
            phase: "Running",
            containerStatuses: [{ ready: true }],
          },
        },
      ],
    })
  }
  if (url.includes("/_cluster/health"))
    return Response.json({ status: "green" })
  if (url.includes("/_search")) {
    return Response.json({
      took: 4,
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "log-1",
            _source: {
              "@timestamp": "2026-01-01T00:00:00.000Z",
              level: "INFO",
              message: "live log",
              service: { name: "api" },
            },
          },
        ],
      },
    })
  }
  if (url.includes("argo.test/api/v1/applications")) {
    return Response.json({
      items: [
        {
          metadata: { name: "api" },
          status: {
            sync: { status: "Synced", revision: "abc123" },
            health: { status: "Healthy" },
          },
        },
      ],
    })
  }
  if (url.includes("prometheus.test/api/v1/query")) {
    return Response.json({ data: { result: [{ value: [1767225600, "1.5"] }] } })
  }
  throw new Error(`Unexpected provider URL: ${url}`)
}
const prometheusQueries: string[] = []

describe("cluster operations service", () => {
  beforeEach(() => {
    mockClusterFindUnique.mockClear()
    mockDeploymentFindFirst.mockClear()
    mockStackFindMany.mockClear()
    mockResolveClusterIntegrationByClusterCode.mockClear()
    mockJenkinsApiFetch.mockClear()
    prometheusQueries.length = 0
    globalThis.fetch = mock(async (input) => {
      const url = String(input)
      if (url.includes("prometheus.test/api/v1/query")) {
        prometheusQueries.push(url)
      }
      return providerResponse(url)
    }) as unknown as typeof fetch
  })

  it("returns live observations from every configured provider", async () => {
    const health = await getClusterOperations("cl_1", "health")
    expect(health).toMatchObject({
      status: "healthy",
      nodes: { ready: 1, total: 1 },
      workloads: { ready: 1, total: 1 },
      providers: {
        kubernetes: { state: "live" },
        opensearch: { state: "live" },
        argocd: { state: "live" },
        jenkins: { state: "live" },
        prometheus: { state: "live" },
      },
    })

    const logs = await getClusterOperations("cl_1", "logs", {
      source: "application",
    })
    expect(logs).toMatchObject({
      provider: { state: "live" },
      indexPatterns: ["app-*"],
      entries: [{ message: "live log", service: "api" }],
    })

    const deployments = await getClusterOperations("cl_1", "deployments")
    expect(deployments).toMatchObject({
      provider: { state: "live" },
      deployments: [{ application: "api", syncState: "Synced" }],
    })

    const builds = await getClusterOperations("cl_1", "builds")
    expect(builds).toMatchObject({ provider: { state: "live" } })
    expect(
      "builds" in builds &&
        builds.builds.some(
          (build) =>
            build.job === "api-build" &&
            build.status === "SUCCESS" &&
            build.commit === "abc123" &&
            build.branch === "main"
        )
    ).toBe(true)

    const metrics = await getClusterOperations("cl_1", "metrics")
    expect(metrics).toMatchObject({ provider: { state: "live" } })
    expect("metrics" in metrics ? metrics.metrics[0] : null).toMatchObject({
      name: "request_rate",
      value: 1.5,
    })
    await getClusterOperations("cl_1", "metrics", { range: "24h" })
    expect(prometheusQueries.some((url) => url.includes("%5B1h%5D"))).toBe(true)
  })

  it("returns configuration-only states without fabricating provider data", async () => {
    mockResolveClusterIntegrationByClusterCode.mockRejectedValue(
      new Error("Missing provider integration")
    )

    const health = await getClusterOperations("cl_1", "health")
    expect(health).toMatchObject({
      status: "unknown",
      nodes: { ready: null, total: null },
      providers: {
        kubernetes: { state: "configuration_only" },
        opensearch: { state: "configuration_only" },
      },
    })

    const logs = await getClusterOperations("cl_1", "logs")
    expect(logs).toMatchObject({
      provider: { state: "configuration_only" },
      entries: [],
      total: 0,
    })
    mockClusterFindUnique.mockResolvedValueOnce(null as never)
    await expect(getClusterOperations("cl_1", "health")).rejects.toThrow(
      "Cluster cl_1 not found"
    )

    const metrics = await getClusterOperations("cl_1", "metrics")
    expect(metrics).toMatchObject({
      provider: { state: "configuration_only" },
    })
    expect("metrics" in metrics ? metrics.metrics[0] : null).toMatchObject({
      value: null,
    })

    mockResolveClusterIntegrationByClusterCode.mockImplementation(
      async (_clusterId, type) => {
        if (type === "OPENSEARCH") {
          return {
            endpoint: "https://search.test",
            username: "user",
            password: "password",
            sslVerify: true,
            timeout: 5,
          }
        }
        throw new Error("Missing provider integration")
      }
    )
    globalThis.fetch = mock(
      async () => new Response("forbidden", { status: 403 })
    ) as unknown as typeof fetch
    const forbiddenLogs = await getClusterOperations("cl_1", "logs")
    expect(forbiddenLogs).toMatchObject({
      provider: { state: "forbidden" },
      entries: [],
    })
    mockResolveClusterIntegrationByClusterCode.mockImplementation(
      async (_clusterId, type) => {
        if (type === "PROMETHEUS") {
          return {
            endpoint: "https://prometheus.test",
            username: "prometheus",
            password: "prometheus-password",
          }
        }
        throw new Error("Missing provider integration")
      }
    )
    globalThis.fetch = mock(async () => {
      throw new Error("Prometheus unavailable")
    }) as unknown as typeof fetch
    const unavailableMetrics = await getClusterOperations("cl_1", "metrics")
    expect(unavailableMetrics).toMatchObject({
      provider: { state: "unavailable" },
    })
    expect(
      "metrics" in unavailableMetrics ? unavailableMetrics.metrics[0] : null
    ).toMatchObject({ value: null })
  })
})
