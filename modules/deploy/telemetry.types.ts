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
}
