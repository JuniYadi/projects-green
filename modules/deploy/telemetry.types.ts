import type { PredefinedTimeRange } from "@/lib/time-range"

export type TelemetryDataPoint = {
  timestamp: string
  cpuUsageCores: number
  cpuLimitCores: number
  memoryUsageBytes: number
  memoryLimitBytes: number
  networkRxBytesPerSec: number
  networkTxBytesPerSec: number
}

export type PodStatusState =
  | "Running"
  | "Pending"
  | "Terminating"
  | "Failed"
  | "CrashLoopBackOff"
  | "ImagePullBackOff"
  | "OOMKilled"
  | "Completed"
  | "Unknown"

export type PodMetricPoint = {
  timestamp: string
  value: number
}

export type PodMetricSummary = {
  pod: string
  status: PodStatusState
  phase?: string
  ready?: boolean
  reason?: string
  startTime?: number
  uptimeSeconds?: number
  cpuUsageCores: number
  cpuRequestCores?: number
  cpuLimitCores: number
  cpuPercent: number
  memoryUsageBytes: number
  memoryRequestBytes?: number
  memoryLimitBytes: number
  memoryPercent: number
  restarts: number
  cpuSeries?: PodMetricPoint[]
  memorySeries?: PodMetricPoint[]
  networkRxSeries?: PodMetricPoint[]
  networkTxSeries?: PodMetricPoint[]
}

export type HttpMetricPoint = {
  timestamp: string
  value: number
}

export type HttpStatusCodeSeries = {
  code: "2xx" | "3xx" | "4xx" | "5xx"
  points: HttpMetricPoint[]
}

export type HttpLatencySeries = {
  type: "queue" | "connect" | "app" | "total"
  points: HttpMetricPoint[]
}

export type HttpReliabilitySeries = {
  type:
    | "conn_errors"
    | "resp_errors"
    | "retries"
    | "redispatches"
    | "client_aborts"
    | "server_aborts"
  points: HttpMetricPoint[]
}

export type HttpIngressTelemetry = {
  proxy: string
  trafficRps: number
  errorRate5xxPercent: number
  errorRate4xxPercent: number
  bandwidthInBps: number
  bandwidthOutBps: number
  avgResponseTimeSeconds: number
  activeSessions: number
  activeQueue: number
  healthyServers: number
  backupServers: number
  statusCodes: HttpStatusCodeSeries[]
  latencyBreakdown: HttpLatencySeries[]
  reliability?: HttpReliabilitySeries[]
}

export type ClusterTelemetrySummary = {
  clusterId: string
  clusterName: string
  region: string
  isPrimary: boolean
  timeRange: PredefinedTimeRange | "custom"
  from?: number
  to?: number
  namespace?: string
  points: TelemetryDataPoint[]
  cpu: {
    currentCores: number
    limitCores: number
    avgCores: number
    peakCores: number
  }
  memory: {
    currentBytes: number
    limitBytes: number
    avgBytes: number
    peakBytes: number
  }
  network: {
    currentRxBytes: number
    currentTxBytes: number
    totalRxBytes: number
    totalTxBytes: number
  }
  pods?: PodMetricSummary[]
  ingress?: HttpIngressTelemetry
}
