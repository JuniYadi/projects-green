export interface TrafficTrendItem {
  label: string
  requests: number
  errors: number
}

export interface TrafficPathCount {
  path: string
  views: number
}

export interface TrafficErrorPath {
  path: string
  errors: number
  sampleStatus: number
}

export interface AppTrafficReportDTO {
  granularity: "daily" | "monthly" | "yearly"
  periodLabel: string
  date?: string
  month?: string
  year?: string
  totalRequests: number
  successRate: number
  avgLatencyMs: number
  totalBytes: number
  totalBytesFormatted: string
  trend: TrafficTrendItem[]
  topPages: TrafficPathCount[]
  troubledPages: TrafficErrorPath[]
}

export interface AppTrafficLogItemDTO {
  id: string
  timestamp: string
  method: string
  path: string
  statusCode: number
  latencyMs: number
  bytes: number
  clientIp: string
}

export interface AppTrafficLogsDTO {
  logs: AppTrafficLogItemDTO[]
  total: number
}

export interface DailySnapshotComputeResult {
  stackId: string
  date: Date
  totalRequests: number
  successCount: number
  errorCount: number
  totalBytes: bigint
  avgLatencyMs: number
  hourlyTrend: Array<{ hour: number; requests: number; errors: number }>
  topPaths: TrafficPathCount[]
  errorPaths: TrafficErrorPath[]
}
