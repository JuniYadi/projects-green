import type { IpGeoInfo } from "./geoip-lookup.service"

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

export interface TrafficCountryCount {
  countryCode: string
  countryName: string
  requests: number
  percentage: number
}

export interface TrafficRequestQuality {
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  status2xxPct: number
  status3xxPct: number
  status4xxPct: number
  status5xxPct: number
  /** False when no per-status breakdown was ever recorded for this period (pre-migration snapshot). */
  hasBreakdown: boolean
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
  topIps: IpGeoInfo[]
  topCountries: TrafficCountryCount[]
  requestQuality: TrafficRequestQuality
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
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  totalBytes: bigint
  avgLatencyMs: number
  hourlyTrend: Array<{ hour: number; requests: number; errors: number }>
  topPaths: TrafficPathCount[]
  errorPaths: TrafficErrorPath[]
  topIps: IpGeoInfo[]
}
