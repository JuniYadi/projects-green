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

export interface AudienceBucket {
  label: string
  count: number
  percentage: number
}

export interface TrafficAudienceBreakdown {
  device: AudienceBucket[]
  browser: AudienceBucket[]
  os: AudienceBucket[]
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
  audience: TrafficAudienceBreakdown
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
  topIps: IpGeoInfo[]
  audience: TrafficAudienceBreakdown
}
