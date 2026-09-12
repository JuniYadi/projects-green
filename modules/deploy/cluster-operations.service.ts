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
  type ClusterLogSeverity,
  type ClusterLogsDTO,
  type ClusterMetricDTO,
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
/** OpenSearch stops counting here; anything at the cap is a floor, not a total. */
const TOTAL_HITS_CAP = 10_000

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

/**
 * `Missing <TYPE> integration for ...` means no row exists at all.
 * `Missing required cluster integration field: x` means the row exists but is
 * half-filled - reporting that as "not configured" hides the real problem.
 */
const providerIsMissing = (error: unknown): boolean =>
  error instanceof Error &&
  /^Missing [A-Z]+ integration for /.test(error.message)

const providerIsIncomplete = (error: unknown): boolean =>
  error instanceof Error &&
  /^Missing required cluster integration field: /.test(error.message)

const readIntegration = async <T>(
  clusterId: string,
  type: "ARGOCD" | "JENKINS" | "KUBECONFIG" | "OPENSEARCH" | "PROMETHEUS",
  provider: string
): Promise<{ config: T | null; state: ProviderStateInput }> => {
  try {
    const config = await resolveClusterIntegrationByClusterCode(clusterId, type)
    return { config: config as T, state: configurationOnly(provider, "") }
  } catch (error) {
    if (providerIsMissing(error)) {
      return {
        config: null,
        state: configurationOnly(provider, "Integration is not configured."),
      }
    }
    if (providerIsIncomplete(error)) {
      const field = (error as Error).message.split(": ").pop() ?? "a field"
      return {
        config: null,
        state: configurationOnly(
          provider,
          `Integration exists but ${field} is not set.`
        ),
      }
    }
    return { config: null, state: unavailable(provider, error) }
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

export const IN_CLUSTER_FALLBACK_SOURCE =
  "Portal's own cluster (in-cluster fallback)"

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
  if (config.usesInClusterFallback) {
    // The row has no apiServerUrl of its own, so any counts below would come
    // from the cluster the portal itself runs in - real numbers, wrong cluster.
    return {
      state: state(
        "configuration_only",
        IN_CLUSTER_FALLBACK_SOURCE,
        "This integration has no API server URL, so it would report the portal's own cluster. Set an explicit API server URL to verify this cluster.",
        false,
        null
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

const RANGE_SECONDS = { "1h": 3600, "6h": 21600, "24h": 86400 } as const

/** `/api/v1/query` only ever returns one point, so the range selector needs this. */
const queryPrometheusRange = async (
  config: PrometheusClusterConfig,
  query: string,
  range: keyof typeof RANGE_SECONDS
): Promise<Array<[number, number]>> => {
  const end = Math.floor(Date.now() / 1000)
  const start = end - RANGE_SECONDS[range]
  // ~60 points whatever the window, which is all a sparkline can show.
  const step = Math.max(15, Math.floor(RANGE_SECONDS[range] / 60))
  const endpoint =
    `${config.endpoint.replace(/\/$/, "")}/api/v1/query_range` +
    `?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
  try {
    const payload = await fetchJson<{
      data?: { result?: Array<{ values?: Array<[number, string]> }> }
    }>(endpoint, {
      headers: basicAuthHeaders(config.username, config.password),
    })
    return (payload.data?.result?.[0]?.values ?? []).flatMap<[number, number]>(
      ([at, raw]) => {
        const value = Number(raw)
        return Number.isFinite(value) && Number.isFinite(at)
          ? [[at, value]]
          : []
      }
    )
  } catch {
    // A missing range endpoint must not blank out the instant value beside it.
    return []
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
  const failing = providerValues.filter((value) =>
    ["unavailable", "forbidden"].includes(value.state)
  )
  const liveProviders = providerValues.filter((value) => value.state === "live")
  const workloadsDegraded =
    (kubernetes.nodes.total !== null &&
      kubernetes.nodes.ready !== kubernetes.nodes.total) ||
    (kubernetes.workloads.total !== null &&
      kubernetes.workloads.ready !== kubernetes.workloads.total)

  const status =
    liveProviders.length === 0
      ? "unknown"
      : kubernetes.state.state !== "live"
        ? "unverified"
        : failing.length > 0 || workloadsDegraded
          ? "degraded"
          : "healthy"

  const liveTabs = (
    [
      ["opensearch", "logs"],
      ["argocd", "deployments"],
      ["jenkins", "builds"],
      ["prometheus", "metrics"],
    ] as const
  )
    .filter(([key]) => providerStates[key].state === "live")
    .map(([, tab]) => tab)

  const verdict =
    status === "unknown"
      ? {
          headline: "No provider is connected",
          detail:
            "Nothing on this page is backed by a live observation. Configure at least one integration in Settings.",
          unaffected: null,
          action: null,
        }
      : status === "unverified"
        ? {
            headline: "Cannot verify this cluster",
            detail:
              kubernetes.state.message ??
              "Kubernetes API is not connected, so node and workload health is unknown.",
            unaffected:
              liveTabs.length > 0
                ? `${liveTabs.join(", ")} below are live and unaffected.`
                : null,
            action: "kubernetes" as const,
          }
        : status === "degraded"
          ? {
              headline: "Cluster is reachable but not fully healthy",
              detail:
                failing.length > 0
                  ? (failing[0].message ??
                    `${failing[0].source} is not responding.`)
                  : "Some nodes or workloads are not ready.",
              unaffected: null,
              action: null,
            }
          : {
              headline: "Cluster is healthy",
              detail:
                "Every configured provider answered and all nodes and workloads are ready.",
              unaffected: null,
              action: null,
            }

  // Roll-up of what the providers actually said. `stale` is never invented
  // here: a fresh observation is never stale, whatever its outcome.
  const rollup: ProviderStateInput =
    failing.length > 0
      ? failing[0]
      : liveProviders.length === providerValues.length
        ? live("Cluster provider observations")
        : state(
            liveProviders.length > 0 ? "live" : "configuration_only",
            "Cluster provider observations",
            `${liveProviders.length} of ${providerValues.length} providers connected.`,
            true,
            liveProviders[0]?.observedAt ?? null
          )

  return toClusterHealthDTO({
    status,
    verdict,
    nodes: kubernetes.nodes,
    workloads: kubernetes.workloads,
    recentDeployment: await latestDeployment(clusterId),
    provider: rollup,
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

const toText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null

/**
 * Ingest pipelines disagree about `level`: pino writes numbers (30/40/50),
 * monolog writes numeric strings (200/400/500) alongside `level_name`, and
 * some containers write plain words. Everything below maps onto one label.
 */
const SEVERITY_WORDS: Record<string, ClusterLogSeverity> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  notice: "INFO",
  log: "INFO",
  warn: "WARN",
  warning: "WARN",
  error: "ERROR",
  err: "ERROR",
  fatal: "ERROR",
  crit: "ERROR",
  critical: "ERROR",
  alert: "ERROR",
  emergency: "ERROR",
}

const severityFromNumber = (value: number): ClusterLogSeverity | null => {
  // pino: 10..60. monolog/PSR: 100..600. Both scale the same way.
  const scaled = value >= 100 ? value / 10 : value
  if (scaled >= 50) return "ERROR"
  if (scaled >= 40) return "WARN"
  if (scaled >= 30) return "INFO"
  if (scaled >= 10) return "DEBUG"
  return null
}

const severityLabelOf = (
  raw: unknown,
  levelName: unknown,
  httpStatus: number | null
): ClusterLogSeverity | null => {
  const named = toText(levelName) ?? toText(raw)
  if (named) {
    const word = SEVERITY_WORDS[named.trim().toLowerCase()]
    if (word) return word
  }
  const numeric = toNumber(raw)
  if (numeric !== null) return severityFromNumber(numeric)
  // HAProxy access rows carry no level at all; the response code is the signal.
  if (httpStatus !== null) {
    if (httpStatus >= 500) return "ERROR"
    if (httpStatus >= 400) return "WARN"
    return "INFO"
  }
  return null
}

const normalizeLog = (
  source: Record<string, unknown>,
  index: number
): ClusterLogDTO => {
  const timestamp =
    toText(source["@timestamp"]) ?? toText(source.time) ?? toText(source.date)
  const service =
    toText(nestedValue(source, ["service", "name"])) ??
    toText(nestedValue(source, ["kubernetes", "container_name"])) ??
    toText(source.container_name) ??
    toText(source.container) ??
    null
  const status = toNumber(
    nestedValue(source, ["http", "response", "status_code"]) ??
      source.http_status ??
      source.status ??
      source.statusCode
  )
  // HAProxy ingress documents are already structured - there is no `message`
  // field on them at all, which is why every row rendered as an em dash.
  const method = toText(source.http_method)
  const path = toText(source.http_path) ?? toText(source.route)
  const query = toText(source.http_query)
  const route =
    method || path
      ? [method, `${path ?? ""}${query ?? ""}`].filter(Boolean).join(" ")
      : (toText(nestedValue(source, ["http", "request", "path"])) ??
        toText(source.path))

  const explicitMessage =
    toText(source.message) ?? toText(source.log) ?? toText(source.msg)
  const clientIp = toText(source.client_ip)
  const backend = toText(source.haproxy_backend) ?? toText(source.haproxy_host)
  const latency = toNumber(source.response_time_ms)
  const accessSummary =
    !explicitMessage && (clientIp || backend)
      ? [
          clientIp ? `${clientIp} →` : null,
          backend,
          latency !== null ? `${latency}ms` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null

  return {
    id: String(source._id ?? source.id ?? `${timestamp ?? "unknown"}-${index}`),
    timestamp,
    severity:
      toText(source.level_name) ??
      (source.level === undefined || source.level === null
        ? null
        : String(source.level)) ??
      toText(source.severity) ??
      toText(source.log_level),
    severityLabel: severityLabelOf(
      source.level ?? source.severity ?? source.log_level,
      source.level_name,
      status
    ),
    service,
    namespace:
      toText(nestedValue(source, ["kubernetes", "namespace_name"])) ??
      toText(source.namespace),
    route,
    status,
    message: explicitMessage ?? accessSummary ?? "",
  }
}

/**
 * `level` is mapped `long` in some indices and `keyword` in others, so a term
 * query written for one type throws `number_format_exception` on the other and
 * silently drops those shards. `query_string` with `lenient` skips the fields
 * it cannot parse instead, which is the only form that matches both.
 */
const SEVERITY_TOKENS: Record<
  ClusterLogSeverity,
  { level: string[]; name: string[] }
> = {
  DEBUG: {
    level: ["10", "20", "100", "debug", "trace", "DEBUG", "TRACE"],
    name: ["DEBUG", "TRACE"],
  },
  INFO: {
    level: ["30", "200", "250", "info", "notice", "INFO", "NOTICE"],
    name: ["INFO", "NOTICE"],
  },
  WARN: {
    level: ["40", "300", "warn", "warning", "WARN", "WARNING"],
    name: ["WARNING", "WARN"],
  },
  ERROR: {
    level: [
      "50",
      "60",
      "400",
      "500",
      "550",
      "600",
      "error",
      "fatal",
      "critical",
      "ERROR",
      "FATAL",
      "CRITICAL",
    ],
    name: ["ERROR", "CRITICAL", "ALERT", "EMERGENCY"],
  },
}

export const LOG_SEVERITY_OPTIONS = Object.keys(
  SEVERITY_TOKENS
) as ClusterLogSeverity[]

const severityQuery = (
  level: string | undefined
): Record<string, unknown> | null => {
  if (!level || level === "ALL") return null
  const tokens = SEVERITY_TOKENS[level as ClusterLogSeverity]
  if (!tokens) return null
  const clause = [
    `level:(${tokens.level.join(" OR ")})`,
    `level_name:(${tokens.name.join(" OR ")})`,
    `severity:(${tokens.name.join(" OR ")})`,
  ].join(" OR ")
  return { query_string: { query: clause, lenient: true } }
}

/**
 * `kubernetes.container_name` is mapped `keyword` in most indices and `text`
 * with a `.keyword` sub-field in the rest, so neither name alone covers them
 * all. Both aggregations run and their keys are merged; a shard that cannot
 * serve one of them is covered by the other.
 */
const SERVICE_AGG_FIELDS = [
  "kubernetes.container_name",
  "kubernetes.container_name.keyword",
] as const

const logs = async (
  clusterId: string,
  query: ClusterOperationsQuery
): Promise<ClusterLogsDTO> => {
  await getCluster(clusterId)
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
      totalIsLowerBound: false,
      tookMs: null,
      services: [],
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
  const severityFilter = severityQuery(query.level)
  if (severityFilter) filters.push(severityFilter)
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
    // Explicit so the cap is a known number rather than an accidental one.
    track_total_hits: TOTAL_HITS_CAP,
    sort: [{ "@timestamp": { order: "desc", unmapped_type: "date" } }],
    query: { bool: { must, filter: filters } },
    aggs: {
      servicesRaw: { terms: { field: SERVICE_AGG_FIELDS[0], size: 50 } },
      servicesKeyword: { terms: { field: SERVICE_AGG_FIELDS[1], size: 50 } },
    },
  }

  try {
    const endpoint = `${integration.config.endpoint.replace(/\/$/, "")}/${patterns.join(",")}/_search`
    const response = await fetchJson<{
      took?: number
      hits?: {
        total?: number | { value?: number; relation?: string }
        hits?: Array<{ _id?: string; _source?: Record<string, unknown> }>
      }
      aggregations?: Record<
        string,
        { buckets?: Array<{ key?: string }> } | undefined
      >
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
    const rawTotal = response.hits?.total
    const total =
      typeof rawTotal === "number" ? rawTotal : (rawTotal?.value ?? 0)
    const totalIsLowerBound =
      typeof rawTotal === "object" && rawTotal?.relation === "gte"
    const entries = (response.hits?.hits ?? []).map((hit, index) =>
      normalizeLog({ ...(hit._source ?? {}), _id: hit._id }, index)
    )
    const services = Array.from(
      new Set(
        ["servicesRaw", "servicesKeyword"].flatMap((name) =>
          (response.aggregations?.[name]?.buckets ?? [])
            .map((bucket) => bucket.key)
            .filter((key): key is string => Boolean(key))
        )
      )
    ).sort()
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
      totalIsLowerBound,
      tookMs: response.took ?? null,
      services,
      entries,
    })
  } catch (error) {
    return toClusterLogsDTO({
      provider: unavailable(providerSource.opensearch, error),
      source,
      indexPatterns: patterns,
      total: 0,
      totalIsLowerBound: false,
      tookMs: null,
      services: [],
      entries: [],
    })
  }
}

const deployments = async (
  clusterId: string
): Promise<ClusterDeploymentsDTO> => {
  await getCluster(clusterId)
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
            finishedAt?: string
            syncResult?: { revision?: string }
          }
          reconciledAt?: string
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
      // Argo's own timestamp, not the moment this request was served.
      const argoObservedAt =
        status?.operationState?.finishedAt ??
        status?.operationState?.startedAt ??
        status?.reconciledAt ??
        null
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
        observedAt: argoObservedAt
          ? new Date(argoObservedAt)
          : application
            ? null
            : stack.updatedAt,
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

/** Jenkins `lastBuiltRevision.branch` is `{name,SHA1}[]` on multibranch jobs. */
const branchName = (value: unknown): string | null => {
  if (typeof value === "string") return toText(value)
  const first = Array.isArray(value) ? value[0] : value
  if (!first || typeof first !== "object") return null
  return toText((first as Record<string, unknown>).name)
}

const revisionSha = (
  revision: { SHA1?: unknown; branch?: unknown } | undefined
): string | null => {
  if (!revision) return null
  const direct = toText(revision.SHA1)
  if (direct) return direct
  const first = Array.isArray(revision.branch)
    ? revision.branch[0]
    : revision.branch
  if (!first || typeof first !== "object") return null
  return toText((first as Record<string, unknown>).SHA1)
}

const jobBelongsTo = (
  job: {
    name?: string
    scm?: { userRemoteConfigs?: Array<{ url?: unknown }> }
  },
  scopeFilter: string
): boolean => {
  const needle = scopeFilter.toLowerCase()
  const repo = needle.split("/").pop() ?? needle
  if ((job.name ?? "").toLowerCase().includes(repo)) return true
  return (job.scm?.userRemoteConfigs ?? []).some((remote) =>
    (toText(remote.url) ?? "").toLowerCase().includes(needle)
  )
}

const builds = async (clusterId: string): Promise<ClusterBuildsDTO> => {
  await getCluster(clusterId)
  const integration = await readIntegration<JenkinsClusterConfig>(
    clusterId,
    "JENKINS",
    providerSource.jenkins
  )
  if (!integration.config) {
    return toClusterBuildsDTO({
      provider: integration.state,
      scope: "all",
      scopeFilter: null,
      builds: [],
    })
  }
  // Jenkins hosts jobs for every cluster; without a DSL repo to filter on we
  // are listing the whole controller and must not imply otherwise.
  const scopeFilter =
    [integration.config.dslOwner, integration.config.dslRepo]
      .filter((value): value is string => Boolean(value))
      .join("/") || null
  const scope: "cluster" | "all" = scopeFilter ? "cluster" : "all"
  const config: JenkinsApiConfig = {
    baseUrl: integration.config.baseUrl,
    username: integration.config.username,
    apiToken: integration.config.apiToken,
  }
  try {
    const response = (await jenkinsApiFetch(
      "api/json?tree=jobs[name,url,scm[userRemoteConfigs[url]],lastBuild[number,result,building,timestamp,duration,artifacts,actions[parameters[name,value],lastBuiltRevision[SHA1,branch[name,SHA1]]]]]",
      {},
      config
    )) as {
      jobs?: Array<{
        name?: string
        url?: string
        scm?: { userRemoteConfigs?: Array<{ url?: unknown }> }
        lastBuild?: {
          number?: number
          result?: string | null
          building?: boolean
          timestamp?: number
          duration?: number
          artifacts?: unknown[]
          actions?: Array<{
            parameters?: Array<{ name?: string; value?: unknown }>
            lastBuiltRevision?: { SHA1?: unknown; branch?: unknown }
          }>
        }
      }>
    }
    const rows = (response.jobs ?? [])
      .filter((job) => job.name && job.lastBuild)
      .filter((job) => !scopeFilter || jobBelongsTo(job, scopeFilter))
      .map((job) => {
        const build = job.lastBuild!
        // Multibranch and DSL jobs return `branch` as an array of objects, so
        // every field out of Jenkins is coerced rather than passed through.
        const revision = build.actions?.find(
          (action) => action.lastBuiltRevision
        )?.lastBuiltRevision
        const parameters =
          build.actions?.flatMap((action) => action.parameters ?? []) ?? []
        const parameterBranch = parameters.find((parameter) =>
          /branch/i.test(parameter.name ?? "")
        )?.value
        return {
          job: job.name!,
          status: build.building ? "BUILDING" : (build.result ?? "PENDING"),
          branch:
            toText(parameterBranch) ?? branchName(revision?.branch) ?? null,
          commit: revisionSha(revision),
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
              scopeFilter
                ? `No Jenkins jobs matched ${scopeFilter}.`
                : "No Jenkins builds found.",
              true
            ),
      scope,
      scopeFilter,
      builds: rows,
    })
  } catch (error) {
    return toClusterBuildsDTO({
      provider: unavailable(providerSource.jenkins, error),
      scope,
      scopeFilter,
      builds: [],
    })
  }
}

type MetricDefinition = {
  name: string
  unit: string
  /** Tried in order; the first query that returns a sample wins. */
  candidates: Array<{ metric: string; query: string }>
  capacity?: Array<{ metric: string; query: string }>
}

const metricDefinitions = (
  rateWindow: string,
  overrides: Record<string, string[]>
): MetricDefinition[] => {
  const chain = (
    name: string,
    fallbacks: Array<{ metric: string; query: string }>
  ) => {
    const custom = overrides[name] ?? []
    return [
      ...custom.map((query) => ({ metric: "metaJson override", query })),
      ...fallbacks,
    ]
  }
  return [
    {
      name: "request_rate",
      unit: "requests/s",
      candidates: chain("request_rate", [
        {
          metric: "http_requests_total",
          query: `sum(rate(http_requests_total[${rateWindow}]))`,
        },
        {
          metric: "haproxy_backend_http_responses_total",
          query: `sum(rate(haproxy_backend_http_responses_total[${rateWindow}]))`,
        },
        {
          metric: "nginx_ingress_controller_requests",
          query: `sum(rate(nginx_ingress_controller_requests[${rateWindow}]))`,
        },
      ]),
    },
    {
      name: "error_4xx_rate",
      unit: "requests/s",
      candidates: chain("error_4xx_rate", [
        {
          metric: "http_requests_total",
          query: `sum(rate(http_requests_total{status=~"4.."}[${rateWindow}]))`,
        },
        {
          metric: "haproxy_backend_http_responses_total",
          query: `sum(rate(haproxy_backend_http_responses_total{code="4xx"}[${rateWindow}]))`,
        },
        {
          metric: "nginx_ingress_controller_requests",
          query: `sum(rate(nginx_ingress_controller_requests{status=~"4.."}[${rateWindow}]))`,
        },
      ]),
    },
    {
      name: "error_5xx_rate",
      unit: "requests/s",
      candidates: chain("error_5xx_rate", [
        {
          metric: "http_requests_total",
          query: `sum(rate(http_requests_total{status=~"5.."}[${rateWindow}]))`,
        },
        {
          metric: "haproxy_backend_http_responses_total",
          query: `sum(rate(haproxy_backend_http_responses_total{code="5xx"}[${rateWindow}]))`,
        },
        {
          metric: "nginx_ingress_controller_requests",
          query: `sum(rate(nginx_ingress_controller_requests{status=~"5.."}[${rateWindow}]))`,
        },
      ]),
    },
    {
      name: "p95_latency",
      unit: "seconds",
      candidates: chain("p95_latency", [
        {
          metric: "http_request_duration_seconds_bucket",
          query: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[${rateWindow}])) by (le))`,
        },
        {
          metric: "haproxy_backend_http_total_time_average_seconds",
          query:
            "avg(haproxy_backend_http_total_time_average_seconds) by (instance)",
        },
      ]),
    },
    {
      name: "cpu_usage",
      unit: "cores",
      candidates: chain("cpu_usage", [
        {
          metric: "container_cpu_usage_seconds_total",
          query: `sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[${rateWindow}]))`,
        },
      ]),
      capacity: [
        {
          metric: "kube_node_status_allocatable",
          query: 'sum(kube_node_status_allocatable{resource="cpu"})',
        },
        { metric: "machine_cpu_cores", query: "sum(machine_cpu_cores)" },
      ],
    },
    {
      name: "memory_usage",
      unit: "bytes",
      candidates: chain("memory_usage", [
        {
          metric: "container_memory_working_set_bytes",
          query:
            'sum(container_memory_working_set_bytes{container!="",container!="POD"})',
        },
      ]),
      capacity: [
        {
          metric: "kube_node_status_allocatable",
          query: 'sum(kube_node_status_allocatable{resource="memory"})',
        },
        {
          metric: "machine_memory_bytes",
          query: "sum(machine_memory_bytes)",
        },
      ],
    },
    {
      name: "storage_utilization",
      unit: "percent",
      // Already a ratio of used to capacity, so it carries no denominator of
      // its own - pairing it with a byte total renders bytes as a percentage.
      candidates: chain("storage_utilization", [
        {
          metric: "kubelet_volume_stats_used_bytes",
          query:
            "100 * sum(kubelet_volume_stats_used_bytes) / sum(kubelet_volume_stats_capacity_bytes)",
        },
      ]),
    },
  ]
}

const emptyMetrics = (definitions: MetricDefinition[]): ClusterMetricDTO[] =>
  definitions.map((definition) => ({
    name: definition.name,
    unit: definition.unit,
    value: null,
    sampleAt: null,
    capacity: null,
    series: [],
    matchedQuery: null,
    missingSeries: definition.candidates.map((candidate) => candidate.metric),
  }))

const readPrometheusOverrides = async (
  clusterId: string
): Promise<Record<string, string[]>> => {
  const integration = await prisma.appHostingClusterIntegration.findFirst({
    where: { clusterId, type: "PROMETHEUS" },
    select: { metaJson: true },
  })
  const meta = integration?.metaJson
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {}
  const queries = (meta as Record<string, unknown>).metricQueries
  if (!queries || typeof queries !== "object" || Array.isArray(queries)) {
    return {}
  }
  const overrides: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(
    queries as Record<string, unknown>
  )) {
    if (typeof value === "string" && value.trim()) overrides[key] = [value]
    if (Array.isArray(value)) {
      overrides[key] = value.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim())
      )
    }
  }
  return overrides
}

const metrics = async (
  clusterId: string,
  query: ClusterOperationsQuery
): Promise<ClusterMetricsDTO> => {
  await getCluster(clusterId)
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
  const overrides = await readPrometheusOverrides(clusterId)
  const definitions = metricDefinitions(rateWindow, overrides)
  if (!integration.config) {
    return toClusterMetricsDTO({
      provider: integration.state,
      range,
      metrics: emptyMetrics(definitions),
    })
  }
  const config = integration.config
  try {
    const results = await Promise.all(
      definitions.map(async (definition): Promise<ClusterMetricDTO> => {
        const missing: string[] = []
        let matched: { metric: string; query: string } | null = null
        let value: number | null = null
        let sampleAt: Date | null = null
        for (const candidate of definition.candidates) {
          const result = await queryPrometheus(config, candidate.query)
          if (result.value === null) {
            missing.push(candidate.metric)
            continue
          }
          matched = candidate
          value = result.value
          sampleAt = result.sampleAt
          break
        }
        const series = matched
          ? await queryPrometheusRange(config, matched.query, range)
          : []
        let capacity: number | null = null
        if (matched && definition.capacity) {
          for (const candidate of definition.capacity) {
            const result = await queryPrometheus(config, candidate.query)
            if (result.value !== null) {
              capacity = result.value
              break
            }
          }
        }
        return {
          name: definition.name,
          unit: definition.unit,
          value,
          sampleAt: sampleAt?.toISOString() ?? null,
          capacity,
          series,
          matchedQuery: matched?.query ?? null,
          missingSeries: missing,
        }
      })
    )
    const hasSamples = results.some((result) => result.value !== null)
    const found = results.filter((result) => result.value !== null).length
    return toClusterMetricsDTO({
      provider: hasSamples
        ? state(
            "live",
            providerSource.prometheus,
            found < results.length
              ? `${found} of ${results.length} series found.`
              : null,
            true,
            new Date()
          )
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
      metrics: emptyMetrics(definitions),
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
