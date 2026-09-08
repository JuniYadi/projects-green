import type {
  ClusterTelemetrySummary,
  TelemetryDataPoint,
} from "./telemetry.types"
import { resolveClusterIntegrationByClusterCode } from "./cluster-integration.service"

export const DEFAULT_CLUSTER_CODE = "sgp"
export const DEFAULT_TIME_RANGE: "1h" | "6h" | "24h" = "1h"

export const FALLBACK_CPU_LIMIT_CORES = 2.0
export const FALLBACK_MEMORY_LIMIT_BYTES = 8 * 1024 * 1024 * 1024 // 8 GB

const TIME_RANGE_SECONDS: Record<"1h" | "6h" | "24h", number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
}

const DEFAULT_STEP_SECONDS: Record<"1h" | "6h" | "24h", number> = {
  "1h": 300,
  "6h": 1800,
  "24h": 7200,
}

const CLUSTER_CONFIGS: Record<
  string,
  { clusterName: string; region: string; isPrimary: boolean }
> = {
  sgp: {
    clusterName: "Singapore Production",
    region: "Singapore (sgp)",
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
  const clean = organizationId.replace(/^org_/, "app-").toLowerCase()
  return clean.startsWith("app-") ? clean : `app-${clean}`
}

export type FetchNamespaceTelemetryOptions = {
  organizationId: string
  timeRange?: "1h" | "6h" | "24h"
  clusterCode?: string
  stepSeconds?: number
  fetchFn?: typeof fetch
}

function formatTimestamp(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const hours = String(d.getUTCHours()).padStart(2, "0")
  const minutes = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
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

export async function fetchNamespaceTelemetry(
  opts: FetchNamespaceTelemetryOptions
): Promise<ClusterTelemetrySummary> {
  const clusterCode = opts.clusterCode ?? DEFAULT_CLUSTER_CODE
  const timeRange = opts.timeRange ?? DEFAULT_TIME_RANGE
  const ns = formatTenantNamespace(opts.organizationId)
  const step = opts.stepSeconds ?? DEFAULT_STEP_SECONDS[timeRange]
  const duration = TIME_RANGE_SECONDS[timeRange]

  const nowSeconds = Math.floor(Date.now() / 1000)
  const end = Math.floor(nowSeconds / step) * step
  const start = end - duration

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

  const queryInstant = async (query: string): Promise<number | null> => {
    const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}&time=${end}`
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
    )}&start=${start}&end=${end}&step=${step}`
    const res = await fetchImpl(url, { headers })
    if (!res.ok) {
      throw new Error(
        `Prometheus query_range failed (${res.status}): ${res.statusText}`
      )
    }
    const json = await res.json()
    return parseRangeMetricValues(json)
  }

  const [
    instantCpuLimit,
    instantMemLimit,
    cpuUsageMap,
    memUsageMap,
    networkRxMap,
    networkTxMap,
  ] = await Promise.all([
    queryInstant(
      `sum(kube_pod_container_resource_limits{namespace="${ns}", resource="cpu"})`
    ),
    queryInstant(
      `sum(kube_pod_container_resource_limits{namespace="${ns}", resource="memory"})`
    ),
    queryRange(
      `sum(rate(container_cpu_usage_seconds_total{namespace="${ns}", container!=""}[2m]))`
    ),
    queryRange(
      `sum(container_memory_working_set_bytes{namespace="${ns}", container!=""})`
    ),
    queryRange(
      `sum(rate(container_network_receive_bytes_total{namespace="${ns}"}[2m]))`
    ),
    queryRange(
      `sum(rate(container_network_transmit_bytes_total{namespace="${ns}"}[2m]))`
    ),
  ])

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

  let points: TelemetryDataPoint[]

  if (returnedTimestamps.size === 0) {
    // 0 metrics / zero-pod fallback handling: render clean baseline points across window
    points = []
    for (let t = start + step; t <= end; t += step) {
      points.push({
        timestamp: formatTimestamp(t),
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
        timestamp: formatTimestamp(end),
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
    points = sortedTimestamps.map((t) => {
      const cpuUsage = cpuUsageMap.get(t) ?? 0
      const memUsage = memUsageMap.get(t) ?? 0
      const rx = networkRxMap.get(t) ?? 0
      const tx = networkTxMap.get(t) ?? 0

      return {
        timestamp: formatTimestamp(t),
        cpuUsageCores: Number(cpuUsage.toFixed(2)),
        cpuLimitCores,
        memoryUsageBytes: Math.round(memUsage),
        memoryLimitBytes,
        networkRxBytesPerSec: Math.round(rx),
        networkTxBytesPerSec: Math.round(tx),
      }
    })
  }

  const lastPoint = points[points.length - 1]
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
    rxValues.reduce((sum, rate) => sum + rate * step, 0)
  )
  const totalTxBytes = Math.round(
    txValues.reduce((sum, rate) => sum + rate * step, 0)
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
    timeRange,
    namespace: ns,
    points,
    cpu: {
      currentCores: lastPoint.cpuUsageCores,
      limitCores: cpuLimitCores,
      avgCores,
      peakCores,
    },
    memory: {
      currentBytes: lastPoint.memoryUsageBytes,
      limitBytes: memoryLimitBytes,
      avgBytes,
      peakBytes,
    },
    network: {
      currentRxBytes: lastPoint.networkRxBytesPerSec,
      currentTxBytes: lastPoint.networkTxBytesPerSec,
      totalRxBytes,
      totalTxBytes,
    },
  }
}
