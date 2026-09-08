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
}
