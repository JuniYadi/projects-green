import type {
  ClusterTelemetrySummary,
  PodMetricPoint,
  PodMetricSummary,
  PodStatusState,
  TelemetryDataPoint,
} from "./telemetry.types"
import { resolveClusterIntegrationByClusterCode } from "./cluster-integration.service"
import {
  type PredefinedTimeRange,
  PRESET_SECONDS,
  formatTelemetryTick,
  resolveTimeRangeBounds,
} from "@/lib/time-range"
import { generateClusterTelemetrySummary } from "./telemetry.service"

export const DEFAULT_CLUSTER_CODE = "sgp"
export const DEFAULT_TIME_RANGE: PredefinedTimeRange = "1h"
export const FALLBACK_CPU_LIMIT_CORES = 2.0
export const FALLBACK_MEMORY_LIMIT_BYTES = 8 * 1024 * 1024 * 1024 // 8 GB

const CLUSTER_CONFIGS: Record<
  string,
  { clusterName: string; region: string; isPrimary: boolean }
> = {
  sgp: {
    clusterName: "Singapore Production",
    region: "Singapore",
    isPrimary: true,
  },
  "id-cgk-1": {
    clusterName: "Jakarta Production Cluster",
    region: "Jakarta (id-cgk-1)",
    isPrimary: true,
  },
  "sg-sin-1": {
    clusterName: "Singapore Edge Cluster",
    region: "Singapore (sg-sin-1)",
    isPrimary: false,
  },
}

export function formatTenantNamespace(organizationId: string): string {
  if (!organizationId) return "app-default"
  const clean = organizationId
    .replace(/^org_/, "app-")
    .toLowerCase()
    .replace(/_/g, "-")
  const ns = clean.startsWith("app-") ? clean : `app-${clean}`
  if (!/^app-[a-z0-9-]+$/.test(ns)) {
    throw new Error(`Invalid tenant namespace: ${ns}`)
  }
  return ns
}

export type FetchNamespaceTelemetryOptions = {
  organizationId: string
  timeRange?: PredefinedTimeRange | "custom"
  from?: number | string // unix seconds or ISO date string
  to?: number | string // unix seconds or ISO date string
  clusterCode?: string
  stepSeconds?: number
  timeZone?: string
  fetchFn?: typeof fetch
  appSlug?: string
  view?: "all" | "compute" | "ingress"
}

function parseToUnixSeconds(val: number | string): number {
  if (typeof val === "number") {
    return val > 1e11 ? Math.floor(val / 1000) : Math.floor(val)
  }
  const trimmed = val.trim()
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed)
    return num > 1e11 ? Math.floor(num / 1000) : Math.floor(num)
  }
  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return Math.floor(parsed / 1000)
  }
  throw new Error(`Invalid date/time format: ${val}`)
}

function parseInstantMetricValue(data: unknown): number | null {
  if (!data || typeof data !== "object") return null
  const payload = data as {
    data?: {
      result?: Array<{
        value?: [number, string]
      }>
    }
  }
  const result = payload.data?.result
  if (!Array.isArray(result) || result.length === 0) return null
  const rawValue = result[0]?.value?.[1]
  if (rawValue === undefined) return null
  const parsed = Number.parseFloat(rawValue)
  return Number.isFinite(parsed) ? parsed : null
}

function parseRangeMetricValues(data: unknown): Map<number, number> {
  const map = new Map<number, number>()
  if (!data || typeof data !== "object") return map
  const payload = data as {
    data?: {
      result?: Array<{
        values?: Array<[number, string]>
      }>
    }
  }
  const result = payload.data?.result
  if (!Array.isArray(result) || result.length === 0) return map
  for (const series of result) {
    if (!Array.isArray(series.values)) continue
    for (const [ts, valStr] of series.values) {
      const parsed = Number.parseFloat(valStr)
      if (Number.isFinite(parsed)) {
        map.set(ts, (map.get(ts) ?? 0) + parsed)
      }
    }
  }
  return map
}

function parseVectorMetricValues(
  data: unknown,
  labelKey = "pod"
): Map<string, number> {
  const map = new Map<string, number>()
  if (!data || typeof data !== "object") return map
  const payload = data as {
    data?: {
      result?: Array<{
        metric?: Record<string, string>
        value?: [number, string]
      }>
    }
  }
  const result = payload.data?.result
  if (!Array.isArray(result)) return map
  for (const item of result) {
    const key = item.metric?.[labelKey]
    const val = Number.parseFloat(item.value?.[1] ?? "")
    if (key && Number.isFinite(val)) {
      map.set(key, val)
    }
  }
  return map
}

function parseVectorLabelMap(
  data: unknown,
  keyLabel = "pod",
  valLabel = "phase"
): Map<string, string> {
  const map = new Map<string, string>()
  if (!data || typeof data !== "object") return map
  const payload = data as {
    data?: {
      result?: Array<{
        metric?: Record<string, string>
        value?: [number, string]
      }>
    }
  }
  const result = payload.data?.result
  if (!Array.isArray(result)) return map
  for (const item of result) {
    const key = item.metric?.[keyLabel]
    const val = item.metric?.[valLabel]
    if (key && val) {
      map.set(key, val)
    }
  }
  return map
}

function parsePerPodRangeMetricValues(
  data: unknown,
  keyLabel = "pod"
): Map<string, Map<number, number>> {
  const podMap = new Map<string, Map<number, number>>()
  if (!data || typeof data !== "object") return podMap
  const payload = data as {
    data?: {
      result?: Array<{
        metric?: Record<string, string>
        values?: Array<[number, string]>
      }>
    }
  }
  const result = payload.data?.result
  if (!Array.isArray(result)) return podMap
  for (const series of result) {
    const pod = series.metric?.[keyLabel]
    if (!pod || !Array.isArray(series.values)) continue
    let timeMap = podMap.get(pod)
    if (!timeMap) {
      timeMap = new Map<number, number>()
      podMap.set(pod, timeMap)
    }
    for (const [ts, valStr] of series.values) {
      const parsed = Number.parseFloat(valStr)
      if (Number.isFinite(parsed)) {
        timeMap.set(ts, (timeMap.get(ts) ?? 0) + parsed)
      }
    }
  }
  return podMap
}

function resolvePodStatus(
  phase?: string,
  waitingReason?: string,
  terminatedReason?: string
): PodStatusState {
  if (waitingReason) {
    if (waitingReason === "CrashLoopBackOff") return "CrashLoopBackOff"
    if (
      waitingReason === "ImagePullBackOff" ||
      waitingReason === "ErrImagePull"
    ) {
      return "ImagePullBackOff"
    }
    if (waitingReason === "ContainerCreating") return "Pending"
  }
  if (terminatedReason) {
    if (terminatedReason === "OOMKilled") return "OOMKilled"
    if (terminatedReason === "Error") return "Failed"
    if (terminatedReason === "Completed") return "Completed"
  }
  if (phase === "Pending") return "Pending"
  if (phase === "Failed") return "Failed"
  if (phase === "Succeeded") return "Completed"
  if (phase === "Running") return "Running"
  return "Running"
}

export async function fetchNamespaceTelemetry(
  opts: FetchNamespaceTelemetryOptions
): Promise<ClusterTelemetrySummary> {
  const clusterCode = opts.clusterCode ?? DEFAULT_CLUSTER_CODE
  const ns = formatTenantNamespace(opts.organizationId)
  const sanitizedSlug = opts.appSlug
    ? opts.appSlug.replace(/[^a-zA-Z0-9_-]/g, "")
    : undefined
  const podFilter = sanitizedSlug ? `, pod=~"${sanitizedSlug}.*"` : ""
  const isCustom =
    (opts.from !== undefined && opts.to !== undefined) ||
    opts.timeRange === "custom"

  let bounds: {
    startSeconds: number
    endSeconds: number
    stepSeconds: number
    rateWindow: string
  }
  let summaryTimeRange: PredefinedTimeRange | "custom"

  if (isCustom) {
    summaryTimeRange = "custom"
    const nowSeconds = Math.floor(Date.now() / 1000)
    const toSeconds =
      opts.to !== undefined ? parseToUnixSeconds(opts.to) : nowSeconds
    const fromSeconds =
      opts.from !== undefined ? parseToUnixSeconds(opts.from) : toSeconds - 3600
    bounds = resolveTimeRangeBounds({
      type: "custom",
      from: fromSeconds,
      to: toSeconds,
    })
  } else {
    const preset: PredefinedTimeRange =
      opts.timeRange && opts.timeRange in PRESET_SECONDS
        ? (opts.timeRange as PredefinedTimeRange)
        : "1h"
    summaryTimeRange = preset
    bounds = resolveTimeRangeBounds({ type: "preset", preset })
  }

  const { startSeconds, endSeconds, rateWindow } = bounds
  const stepSeconds = opts.stepSeconds ?? bounds.stepSeconds
  const durationSeconds = Math.max(0, endSeconds - startSeconds)

  const config = await resolveClusterIntegrationByClusterCode(
    clusterCode,
    "PROMETHEUS"
  )

  const fetchImpl = opts.fetchFn ?? fetch
  const baseUrl = config.endpoint.replace(/\/+$/, "")
  const authHeader = `Basic ${Buffer.from(
    `${config.username}:${config.password}`
  ).toString("base64")}`
  const headers = {
    Authorization: authHeader,
    Accept: "application/json",
  }

  const queryInstant = async (
    query: string,
    timestamp?: number
  ): Promise<number | null> => {
    const timeParam = timestamp ? `&time=${timestamp}` : ""
    const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}${timeParam}`
    const res = await fetchImpl(url, { headers })
    if (!res.ok) {
      throw new Error(
        `Prometheus query failed (${res.status}): ${res.statusText}`
      )
    }
    const json = await res.json()
    return parseInstantMetricValue(json)
  }

  const queryRange = async (query: string): Promise<Map<number, number>> => {
    const url = `${baseUrl}/api/v1/query_range?query=${encodeURIComponent(
      query
    )}&start=${startSeconds}&end=${endSeconds}&step=${stepSeconds}`
    const res = await fetchImpl(url, { headers })
    if (!res.ok) {
      throw new Error(
        `Prometheus query_range failed (${res.status}): ${res.statusText}`
      )
    }
    const json = await res.json()
    return parseRangeMetricValues(json)
  }
  const queryVector = async (query: string): Promise<Map<string, number>> => {
    const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`
    try {
      const res = await fetchImpl(url, { headers })
      if (!res.ok) return new Map()
      const json = await res.json()
      return parseVectorMetricValues(json, "pod")
    } catch {
      return new Map()
    }
  }
  const queryVectorLabel = async (
    query: string,
    keyLabel = "pod",
    valLabel = "phase"
  ): Promise<Map<string, string>> => {
    const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`
    try {
      const res = await fetchImpl(url, { headers })
      if (!res.ok) return new Map()
      const json = await res.json()
      return parseVectorLabelMap(json, keyLabel, valLabel)
    } catch {
      return new Map()
    }
  }
  const shouldFetchCompute = opts.view !== "ingress"
  const shouldFetchIngress = opts.view !== "compute"
  const proxyPattern = opts.appSlug ? `.*${opts.appSlug}.*` : `${ns}.*`

  const queryPodRange = async (
    query: string
  ): Promise<Map<string, Map<number, number>>> => {
    const url = `${baseUrl}/api/v1/query_range?query=${encodeURIComponent(
      query
    )}&start=${startSeconds}&end=${endSeconds}&step=${stepSeconds}`
    try {
      const res = await fetchImpl(url, { headers })
      if (!res.ok) return new Map()
      const json = await res.json()
      return parsePerPodRangeMetricValues(json, "pod")
    } catch {
      return new Map()
    }
  }

  const queryGroupedRange = async (
    query: string,
    keyLabel = "code"
  ): Promise<Map<string, Map<number, number>>> => {
    const url = `${baseUrl}/api/v1/query_range?query=${encodeURIComponent(
      query
    )}&start=${startSeconds}&end=${endSeconds}&step=${stepSeconds}`
    try {
      const res = await fetchImpl(url, { headers })
      if (!res.ok) return new Map()
      const json = await res.json()
      return parsePerPodRangeMetricValues(json, keyLabel)
    } catch {
      return new Map()
    }
  }
  const [
    instantCpuUsage,
    instantMemUsage,
    instantRxRate,
    instantTxRate,
    instantCpuLimit,
    instantMemLimit,
    cpuUsageMap,
    memUsageMap,
    networkRxMap,
    networkTxMap,
    podCpuMap,
    podMemMap,
    podCpuLimitMap,
    podMemLimitMap,
    podRestartsMap,
    podPhaseMap,
    podWaitingReasonMap,
    podTerminatedReasonMap,
    podStartTimeMap,
    podReadyMap,
    podCpuSeriesMap,
    podMemSeriesMap,
    podRxSeriesMap,
    podTxSeriesMap,
  ] = await Promise.all([
    queryInstant(
      `sum(rate(container_cpu_usage_seconds_total{namespace="${ns}"${podFilter}, container!=""}[2m]))`
    ),
    queryInstant(
      `sum(container_memory_working_set_bytes{namespace="${ns}"${podFilter}, container!=""})`
    ),
    queryInstant(
      `sum(rate(container_network_receive_bytes_total{namespace="${ns}"${podFilter}}[2m]))`
    ),
    queryInstant(
      `sum(rate(container_network_transmit_bytes_total{namespace="${ns}"${podFilter}}[2m]))`
    ),
    queryInstant(
      `sum(kube_pod_container_resource_limits{namespace="${ns}"${podFilter}, resource="cpu"})`
    ),
    queryInstant(
      `sum(kube_pod_container_resource_limits{namespace="${ns}"${podFilter}, resource="memory"})`
    ),
    queryRange(
      `sum(rate(container_cpu_usage_seconds_total{namespace="${ns}"${podFilter}, container!=""}[${rateWindow}]))`
    ),
    queryRange(
      `sum(container_memory_working_set_bytes{namespace="${ns}"${podFilter}, container!=""})`
    ),
    queryRange(
      `sum(rate(container_network_receive_bytes_total{namespace="${ns}"${podFilter}}[${rateWindow}]))`
    ),
    queryRange(
      `sum(rate(container_network_transmit_bytes_total{namespace="${ns}"${podFilter}}[${rateWindow}]))`
    ),
    queryVector(
      `sum(rate(container_cpu_usage_seconds_total{namespace="${ns}"${podFilter}, container!=""}[2m])) by (pod)`
    ),
    queryVector(
      `sum(container_memory_working_set_bytes{namespace="${ns}"${podFilter}, container!=""}) by (pod)`
    ),
    queryVector(
      `sum(kube_pod_container_resource_limits{namespace="${ns}"${podFilter}, resource="cpu"}) by (pod)`
    ),
    queryVector(
      `sum(kube_pod_container_resource_limits{namespace="${ns}"${podFilter}, resource="memory"}) by (pod)`
    ),
    queryVector(
      `sum(kube_pod_container_status_restarts_total{namespace="${ns}"${podFilter}}) by (pod)`
    ),
    queryVectorLabel(
      `sum by (pod, phase) (kube_pod_status_phase{namespace="${ns}"${podFilter}} == 1)`,
      "pod",
      "phase"
    ),
    queryVectorLabel(
      `sum by (pod, reason) (kube_pod_container_status_waiting_reason{namespace="${ns}"${podFilter}} == 1)`,
      "pod",
      "reason"
    ),
    queryVectorLabel(
      `sum by (pod, reason) (kube_pod_container_status_terminated_reason{namespace="${ns}"${podFilter}} == 1)`,
      "pod",
      "reason"
    ),
    queryVector(`kube_pod_start_time{namespace="${ns}"${podFilter}}`),
    queryVector(
      `kube_pod_status_ready{namespace="${ns}"${podFilter}, condition="true"}`
    ),
    shouldFetchCompute
      ? queryPodRange(
          `sum(rate(container_cpu_usage_seconds_total{namespace="${ns}"${podFilter}, container!=""}[${rateWindow}])) by (pod)`
        )
      : Promise.resolve(new Map<string, Map<number, number>>()),
    shouldFetchCompute
      ? queryPodRange(
          `sum(container_memory_working_set_bytes{namespace="${ns}"${podFilter}, container!=""}) by (pod)`
        )
      : Promise.resolve(new Map<string, Map<number, number>>()),
    shouldFetchCompute
      ? queryPodRange(
          `sum(rate(container_network_receive_bytes_total{namespace="${ns}"${podFilter}}[${rateWindow}])) by (pod)`
        )
      : Promise.resolve(new Map<string, Map<number, number>>()),
    shouldFetchCompute
      ? queryPodRange(
          `sum(rate(container_network_transmit_bytes_total{namespace="${ns}"${podFilter}}[${rateWindow}])) by (pod)`
        )
      : Promise.resolve(new Map<string, Map<number, number>>()),
  ])

  const [
    haproxyStatusMap,
    haproxyAppLatencyMap,
    haproxyQueueLatencyMap,
    haproxyConnectLatencyMap,
    haproxyTotalLatencyMap,
    instantTrafficRps,
    instant5xxRps,
    instant4xxRps,
    instantBpsIn,
    instantBpsOut,
    instantAvgResponseTime,
    instantSessions,
    instantQueue,
    instantHealthyServers,
    instantBackupServers,
  ] = shouldFetchIngress
    ? await Promise.all([
        queryGroupedRange(
          `sum by (code) (rate(haproxy_backend_http_responses_total{proxy=~"${proxyPattern}"}[${rateWindow}]))`,
          "code"
        ),
        queryRange(
          `avg(haproxy_backend_response_time_average_seconds{proxy=~"${proxyPattern}"})`
        ),
        queryRange(
          `avg(haproxy_backend_queue_time_average_seconds{proxy=~"${proxyPattern}"})`
        ),
        queryRange(
          `avg(haproxy_backend_connect_time_average_seconds{proxy=~"${proxyPattern}"})`
        ),
        queryRange(
          `avg(haproxy_backend_total_time_average_seconds{proxy=~"${proxyPattern}"})`
        ),
        queryInstant(
          `sum(rate(haproxy_backend_http_requests_total{proxy=~"${proxyPattern}"}[${rateWindow}]))`
        ),
        queryInstant(
          `sum(rate(haproxy_backend_http_responses_total{proxy=~"${proxyPattern}",code="5xx"}[${rateWindow}]))`
        ),
        queryInstant(
          `sum(rate(haproxy_backend_http_responses_total{proxy=~"${proxyPattern}",code="4xx"}[${rateWindow}]))`
        ),
        queryInstant(
          `sum(rate(haproxy_backend_bytes_in_total{proxy=~"${proxyPattern}"}[${rateWindow}])) * 8`
        ),
        queryInstant(
          `sum(rate(haproxy_backend_bytes_out_total{proxy=~"${proxyPattern}"}[${rateWindow}])) * 8`
        ),
        queryInstant(
          `avg(haproxy_backend_response_time_average_seconds{proxy=~"${proxyPattern}"})`
        ),
        queryInstant(
          `sum(haproxy_backend_current_sessions{proxy=~"${proxyPattern}"})`
        ),
        queryInstant(
          `sum(haproxy_backend_current_queue{proxy=~"${proxyPattern}"})`
        ),
        queryInstant(
          `max(haproxy_backend_active_servers{proxy=~"${proxyPattern}"})`
        ),
        queryInstant(
          `max(haproxy_backend_backup_servers{proxy=~"${proxyPattern}"})`
        ),
      ])
    : [
        new Map<string, Map<number, number>>(),
        new Map<number, number>(),
        new Map<number, number>(),
        new Map<number, number>(),
        new Map<number, number>(),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]

  const cpuLimitCores =
    instantCpuLimit && instantCpuLimit > 0
      ? Number(instantCpuLimit.toFixed(2))
      : FALLBACK_CPU_LIMIT_CORES

  const memoryLimitBytes =
    instantMemLimit && instantMemLimit > 0
      ? Math.round(instantMemLimit)
      : FALLBACK_MEMORY_LIMIT_BYTES

  const returnedTimestamps = new Set<number>()
  for (const t of cpuUsageMap.keys()) returnedTimestamps.add(t)
  for (const t of memUsageMap.keys()) returnedTimestamps.add(t)
  for (const t of networkRxMap.keys()) returnedTimestamps.add(t)
  for (const t of networkTxMap.keys()) returnedTimestamps.add(t)
  for (const statusSeries of haproxyStatusMap.values()) {
    for (const t of statusSeries.keys()) returnedTimestamps.add(t)
  }
  for (const t of haproxyAppLatencyMap.keys()) returnedTimestamps.add(t)
  let points: TelemetryDataPoint[]

  if (returnedTimestamps.size === 0) {
    // 0 metrics / zero-pod fallback handling: render clean baseline points across window
    points = []
    for (
      let t = startSeconds + stepSeconds;
      t <= endSeconds;
      t += stepSeconds
    ) {
      points.push({
        timestamp: formatTelemetryTick(t, durationSeconds, opts.timeZone),
        cpuUsageCores: 0,
        cpuLimitCores,
        memoryUsageBytes: 0,
        memoryLimitBytes,
        networkRxBytesPerSec: 0,
        networkTxBytesPerSec: 0,
      })
    }
    if (points.length === 0) {
      points.push({
        timestamp: formatTelemetryTick(
          endSeconds,
          durationSeconds,
          opts.timeZone
        ),
        cpuUsageCores: 0,
        cpuLimitCores,
        memoryUsageBytes: 0,
        memoryLimitBytes,
        networkRxBytesPerSec: 0,
        networkTxBytesPerSec: 0,
      })
    }
  } else {
    const sortedTimestamps = Array.from(returnedTimestamps).sort(
      (a, b) => a - b
    )
    let lastKnownMem = 0
    points = sortedTimestamps.map((t) => {
      const cpuUsage = cpuUsageMap.get(t) ?? 0
      const memUsage = memUsageMap.get(t)
      if (memUsage !== undefined && memUsage > 0) {
        lastKnownMem = memUsage
      }
      const rx = networkRxMap.get(t) ?? 0
      const tx = networkTxMap.get(t) ?? 0

      return {
        timestamp: formatTelemetryTick(t, durationSeconds, opts.timeZone),
        cpuUsageCores: Number(cpuUsage.toFixed(2)),
        cpuLimitCores,
        memoryUsageBytes: Math.round(memUsage ?? lastKnownMem),
        memoryLimitBytes,
        networkRxBytesPerSec: Math.round(rx),
        networkTxBytesPerSec: Math.round(tx),
      }
    })
  }

  const lastPoint = points[points.length - 1]
  const currentCores =
    instantCpuUsage !== null && instantCpuUsage > 0
      ? Number(instantCpuUsage.toFixed(2))
      : (lastPoint?.cpuUsageCores ?? 0)
  const currentBytes =
    instantMemUsage !== null && instantMemUsage > 0
      ? Math.round(instantMemUsage)
      : (lastPoint?.memoryUsageBytes ?? 0)
  const currentRxBytes =
    instantRxRate !== null && instantRxRate > 0
      ? Math.round(instantRxRate)
      : (lastPoint?.networkRxBytesPerSec ?? 0)
  const currentTxBytes =
    instantTxRate !== null && instantTxRate > 0
      ? Math.round(instantTxRate)
      : (lastPoint?.networkTxBytesPerSec ?? 0)

  if (lastPoint && points.length > 0) {
    lastPoint.cpuUsageCores = currentCores
    lastPoint.memoryUsageBytes = currentBytes
    lastPoint.networkRxBytesPerSec = currentRxBytes
    lastPoint.networkTxBytesPerSec = currentTxBytes
  }
  const cpuValues = points.map((p) => p.cpuUsageCores)
  const memValues = points.map((p) => p.memoryUsageBytes)
  const rxValues = points.map((p) => p.networkRxBytesPerSec)
  const txValues = points.map((p) => p.networkTxBytesPerSec)

  const avgCores =
    points.length > 0
      ? Number(
          (cpuValues.reduce((sum, v) => sum + v, 0) / points.length).toFixed(2)
        )
      : 0
  const peakCores =
    points.length > 0 ? Number(Math.max(...cpuValues).toFixed(2)) : 0

  const avgBytes =
    points.length > 0
      ? Math.round(memValues.reduce((sum, v) => sum + v, 0) / points.length)
      : 0
  const peakBytes = points.length > 0 ? Math.max(...memValues) : 0

  const totalRxBytes = Math.round(
    rxValues.reduce((sum, rate) => sum + rate * stepSeconds, 0)
  )
  const totalTxBytes = Math.round(
    txValues.reduce((sum, rate) => sum + rate * stepSeconds, 0)
  )

  const isPrimary = clusterCode === DEFAULT_CLUSTER_CODE
  const clusterMeta = CLUSTER_CONFIGS[clusterCode] ?? {
    clusterName: `Cluster (${clusterCode})`,
    region: clusterCode,
    isPrimary,
  }

  return {
    clusterId: clusterCode,
    clusterName: clusterMeta.clusterName,
    region: clusterMeta.region,
    isPrimary: clusterMeta.isPrimary,
    timeRange: summaryTimeRange,
    from: startSeconds,
    to: endSeconds,
    namespace: ns,
    points,
    cpu: {
      currentCores,
      limitCores: cpuLimitCores,
      avgCores,
      peakCores,
    },
    memory: {
      currentBytes,
      limitBytes: memoryLimitBytes,
      avgBytes,
      peakBytes,
    },
    network: {
      currentRxBytes,
      currentTxBytes,
      totalRxBytes,
      totalTxBytes,
    },
    pods: (() => {
      const allPodNames = new Set<string>()
      for (const p of podCpuMap.keys()) allPodNames.add(p)
      for (const p of podMemMap.keys()) allPodNames.add(p)
      for (const p of podRestartsMap.keys()) allPodNames.add(p)
      for (const p of podPhaseMap.keys()) allPodNames.add(p)
      for (const p of podCpuSeriesMap.keys()) allPodNames.add(p)

      const nowSec = Math.floor(Date.now() / 1000)
      const sortedTimestamps = Array.from(returnedTimestamps).sort(
        (a, b) => a - b
      )

      if (allPodNames.size > 0) {
        return Array.from(allPodNames)
          .sort()
          .map((pod) => {
            const cpu = podCpuMap.get(pod) ?? 0
            const cpuLimit = podCpuLimitMap.get(pod) || cpuLimitCores
            const mem = podMemMap.get(pod) ?? 0
            const memLimit = podMemLimitMap.get(pod) || memoryLimitBytes
            const restarts = podRestartsMap.get(pod) ?? 0
            const phase = podPhaseMap.get(pod)
            const waitingReason = podWaitingReasonMap.get(pod)
            const terminatedReason = podTerminatedReasonMap.get(pod)
            const startTime = podStartTimeMap.get(pod)
            const ready = (podReadyMap.get(pod) ?? 1) > 0

            const podCpuSeries = podCpuSeriesMap.get(pod)
            const podMemSeries = podMemSeriesMap.get(pod)
            const podRxSeries = podRxSeriesMap.get(pod)
            const podTxSeries = podTxSeriesMap.get(pod)

            const cpuSeries: PodMetricPoint[] =
              sortedTimestamps.length > 0
                ? sortedTimestamps.map((t) => ({
                    timestamp: formatTelemetryTick(
                      t,
                      durationSeconds,
                      opts.timeZone
                    ),
                    value: Number((podCpuSeries?.get(t) ?? 0).toFixed(3)),
                  }))
                : points.map((p) => ({
                    timestamp: p.timestamp,
                    value: Number(cpu.toFixed(3)),
                  }))

            const memorySeries: PodMetricPoint[] =
              sortedTimestamps.length > 0
                ? sortedTimestamps.map((t) => ({
                    timestamp: formatTelemetryTick(
                      t,
                      durationSeconds,
                      opts.timeZone
                    ),
                    value: Math.round(podMemSeries?.get(t) ?? 0),
                  }))
                : points.map((p) => ({
                    timestamp: p.timestamp,
                    value: Math.round(mem),
                  }))

            const networkRxSeries: PodMetricPoint[] =
              sortedTimestamps.length > 0
                ? sortedTimestamps.map((t) => ({
                    timestamp: formatTelemetryTick(
                      t,
                      durationSeconds,
                      opts.timeZone
                    ),
                    value: Math.round(podRxSeries?.get(t) ?? 0),
                  }))
                : []

            const networkTxSeries: PodMetricPoint[] =
              sortedTimestamps.length > 0
                ? sortedTimestamps.map((t) => ({
                    timestamp: formatTelemetryTick(
                      t,
                      durationSeconds,
                      opts.timeZone
                    ),
                    value: Math.round(podTxSeries?.get(t) ?? 0),
                  }))
                : []

            return {
              pod,
              status: resolvePodStatus(phase, waitingReason, terminatedReason),
              phase,
              ready,
              reason: waitingReason || terminatedReason,
              startTime,
              uptimeSeconds: startTime
                ? Math.max(0, nowSec - startTime)
                : undefined,
              cpuUsageCores: Number(cpu.toFixed(3)),
              cpuLimitCores: Number(cpuLimit.toFixed(2)),
              cpuPercent: Math.min(
                100,
                Math.round((cpu / (cpuLimit || 1)) * 100)
              ),
              memoryUsageBytes: Math.round(mem),
              memoryLimitBytes: Math.round(memLimit),
              memoryPercent: Math.min(
                100,
                Math.round((mem / (memLimit || 1)) * 100)
              ),
              restarts: Math.round(restarts),
              cpuSeries,
              memorySeries,
              networkRxSeries,
              networkTxSeries,
            }
          })
      }
      if (sanitizedSlug) {
        const fallbackCpuSeries = points.map((p) => ({
          timestamp: p.timestamp,
          value: p.cpuUsageCores,
        }))
        const fallbackMemSeries = points.map((p) => ({
          timestamp: p.timestamp,
          value: p.memoryUsageBytes,
        }))
        const fallbackRxSeries = points.map((p) => ({
          timestamp: p.timestamp,
          value: p.networkRxBytesPerSec,
        }))
        const fallbackTxSeries = points.map((p) => ({
          timestamp: p.timestamp,
          value: p.networkTxBytesPerSec,
        }))
        return [
          {
            pod: `${sanitizedSlug}-deploy-0`,
            status: "Running" as const,
            phase: "Running",
            ready: true,
            cpuUsageCores: currentCores,
            cpuLimitCores,
            cpuPercent: Math.min(
              100,
              Math.round((currentCores / (cpuLimitCores || 1)) * 100)
            ),
            memoryUsageBytes: currentBytes,
            memoryLimitBytes: memoryLimitBytes,
            memoryPercent: Math.min(
              100,
              Math.round((currentBytes / (memoryLimitBytes || 1)) * 100)
            ),
            restarts: 0,
            cpuSeries: fallbackCpuSeries,
            memorySeries: fallbackMemSeries,
            networkRxSeries: fallbackRxSeries,
            networkTxSeries: fallbackTxSeries,
          },
        ]
      }
      return []
    })(),
    ingress: (() => {
      if (!shouldFetchIngress) return undefined
      const hasLiveHaproxy =
        instantTrafficRps !== null || haproxyStatusMap.size > 0

      if (hasLiveHaproxy) {
        const sortedTimestamps = Array.from(returnedTimestamps).sort(
          (a, b) => a - b
        )
        const codes: Array<"2xx" | "3xx" | "4xx" | "5xx"> = [
          "2xx",
          "3xx",
          "4xx",
          "5xx",
        ]
        const statusCodes = codes.map((code) => {
          const codeMap = haproxyStatusMap.get(code)
          return {
            code,
            points: sortedTimestamps.map((t) => ({
              timestamp: formatTelemetryTick(t, durationSeconds, opts.timeZone),
              value: Number((codeMap?.get(t) ?? 0).toFixed(3)),
            })),
          }
        })

        const latencyBreakdown = [
          {
            type: "queue" as const,
            points: sortedTimestamps.map((t) => ({
              timestamp: formatTelemetryTick(t, durationSeconds, opts.timeZone),
              value: Number((haproxyQueueLatencyMap.get(t) ?? 0).toFixed(4)),
            })),
          },
          {
            type: "connect" as const,
            points: sortedTimestamps.map((t) => ({
              timestamp: formatTelemetryTick(t, durationSeconds, opts.timeZone),
              value: Number((haproxyConnectLatencyMap.get(t) ?? 0).toFixed(4)),
            })),
          },
          {
            type: "app" as const,
            points: sortedTimestamps.map((t) => ({
              timestamp: formatTelemetryTick(t, durationSeconds, opts.timeZone),
              value: Number((haproxyAppLatencyMap.get(t) ?? 0).toFixed(4)),
            })),
          },
          {
            type: "total" as const,
            points: sortedTimestamps.map((t) => ({
              timestamp: formatTelemetryTick(t, durationSeconds, opts.timeZone),
              value: Number((haproxyTotalLatencyMap.get(t) ?? 0).toFixed(4)),
            })),
          },
        ]

        const trafficRps = instantTrafficRps ?? 0
        const err5xx = instant5xxRps ?? 0
        const err4xx = instant4xxRps ?? 0
        const totalReqs = trafficRps > 0 ? trafficRps : 1
        const errorRate5xxPercent =
          trafficRps > 0 ? Number(((err5xx / totalReqs) * 100).toFixed(2)) : 0
        const errorRate4xxPercent =
          trafficRps > 0 ? Number(((err4xx / totalReqs) * 100).toFixed(2)) : 0

        return {
          proxy: proxyPattern,
          trafficRps: Number(trafficRps.toFixed(3)),
          errorRate5xxPercent,
          errorRate4xxPercent,
          bandwidthInBps: Math.round(instantBpsIn ?? 0),
          bandwidthOutBps: Math.round(instantBpsOut ?? 0),
          avgResponseTimeSeconds: Number(
            (instantAvgResponseTime ?? 0).toFixed(4)
          ),
          activeSessions: Math.round(instantSessions ?? 0),
          activeQueue: Math.round(instantQueue ?? 0),
          healthyServers: Math.round(instantHealthyServers ?? 0),
          backupServers: Math.round(instantBackupServers ?? 0),
          statusCodes,
          latencyBreakdown,
        }
      }
      // Fallback simulated ingress for dev/preview
      const fallbackPreset: "1h" | "6h" | "24h" | "7d" =
        summaryTimeRange === "6h" ||
        summaryTimeRange === "24h" ||
        summaryTimeRange === "7d"
          ? summaryTimeRange
          : "1h"
      return generateClusterTelemetrySummary(fallbackPreset, clusterCode)
        .ingress
    })(),
  }
}
