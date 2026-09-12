export const CLUSTER_OPERATION_VIEWS = [
  "health",
  "logs",
  "deployments",
  "builds",
  "metrics",
] as const

export type ClusterOperationView = (typeof CLUSTER_OPERATION_VIEWS)[number]

export type ClusterProviderState =
  | "live"
  | "empty"
  | "stale"
  | "unavailable"
  | "forbidden"
  | "configuration_only"

export type ClusterProviderStateDTO = {
  state: ClusterProviderState
  source: string | null
  observedAt: string | null
  staleAfter: string | null
  message: string | null
  retryable: boolean
}

type ProviderStateInput = Omit<
  ClusterProviderStateDTO,
  "observedAt" | "staleAfter"
> & {
  observedAt?: Date | null
  staleAfter?: Date | null
}

const isoOrNull = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null

export const toProviderStateDTO = (
  input: ProviderStateInput
): ClusterProviderStateDTO => ({
  state: input.state,
  source: input.source,
  observedAt: isoOrNull(input.observedAt),
  staleAfter: isoOrNull(input.staleAfter),
  message: input.message,
  retryable: input.retryable,
})

export type ClusterProviderKey =
  "kubernetes" | "opensearch" | "argocd" | "jenkins" | "prometheus"

export type ClusterHealthDTO = {
  provider: ClusterProviderStateDTO
  status: "healthy" | "degraded" | "unverified" | "unknown"
  /**
   * Why `status` is what it is, in the admin's terms. Never a provider signal
   * on its own - `unverified` means "we did not ask", not "the cluster is down".
   */
  verdict: {
    headline: string
    detail: string
    unaffected: string | null
    action: ClusterProviderKey | null
  }
  nodes: { ready: number | null; total: number | null }
  workloads: { ready: number | null; total: number | null }
  recentDeployment: {
    application: string
    status: string
    observedAt: string
  } | null
  providers: Record<ClusterProviderKey, ClusterProviderStateDTO>
}

type HealthInput = Omit<ClusterHealthDTO, "provider" | "providers"> & {
  provider: ProviderStateInput
  providers: Record<ClusterProviderKey, ProviderStateInput>
}

export const toClusterHealthDTO = (input: HealthInput): ClusterHealthDTO => ({
  status: input.status,
  verdict: input.verdict,
  nodes: input.nodes,
  workloads: input.workloads,
  recentDeployment: input.recentDeployment,
  provider: toProviderStateDTO(input.provider),
  providers: Object.fromEntries(
    Object.entries(input.providers).map(([key, value]) => [
      key,
      toProviderStateDTO(value),
    ])
  ) as Record<ClusterProviderKey, ClusterProviderStateDTO>,
})

export type ClusterLogSeverity = "DEBUG" | "INFO" | "WARN" | "ERROR"

export type ClusterLogDTO = {
  id: string
  /** `null` when the document carries no timestamp - never the read time. */
  timestamp: string | null
  /** Raw provider value, e.g. pino `"30"` or monolog `"200"`. */
  severity: string | null
  /** Raw value mapped onto the four levels the filter offers. */
  severityLabel: ClusterLogSeverity | null
  service: string | null
  namespace: string | null
  route: string | null
  status: number | null
  message: string
}

export type ClusterLogsDTO = {
  provider: ClusterProviderStateDTO
  source: "all" | "application" | "http"
  indexPatterns: string[]
  total: number
  /** `true` when `total` is OpenSearch's `track_total_hits` cap, not a count. */
  totalIsLowerBound: boolean
  tookMs: number | null
  /** Distinct container names from a terms aggregation, not from the page. */
  services: string[]
  entries: ClusterLogDTO[]
}

type LogsInput = Omit<ClusterLogsDTO, "provider"> & {
  provider: ProviderStateInput
}

export const toClusterLogsDTO = (input: LogsInput): ClusterLogsDTO => ({
  source: input.source,
  indexPatterns: input.indexPatterns,
  total: input.total,
  totalIsLowerBound: input.totalIsLowerBound,
  tookMs: input.tookMs,
  services: input.services,
  entries: input.entries,
  provider: toProviderStateDTO(input.provider),
})

export type ClusterDeploymentDTO = {
  application: string
  syncState: string | null
  health: string | null
  revision: string | null
  author: string | null
  message: string | null
  observedAt: string | null
  failureReason: string | null
}

export type ClusterDeploymentsDTO = {
  provider: ClusterProviderStateDTO
  deployments: ClusterDeploymentDTO[]
}

type DeploymentsInput = Omit<
  ClusterDeploymentsDTO,
  "provider" | "deployments"
> & {
  provider: ProviderStateInput
  deployments: Array<
    Omit<ClusterDeploymentDTO, "observedAt"> & {
      observedAt?: Date | null
    }
  >
}

export const toClusterDeploymentsDTO = (
  input: DeploymentsInput
): ClusterDeploymentsDTO => ({
  provider: toProviderStateDTO(input.provider),
  deployments: input.deployments.map((deployment) => ({
    ...deployment,
    observedAt: isoOrNull(deployment.observedAt),
  })),
})

export type ClusterBuildDTO = {
  job: string
  status: string
  branch: string | null
  commit: string | null
  durationMs: number | null
  startedAt: string | null
  artifactCount: number | null
  url: string | null
}

export type ClusterBuildsDTO = {
  provider: ClusterProviderStateDTO
  /**
   * `cluster` when the Jenkins integration names a DSL repo to filter by,
   * `all` when every job on the controller is listed regardless of owner.
   */
  scope: "cluster" | "all"
  scopeFilter: string | null
  builds: ClusterBuildDTO[]
}

type BuildsInput = Omit<ClusterBuildsDTO, "provider" | "builds"> & {
  provider: ProviderStateInput
  builds: Array<
    Omit<ClusterBuildDTO, "startedAt"> & {
      startedAt?: Date | null
    }
  >
}

export const toClusterBuildsDTO = (input: BuildsInput): ClusterBuildsDTO => ({
  provider: toProviderStateDTO(input.provider),
  scope: input.scope,
  scopeFilter: input.scopeFilter,
  builds: input.builds.map((build) => ({
    ...build,
    startedAt: isoOrNull(build.startedAt),
  })),
})

export type ClusterMetricDTO = {
  name: string
  value: number | null
  unit: string
  sampleAt: string | null
  /** Denominator for a capacity reading, `null` when there is no series. */
  capacity: number | null
  /** `[unixSeconds, value]` points over `range`, empty when nothing matched. */
  series: Array<[number, number]>
  /** The PromQL that produced `value`, or `null` when nothing matched. */
  matchedQuery: string | null
  /** Metric names tried and not found, so the tile can say what is missing. */
  missingSeries: string[]
}

export type ClusterMetricsDTO = {
  provider: ClusterProviderStateDTO
  range: "1h" | "6h" | "24h"
  seriesFound: number
  seriesTotal: number
  metrics: ClusterMetricDTO[]
}

type MetricsInput = Omit<
  ClusterMetricsDTO,
  "provider" | "seriesFound" | "seriesTotal"
> & {
  provider: ProviderStateInput
}

export const toClusterMetricsDTO = (
  input: MetricsInput
): ClusterMetricsDTO => ({
  range: input.range,
  seriesFound: input.metrics.filter((metric) => metric.value !== null).length,
  seriesTotal: input.metrics.length,
  metrics: input.metrics,
  provider: toProviderStateDTO(input.provider),
})

export type ClusterOperationsDTO =
  | ClusterHealthDTO
  | ClusterLogsDTO
  | ClusterDeploymentsDTO
  | ClusterBuildsDTO
  | ClusterMetricsDTO
