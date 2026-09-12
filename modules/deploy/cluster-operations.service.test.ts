import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockClusterFindUnique = mock(async () => ({
  id: "cl_1",
  code: "sgp",
}))
const mockDeploymentFindFirst = mock(async () => null)
const mockStackFindMany = mock(async () => [
  { slug: "api", status: "RUNNING", updatedAt: new Date("2026-01-01") },
])
const mockIntegrationFindFirst = mock(async () => null as unknown)
const defaultIntegrationConfigs = async (_clusterId: string, type: string) => {
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
const mockResolveClusterIntegrationByClusterCode = mock(
  defaultIntegrationConfigs
)
const mockJenkinsApiFetch = mock(async (path: string) => {
  if (path.startsWith("api/json")) {
    return {
      jobs: [
        {
          name: "Jenkins-api-build",
          url: "https://jenkins.test/job/Jenkins-api-build/",
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
          // Multibranch/DSL jobs return branch as an array of objects.
          name: "Jenkins-multibranch",
          scm: {
            userRemoteConfigs: [{ url: "git@github.com:pfnapp/Jenkins" }],
          },
          lastBuild: {
            number: 7,
            result: "SUCCESS",
            building: false,
            timestamp: 1767232800000,
            duration: 4500,
            actions: [
              {
                lastBuiltRevision: {
                  SHA1: "deadbeefcafe",
                  branch: [{}],
                },
              },
            ],
          },
        },
        {
          name: "pfnapp-cakra-api",
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
    appHostingClusterIntegration: { findFirst: mockIntegrationFindFirst },
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
    mockIntegrationFindFirst.mockClear()
    mockIntegrationFindFirst.mockResolvedValue(null as never)
    mockResolveClusterIntegrationByClusterCode.mockClear()
    mockResolveClusterIntegrationByClusterCode.mockImplementation(
      defaultIntegrationConfigs
    )
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
    expect(builds).toMatchObject({
      provider: { state: "live" },
      scope: "cluster",
      scopeFilter: "pfnapp/Jenkins",
    })
    const buildRows = "builds" in builds ? builds.builds : []
    expect(buildRows.map((build) => build.job)).toEqual([
      "Jenkins-multibranch",
      "Jenkins-api-build",
    ])
    expect(buildRows).toContainEqual(
      expect.objectContaining({
        job: "Jenkins-api-build",
        status: "SUCCESS",
        commit: "abc123",
        branch: "main",
        durationMs: 1200,
      })
    )
    // branch: [{}] must never reach the DTO as an object.
    const multibranch = buildRows.find(
      (build) => build.job === "Jenkins-multibranch"
    )
    expect(multibranch?.branch).toBeNull()
    expect(multibranch?.commit).toBe("deadbeefcafe")
    for (const build of buildRows) {
      expect(["string", "object"]).toContain(typeof build.branch)
      if (build.branch !== null) expect(typeof build.branch).toBe("string")
      if (build.commit !== null) expect(typeof build.commit).toBe("string")
    }

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
      new Error("Missing OPENSEARCH integration for App Hosting cluster sgp")
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
        throw new Error(
          "Missing OPENSEARCH integration for App Hosting cluster sgp"
        )
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
        throw new Error(
          "Missing OPENSEARCH integration for App Hosting cluster sgp"
        )
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

  it("labels numeric pino levels and never invents a timestamp", async () => {
    globalThis.fetch = mock(async (input) => {
      const url = String(input)
      if (!url.includes("/_search")) return providerResponse(url)
      return Response.json({
        took: 3,
        hits: {
          total: { value: 10000, relation: "gte" },
          hits: [
            {
              _id: "pino",
              _source: {
                "@timestamp": "2026-09-10T09:08:15.529Z",
                level: 40,
                message: "request completed",
                kubernetes: {
                  container_name: "deploy",
                  namespace_name: "app-demo",
                },
              },
            },
            {
              _id: "monolog",
              _source: {
                "@timestamp": "2026-09-10T09:08:16.000Z",
                level: "500",
                level_name: "CRITICAL",
                message: "GET /api/user HTTP/1.1",
              },
            },
            { _id: "undated", _source: { message: "no time on this one" } },
          ],
        },
        aggregations: {
          // container_name is keyword in most indices and text+.keyword in the
          // rest, so both aggregations run and their keys merge.
          servicesRaw: { buckets: [{ key: "deploy" }] },
          servicesKeyword: { buckets: [{ key: "ingress" }, { key: "deploy" }] },
        },
      })
    }) as unknown as typeof fetch

    const logs = await getClusterOperations("cl_1", "logs", {
      source: "application",
    })
    if (!("entries" in logs)) throw new Error("expected logs")
    expect(logs.entries[0]).toMatchObject({
      severity: "40",
      severityLabel: "WARN",
      service: "deploy",
      namespace: "app-demo",
    })
    expect(logs.entries[1]).toMatchObject({
      severity: "CRITICAL",
      severityLabel: "ERROR",
    })
    // A document with no timestamp must surface as null, not as "now".
    expect(logs.entries[2].timestamp).toBeNull()
    expect(logs.services).toEqual(["deploy", "ingress"])
    // 10,000 is the track_total_hits cap, not a count.
    expect(logs.total).toBe(10000)
    expect(logs.totalIsLowerBound).toBe(true)
  })

  it("maps HAProxy ingress documents that carry no message field", async () => {
    let searchBody: Record<string, unknown> = {}
    globalThis.fetch = mock(async (input, init) => {
      const url = String(input)
      if (!url.includes("/_search")) return providerResponse(url)
      searchBody = JSON.parse(String((init as RequestInit)?.body ?? "{}"))
      return Response.json({
        took: 5,
        hits: {
          total: { value: 270, relation: "eq" },
          hits: [
            {
              _id: "haproxy",
              _source: {
                "@timestamp": "2026-09-10T09:08:15.584Z",
                client_ip: "182.3.36.220",
                haproxy_host: "api.metagocoin.com",
                haproxy_backend: "app-metagocoin-api_svc_http",
                http_method: "GET",
                http_path: "/dex-swap/quote",
                http_query: "?code=GKC_USDT_BUY",
                http_status: 503,
                response_time_ms: 121,
                kubernetes: {
                  container_name: "kubernetes-ingress-controller",
                  namespace_name: "haproxy-controller",
                },
              },
            },
          ],
        },
      })
    }) as unknown as typeof fetch

    const logs = await getClusterOperations("cl_1", "logs", {
      source: "http",
      level: "ERROR",
    })
    if (!("entries" in logs)) throw new Error("expected logs")
    expect(logs.entries[0]).toMatchObject({
      route: "GET /dex-swap/quote?code=GKC_USDT_BUY",
      status: 503,
      severityLabel: "ERROR",
      service: "kubernetes-ingress-controller",
    })
    expect(logs.entries[0].message).toContain("182.3.36.220")
    expect(logs.entries[0].message).not.toBe("")
    expect(logs.totalIsLowerBound).toBe(false)
    // level is long in some indices and keyword in others; only a lenient
    // query_string matches both instead of dropping those shards.
    expect(JSON.stringify(searchBody)).toContain('"lenient":true')
    expect(searchBody.track_total_hits).toBe(10000)
  })

  it("does not report node counts from the portal's own cluster", async () => {
    mockResolveClusterIntegrationByClusterCode.mockImplementation(
      async (_clusterId, type) => {
        if (type !== "KUBECONFIG") {
          throw new Error(
            `Missing ${type} integration for App Hosting cluster sgp`
          )
        }
        return {
          connectionMode: "INTERNAL",
          apiServerUrl: "https://kubernetes.default.svc",
          serviceAccountToken: "in-cluster-token",
          caCertificate: null,
          kubeconfig: null,
          namespacePattern: "app-{slug}",
          labelSelector: "app={slug}",
          usesInClusterFallback: true,
        }
      }
    )

    const health = await getClusterOperations("cl_1", "health")
    expect(health).toMatchObject({
      status: "unknown",
      nodes: { ready: null, total: null },
      providers: {
        kubernetes: {
          state: "configuration_only",
          source: "Portal's own cluster (in-cluster fallback)",
        },
      },
    })
    // Never "stale" for an observation taken just now.
    expect("provider" in health && health.provider.state).not.toBe("stale")
  })

  it("separates a missing integration from an incomplete one", async () => {
    mockResolveClusterIntegrationByClusterCode.mockImplementation(
      async (_clusterId, type) => {
        if (type === "JENKINS") {
          throw new Error(
            "Missing required cluster integration field: gitCredentialId"
          )
        }
        throw new Error(
          `Missing ${type} integration for App Hosting cluster sgp`
        )
      }
    )
    const health = await getClusterOperations("cl_1", "health")
    if (!("providers" in health)) throw new Error("expected health")
    expect(health.providers.jenkins.message).toBe(
      "Integration exists but gitCredentialId is not set."
    )
    expect(health.providers.argocd.message).toBe(
      "Integration is not configured."
    )
  })

  it("404s on an unknown cluster for every view, not just health", async () => {
    for (const view of ["logs", "deployments", "builds", "metrics"] as const) {
      mockClusterFindUnique.mockResolvedValueOnce(null as never)
      await expect(getClusterOperations("nope", view)).rejects.toThrow(
        "Cluster nope not found"
      )
    }
  })
})
