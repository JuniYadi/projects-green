import { prisma } from "@/lib/prisma"
import {
  jenkinsApiFetch,
  type JenkinsApiConfig,
} from "@/modules/jenkins/jenkins-api"
import {
  resolveClusterIntegrationByClusterCode,
  type ArgoCdClusterConfig,
  type JenkinsClusterConfig,
  type KubeconfigClusterConfig,
  type OpenSearchClusterConfig,
  type PrometheusClusterConfig,
} from "./cluster-integration.service"
import {
  CLUSTER_OPERATION_VIEWS,
  type ClusterBuildsDTO,
  type ClusterDeploymentsDTO,
  type ClusterHealthDTO,
  type ClusterLogDTO,
  type ClusterLogsDTO,
  type ClusterMetricsDTO,
  type ClusterOperationView,
  type ClusterProviderState,
  toClusterBuildsDTO,
  toClusterDeploymentsDTO,
  toClusterHealthDTO,
  toClusterLogsDTO,
  toClusterMetricsDTO,
} from "./cluster-operations.dto"

const STALE_AFTER_MS = 5 * 60 * 1000
const DEFAULT_LOG_LIMIT = 100
const MAX_LOG_LIMIT = 500

export type ClusterOperationsQuery = {
  source?: "all" | "application" | "http"
  q?: string
  level?: string
  service?: string
  from?: string
  to?: string
  range?: "1h" | "6h" | "24h"
}

export class ClusterOperationsNotFoundError extends Error {
  constructor(clusterId: string) {
    super(`Cluster ${clusterId} not found`)
    this.name = "ClusterOperationsNotFoundError"
  }
}

class ProviderFetchError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ProviderFetchError"
  }
}

type ProviderStateInput = {
  state: ClusterProviderState
  source: string | null
  observedAt?: Date | null
  staleAfter?: Date | null
  message: string | null
  retryable: boolean
}

const nowWithExpiry = () => {
  const observedAt = new Date()
  return {
    observedAt,
    staleAfter: new Date(observedAt.getTime() + STALE_AFTER_MS),
  }
}

const state = (
  value: ClusterProviderState,
  source: string | null,
  message: string | null,
  retryable: boolean,
  observedAt?: Date | null
): ProviderStateInput => {
  const observation = observedAt ?? new Date()
  return {
    state: value,
    source,
    message,
    retryable,
    observedAt: observedAt ?? observation,
    staleAfter: new Date(observation.getTime() + STALE_AFTER_MS),
  }
}

const configurationOnly = (provider: string, message: string) =>
  state("configuration_only", provider, message, false, null)

const unavailable = (provider: string, error: unknown): ProviderStateInput => {
  const message = error instanceof Error ? error.message : String(error)
  if (
    error instanceof ProviderFetchError &&
    [401, 403].includes(error.status)
  ) {
    return state(
      "forbidden",
      provider,
      "Provider rejected the configured credentials.",
      true
    )
  }
  return state("unavailable", provider, message, true)
}

const live = (provider: string, message: string | null = null) => {
  const times = nowWithExpiry()
  return state("live", provider, message, true, times.observedAt)
}

const providerIsMissing = (error: unknown): boolean =>
  error instanceof Error && /^Missing /.test(error.message)

const readIntegration = async <T>(
  clusterId: string,
  type: "ARGOCD" | "JENKINS" | "KUBECONFIG" | "OPENSEARCH" | "PROMETHEUS",
  provider: string
): Promise<{ config: T | null; state: ProviderStateInput }> => {
  try {
    const config = await resolveClusterIntegrationByClusterCode(clusterId, type)
    return { config: config as T, state: configurationOnly(provider, "") }
  } catch (error) {
    return {
      config: null,
      state: providerIsMissing(error)
        ? configurationOnly(provider, "Integration is not configured.")
        : unavailable(provider, error),
    }
  }
}

type FetchOptions = RequestInit & {
  // Standard fetch ignores this extension; keep it for Bun-compatible transports.
  tls?: { ca?: string[]; rejectUnauthorized?: boolean }
}

const fetchJson = async <T>(
  url: string,
  init: FetchOptions = {},
  timeoutMs = 15000
): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new ProviderFetchError(
        `Provider returned HTTP ${response.status}`,
        response.status
      )
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Provider request timed out")
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const basicAuthHeaders = (username: string, password: string) => ({
  Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  Accept: "application/json",
})

const kubeHeaders = (config: KubeconfigClusterConfig) => ({
  Authorization: `Bearer ${config.serviceAccountToken}`,
  Accept: "application/json",
})

const providerSource = {
  kubernetes: "Kubernetes API",
  opensearch: "OpenSearch",
  argocd: "Argo CD",
  jenkins: "Jenkins",
  prometheus: "Prometheus",
} as const

const probeKubernetes = async (
  config: KubeconfigClusterConfig
): Promise<{
  state: ProviderStateInput
  nodes: { ready: number | null; total: number | null }
  workloads: { ready: number | null; total: number | null }
}> => {
  if (!config.apiServerUrl || !config.serviceAccountToken) {
    return {
      state: configurationOnly(
        providerSource.kubernetes,
        "Kubernetes API credentials are not configured."
      ),
      nodes: { ready: null, total: null },
      workloads: { ready: null, total: null },
    }
  }

  const baseUrl = config.apiServerUrl.replace(/\/$/, "")
  const init: FetchOptions = {
    headers: kubeHeaders(config),
    ...(config.caCertificate
      ? {
          tls: {
            ca: [config.caCertificate],
            rejectUnauthorized: true,
          },
        }
      : {}),
  }

  try {
    const [nodes, pods] = await Promise.all([
      fetchJson<{
        items?: Array<{
          status?: { conditions?: Array<{ type?: string; status?: string }> }
        }>
      }>(`${baseUrl}/api/v1/nodes`, init),
      fetchJson<{
        items?: Array<{
          status?: {
            phase?: string
            containerStatuses?: Array<{ ready?: boolean }>
          }
        }>
      }>(`${baseUrl}/api/v1/pods`, init),
    ])

    const nodeItems = nodes.items ?? []
    const podItems = pods.items ?? []
    const readyNodes = nodeItems.filter((node) =>
      node.status?.conditions?.some(
        (condition) => condition.type === "Ready" && condition.status === "True"
      )
    ).length
    const readyPods = podItems.filter(
      (pod) =>
        pod.status?.phase === "Running" &&
        (pod.status.containerStatuses ?? []).every(
          (container) => container.ready
        )
    ).length
    return {
      state: live(providerSource.kubernetes),
      nodes: { ready: readyNodes, total: nodeItems.length },
      workloads: { ready: readyPods, total: podItems.length },
    }
  } catch (error) {
    return {
      state: unavailable(providerSource.kubernetes, error),
      nodes: { ready: null, total: null },
      workloads: { ready: null, total: null },
    }
  }
}

const probeOpenSearch = async (
  config: OpenSearchClusterConfig
): Promise<ProviderStateInput> => {
  try {
    await fetchJson(
      `${config.endpoint.replace(/\/$/, "")}/_cluster/health`,
      {
        headers: basicAuthHeaders(config.username, config.password),
      },
      config.timeout * 1000
    )
    return live(providerSource.opensearch)
  } catch (error) {
    return unavailable(providerSource.opensearch, error)
  }
}

const probeArgoCd = async (
  config: ArgoCdClusterConfig
): Promise<ProviderStateInput> => {
  try {
    await fetchJson(
      `${config.apiUrl.replace(/\/$/, "")}/api/v1/applications?projects=${encodeURIComponent(config.project)}`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/json",
        },
      }
    )
    return live(providerSource.argocd)
  } catch (error) {
    return unavailable(providerSource.argocd, error)
  }
}

const probeJenkins = async (
  config: JenkinsClusterConfig
): Promise<ProviderStateInput> => {
  try {
    await jenkinsApiFetch(
      "api/json?tree=nodeName,mode",
      {},
      {
        baseUrl: config.baseUrl,
        username: config.username,
        apiToken: config.apiToken,
      }
    )
    return live(providerSource.jenkins)
  } catch (error) {
    return unavailable(providerSource.jenkins, error)
  }
}

const queryPrometheus = async (
  config: PrometheusClusterConfig,
  query: string
): Promise<{ value: number | null; sampleAt: Date | null }> => {
  const endpoint = `${config.endpoint.replace(/\/$/, "")}/api/v1/query?query=${encodeURIComponent(query)}`
  const payload = await fetchJson<{
    data?: { result?: Array<{ value?: [number, string] }> }
  }>(endpoint, {
    headers: basicAuthHeaders(config.username, config.password),
  })
  const point = payload.data?.result?.[0]?.value
  if (!point) return { value: null, sampleAt: null }
  const value = Number(point[1])
  return {
    value: Number.isFinite(value) ? value : null,
    sampleAt: Number.isFinite(point[0]) ? new Date(point[0] * 1000) : null,
  }
}

const probePrometheus = async (
  config: PrometheusClusterConfig
): Promise<ProviderStateInput> => {
  try {
    const result = await queryPrometheus(config, "up")
    return result.value === null
      ? state(
          "empty",
          providerSource.prometheus,
          "Prometheus returned no samples.",
          true,
          result.sampleAt
        )
      : live(providerSource.prometheus)
  } catch (error) {
    return unavailable(providerSource.prometheus, error)
  }
}

const getCluster = async (clusterId: string) => {
  const cluster = await prisma.appHostingCluster.findUnique({
    where: { id: clusterId },
    select: { id: true, code: true },
  })
  if (!cluster) throw new ClusterOperationsNotFoundError(clusterId)
  return cluster
}

const getProviderStates = async (clusterId: string) => {
  const [kubernetes, opensearch, argocd, jenkins, prometheus] =
    await Promise.all([
      readIntegration<KubeconfigClusterConfig>(
        clusterId,
        "KUBECONFIG",
        providerSource.kubernetes
      ),
      readIntegration<OpenSearchClusterConfig>(
        clusterId,
        "OPENSEARCH",
        providerSource.opensearch
      ),
      readIntegration<ArgoCdClusterConfig>(
        clusterId,
        "ARGOCD",
        providerSource.argocd
      ),
      readIntegration<JenkinsClusterConfig>(
        clusterId,
        "JENKINS",
        providerSource.jenkins
      ),
      readIntegration<PrometheusClusterConfig>(
        clusterId,
        "PROMETHEUS",
        providerSource.prometheus
      ),
    ])

  return { kubernetes, opensearch, argocd, jenkins, prometheus }
}

const latestDeployment = async (clusterId: string) => {
  const deployment = await prisma.applicationDeployment.findFirst({
    where: { stack: { clusterId } },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
      updatedAt: true,
      stack: { select: { slug: true } },
    },
  })
  return deployment
    ? {
        application: deployment.stack.slug,
        status: deployment.status,
        observedAt: deployment.updatedAt.toISOString(),
      }
    : null
}

const health = async (clusterId: string): Promise<ClusterHealthDTO> => {
  await getCluster(clusterId)
  const integrations = await getProviderStates(clusterId)
  const [kubernetes, opensearch, argocd, jenkins, prometheus] =
    await Promise.all([
      integrations.kubernetes.config
        ? probeKubernetes(integrations.kubernetes.config)
        : Promise.resolve({
            state: integrations.kubernetes.state,
            nodes: { ready: null, total: null },
            workloads: { ready: null, total: null },
          }),
      integrations.opensearch.config
        ? probeOpenSearch(integrations.opensearch.config).then((value) => ({
            state: value,
          }))
        : Promise.resolve({ state: integrations.opensearch.state }),
      integrations.argocd.config
        ? probeArgoCd(integrations.argocd.config).then((value) => ({
            state: value,
          }))
        : Promise.resolve({ state: integrations.argocd.state }),
      integrations.jenkins.config
        ? probeJenkins(integrations.jenkins.config).then((value) => ({
            state: value,
          }))
        : Promise.resolve({ state: integrations.jenkins.state }),
      integrations.prometheus.config
        ? probePrometheus(integrations.prometheus.config).then((value) => ({
            state: value,
          }))
        : Promise.resolve({ state: integrations.prometheus.state }),
    ])

  const providerStates = {
    kubernetes: kubernetes.state,
    opensearch: opensearch.state,
    argocd: argocd.state,
    jenkins: jenkins.state,
    prometheus: prometheus.state,
  }
  const providerValues = Object.values(providerStates)
  const hasUnavailable = providerValues.some((value) =>
    ["unavailable", "forbidden"].includes(value.state)
  )
  const hasLive = providerValues.some((value) => value.state === "live")
  const status = !hasLive
    ? "unknown"
    : kubernetes.state.state !== "live"
      ? "unreachable"
      : hasUnavailable ||
          (kubernetes.nodes.total !== null &&
            kubernetes.nodes.ready !== kubernetes.nodes.total) ||
          (kubernetes.workloads.total !== null &&
            kubernetes.workloads.ready !== kubernetes.workloads.total)
        ? "degraded"
        : "healthy"

  return toClusterHealthDTO({
    status,
    nodes: kubernetes.nodes,
    workloads: kubernetes.workloads,
    recentDeployment: await latestDeployment(clusterId),
    provider: state(
      status === "healthy"
        ? "live"
        : status === "unknown"
          ? "configuration_only"
          : "stale",
      "Cluster provider observations",
      null,
      true
    ),
    providers: providerStates,
  })
}

const logPatterns = (source: ClusterOperationsQuery["source"] = "all") => {
  if (source === "application") return ["app-*"]
  if (source === "http") return ["haproxy-controller-*"]
  return ["app-*", "haproxy-controller-*"]
}

const toNumber = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

const nestedValue = (value: unknown, keys: string[]): unknown => {
  let current = value
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const normalizeLog = (
  source: Record<string, unknown>,
  index: number
): ClusterLogDTO => {
  const timestamp = String(
    source["@timestamp"] ??
      source.timestamp ??
      source.time ??
      new Date().toISOString()
  )
  const service =
    String(
      nestedValue(source, ["service", "name"]) ??
        nestedValue(source, ["kubernetes", "container_name"]) ??
        source.container_name ??
        source.container ??
        ""
    ) || null
  const status = toNumber(
    nestedValue(source, ["http", "response", "status_code"]) ??
      source.status ??
      source.statusCode
  )
  return {
    id: String(source.id ?? source._id ?? `${timestamp}-${index}`),
    timestamp,
    severity:
      String(source.level ?? source.severity ?? source.log_level ?? "") || null,
    service,
    namespace:
      String(
        nestedValue(source, ["kubernetes", "namespace_name"]) ??
          source.namespace ??
          ""
      ) || null,
    route:
      String(
        nestedValue(source, ["http", "request", "path"]) ??
          source.route ??
          source.path ??
          ""
      ) || null,
    status,
    message: String(source.message ?? source.log ?? source.msg ?? ""),
  }
}

const logs = async (
  clusterId: string,
  query: ClusterOperationsQuery
): Promise<ClusterLogsDTO> => {
  const source = query.source ?? "all"
  const patterns = logPatterns(source)
  const integration = await readIntegration<OpenSearchClusterConfig>(
    clusterId,
    "OPENSEARCH",
    providerSource.opensearch
  )
  if (!integration.config) {
    return toClusterLogsDTO({
      provider: integration.state,
      source,
      indexPatterns: patterns,
      total: 0,
      tookMs: null,
      entries: [],
    })
  }

  const must: Array<Record<string, unknown>> = []
  const filters: Array<Record<string, unknown>> = []
  if (query.q?.trim()) {
    must.push({
      multi_match: {
        query: query.q.trim(),
        fields: ["message", "log", "msg", "service.name", "container_name"],
      },
    })
  }
  if (query.service && query.service !== "ALL") {
    filters.push({
      bool: {
        should: [
          { term: { "service.name.keyword": query.service } },
          { term: { "kubernetes.container_name.keyword": query.service } },
          { term: { "container_name.keyword": query.service } },
        ],
        minimum_should_match: 1,
      },
    })
  }
  if (query.level && query.level !== "ALL") {
    filters.push({
      bool: {
        should: [
          { term: { "level.keyword": query.level } },
          { term: { "severity.keyword": query.level } },
        ],
        minimum_should_match: 1,
      },
    })
  }
  if (query.from || query.to) {
    filters.push({
      range: {
        "@timestamp": {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      },
    })
  }
  const body = {
    size: Math.min(MAX_LOG_LIMIT, DEFAULT_LOG_LIMIT),
    sort: [{ "@timestamp": { order: "desc", unmapped_type: "date" } }],
    query: { bool: { must, filter: filters } },
  }

  try {
    const endpoint = `${integration.config.endpoint.replace(/\/$/, "")}/${patterns.join(",")}/_search`
    const response = await fetchJson<{
      took?: number
      hits?: {
        total?: number | { value?: number }
        hits?: Array<{ _id?: string; _source?: Record<string, unknown> }>
      }
    }>(
      endpoint,
      {
        method: "POST",
        headers: {
          ...basicAuthHeaders(
            integration.config.username,
            integration.config.password
          ),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      integration.config.timeout * 1000
    )
    const total =
      typeof response.hits?.total === "number"
        ? response.hits.total
        : (response.hits?.total?.value ?? 0)
    const entries = (response.hits?.hits ?? []).map((hit, index) =>
      normalizeLog({ ...(hit._source ?? {}), _id: hit._id }, index)
    )
    return toClusterLogsDTO({
      provider:
        entries.length > 0
          ? live(providerSource.opensearch)
          : state(
              "empty",
              providerSource.opensearch,
              "No logs matched the selected filters.",
              true
            ),
      source,
      indexPatterns: patterns,
      total,
      tookMs: response.took ?? null,
      entries,
    })
  } catch (error) {
    return toClusterLogsDTO({
      provider: unavailable(providerSource.opensearch, error),
      source,
      indexPatterns: patterns,
      total: 0,
      tookMs: null,
      entries: [],
    })
  }
}

const deployments = async (
  clusterId: string
): Promise<ClusterDeploymentsDTO> => {
  const stacks = await prisma.applicationStack.findMany({
    where: { clusterId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      slug: true,
      status: true,
      updatedAt: true,
    },
  })
  const integration = await readIntegration<ArgoCdClusterConfig>(
    clusterId,
    "ARGOCD",
    providerSource.argocd
  )
  const fallback = stacks.map((stack) => ({
    application: stack.slug,
    syncState: null,
    health: null,
    revision: null,
    author: null,
    message: stack.status,
    observedAt: stack.updatedAt,
    failureReason: null,
  }))
  if (!integration.config) {
    return toClusterDeploymentsDTO({
      provider: integration.state,
      deployments: fallback,
    })
  }

  try {
    const endpoint = `${integration.config.apiUrl.replace(/\/$/, "")}/api/v1/applications?projects=${encodeURIComponent(integration.config.project)}`
    const response = await fetchJson<{
      items?: Array<{
        metadata?: { name?: string }
        status?: {
          sync?: { status?: string; revision?: string }
          health?: { status?: string }
          operationState?: {
            message?: string
            startedAt?: string
            syncResult?: { revision?: string }
          }
          conditions?: Array<{ type?: string; message?: string }>
        }
      }>
    }>(endpoint, {
      headers: {
        Authorization: `Bearer ${integration.config.token}`,
        Accept: "application/json",
      },
    })
    const applications = new Map(
      (response.items ?? []).map((application) => [
        application.metadata?.name ?? "",
        application,
      ])
    )
    const rows = stacks.map((stack) => {
      const application = applications.get(stack.slug)
      const status = application?.status
      const condition = status?.conditions?.find(
        (item) => item.type === "SyncError"
      )
      return {
        application: stack.slug,
        syncState: status?.sync?.status ?? "NotFound",
        health: status?.health?.status ?? "Unknown",
        revision:
          status?.sync?.revision ??
          status?.operationState?.syncResult?.revision ??
          null,
        author: null,
        message: status?.operationState?.message ?? null,
        observedAt: new Date(),
        failureReason: condition?.message ?? null,
      }
    })
    return toClusterDeploymentsDTO({
      provider:
        rows.length > 0
          ? live(providerSource.argocd)
          : state(
              "empty",
              providerSource.argocd,
              "No application stacks are assigned to this cluster.",
              true
            ),
      deployments: rows,
    })
  } catch (error) {
    return toClusterDeploymentsDTO({
      provider: unavailable(providerSource.argocd, error),
      deployments: fallback,
    })
  }
}

const builds = async (clusterId: string): Promise<ClusterBuildsDTO> => {
  const integration = await readIntegration<JenkinsClusterConfig>(
    clusterId,
    "JENKINS",
    providerSource.jenkins
  )
  if (!integration.config) {
    return toClusterBuildsDTO({ provider: integration.state, builds: [] })
  }
  const config: JenkinsApiConfig = {
    baseUrl: integration.config.baseUrl,
    username: integration.config.username,
    apiToken: integration.config.apiToken,
  }
  try {
    const response = (await jenkinsApiFetch(
      "api/json?tree=jobs[name,url,lastBuild[number,result,building,timestamp,duration,artifacts,actions[parameters[name,value],lastBuiltRevision[SHA1,branch]]]]",
      {},
      config
    )) as {
      jobs?: Array<{
        name?: string
        url?: string
        lastBuild?: {
          number?: number
          result?: string | null
          building?: boolean
          timestamp?: number
          duration?: number
          artifacts?: unknown[]
          actions?: Array<{
            parameters?: Array<{ name?: string; value?: unknown }>
            lastBuiltRevision?: { SHA1?: string; branch?: string }
          }>
        }
      }>
    }
    const rows = (response.jobs ?? [])
      .filter((job) => job.name && job.lastBuild)
      .map((job) => {
        const build = job.lastBuild!
        const revision = build.actions?.find(
          (action) => action.lastBuiltRevision
        )?.lastBuiltRevision
        const parameters =
          build.actions?.flatMap((action) => action.parameters ?? []) ?? []
        const branch = parameters.find((parameter) =>
          /branch/i.test(parameter.name ?? "")
        )?.value
        return {
          job: job.name!,
          status: build.building ? "BUILDING" : (build.result ?? "PENDING"),
          branch:
            typeof branch === "string" ? branch : (revision?.branch ?? null),
          commit: revision?.SHA1 ?? null,
          durationMs: build.duration ?? null,
          startedAt: build.timestamp ? new Date(build.timestamp) : null,
          artifactCount: Array.isArray(build.artifacts)
            ? build.artifacts.length
            : null,
          url: job.url ?? null,
        }
      })
      .sort(
        (left, right) =>
          (right.startedAt?.getTime() ?? 0) - (left.startedAt?.getTime() ?? 0)
      )
    return toClusterBuildsDTO({
      provider:
        rows.length > 0
          ? live(providerSource.jenkins)
          : state(
              "empty",
              providerSource.jenkins,
              "No Jenkins builds found.",
              true
            ),
      builds: rows,
    })
  } catch (error) {
    return toClusterBuildsDTO({
      provider: unavailable(providerSource.jenkins, error),
      builds: [],
    })
  }
}

const metrics = async (
  clusterId: string,
  query: ClusterOperationsQuery
): Promise<ClusterMetricsDTO> => {
  const range = query.range ?? "1h"
  const rateWindowByRange = {
    "1h": "5m",
    "6h": "15m",
    "24h": "1h",
  } as const
  const rateWindow = rateWindowByRange[range]
  const integration = await readIntegration<PrometheusClusterConfig>(
    clusterId,
    "PROMETHEUS",
    providerSource.prometheus
  )
  const definitions = [
    {
      name: "request_rate",
      query: `sum(rate(http_requests_total[${rateWindow}]))`,
      unit: "requests/s",
    },
    {
      name: "error_4xx_rate",
      query: `sum(rate(http_requests_total{status=~"4.."}[${rateWindow}]))`,
      unit: "requests/s",
    },
    {
      name: "error_5xx_rate",
      query: `sum(rate(http_requests_total{status=~"5.."}[${rateWindow}]))`,
      unit: "requests/s",
    },
    {
      name: "p95_latency",
      query: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[${rateWindow}])) by (le))`,
      unit: "seconds",
    },
    {
      name: "cpu_usage",
      query: `sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[${rateWindow}]))`,
      unit: "cores",
    },
    {
      name: "memory_usage",
      query:
        'sum(container_memory_working_set_bytes{container!="",container!="POD"})',
      unit: "bytes",
    },
    {
      name: "storage_utilization",
      query:
        "100 * sum(kubelet_volume_stats_used_bytes) / sum(kubelet_volume_stats_capacity_bytes)",
      unit: "percent",
    },
  ] as const
  if (!integration.config) {
    return toClusterMetricsDTO({
      provider: integration.state,
      range,
      metrics: definitions.map(({ name, unit }) => ({
        name,
        unit,
        value: null,
        sampleAt: null,
      })),
    })
  }
  try {
    const results = await Promise.all(
      definitions.map(async (definition) => {
        const result = await queryPrometheus(
          integration.config!,
          definition.query
        )
        return {
          name: definition.name,
          unit: definition.unit,
          value: result.value,
          sampleAt: result.sampleAt?.toISOString() ?? null,
        }
      })
    )
    const hasSamples = results.some((result) => result.value !== null)
    return toClusterMetricsDTO({
      provider: hasSamples
        ? live(providerSource.prometheus)
        : state(
            "empty",
            providerSource.prometheus,
            "Prometheus returned no matching metric series.",
            true
          ),
      range,
      metrics: results,
    })
  } catch (error) {
    return toClusterMetricsDTO({
      provider: unavailable(providerSource.prometheus, error),
      range,
      metrics: definitions.map(({ name, unit }) => ({
        name,
        unit,
        value: null,
        sampleAt: null,
      })),
    })
  }
}

export async function getClusterOperations(
  clusterId: string,
  view: ClusterOperationView,
  query: ClusterOperationsQuery = {}
): Promise<
  | ClusterHealthDTO
  | ClusterLogsDTO
  | ClusterDeploymentsDTO
  | ClusterBuildsDTO
  | ClusterMetricsDTO
> {
  if (!CLUSTER_OPERATION_VIEWS.includes(view)) {
    throw new Error(`Unsupported cluster operation view: ${view}`)
  }
  switch (view) {
    case "health":
      return health(clusterId)
    case "logs":
      return logs(clusterId, query)
    case "deployments":
      return deployments(clusterId)
    case "builds":
      return builds(clusterId)
    case "metrics":
      return metrics(clusterId, query)
  }
}
