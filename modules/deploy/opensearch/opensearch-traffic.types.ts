import type { IpGeoInfo } from "./geoip-lookup.service"

export interface TrafficTrendItem {
  label: string
  requests: number
  errors: number
  /** Estimated distinct visitors in this bucket. Approximate -- see visitorEstimateMethod. */
  visitors: number
  /** Requests with a known bot/CLI User-Agent, or a missing one. */
  automated: number
  /** requests - automated. */
  humanLike: number
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
  audience: TrafficAudienceBreakdown
  /** Approximate distinct-visitor count for the whole period. See visitorEstimateMethod. */
  visitorEstimate: number
  /** Estimation method + version, e.g. "ip_cardinality_v1". Not proof of a real person. */
  visitorEstimateMethod: string
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
  hourlyTrend: Array<{
    hour: number
    requests: number
    errors: number
    visitors: number
    automated: number
  }>
  topPaths: TrafficPathCount[]
  errorPaths: TrafficErrorPath[]
  topIps: IpGeoInfo[]
  audience: TrafficAudienceBreakdown
  automatedRequests: number
  visitorEstimate: number
  visitorEstimateMethod: string
}
