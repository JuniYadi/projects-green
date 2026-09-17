import type { IpGeoInfo } from "./geoip-lookup.service"

export type TrafficSignal =
  "likely_human" | "mixed" | "likely_automated" | "unknown"

export interface TrafficIpItemDTO extends IpGeoInfo {
  percentage: number
  firstSeen?: string
  lastSeen?: string
  primaryClient: string
  primaryDevice: string
  signal: TrafficSignal
  confidence: number
  reasons: string[]
  isBlocked: boolean
  blockStatus?: "pending" | "active" | "failed" | "expired" | "revoked" | null
  blockId?: string | null
}

export interface AppHostingIpBlockDTO {
  id: string
  stackId: string
  organizationId: string
  ipAddress: string
  reason: string
  durationMinutes: number | null
  status: "pending" | "active" | "failed" | "expired" | "revoked"
  errorMessage?: string | null
  enforcedAt?: string | null
  expiresAt?: string | null
  revokedAt?: string | null
  revokedBy?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface GetAppTrafficIpsOptions {
  granularity?: "daily" | "monthly" | "yearly"
  date?: string
  month?: string
  year?: string
  page?: number
  limit?: number
  search?: string
  signal?: "likely_human" | "mixed" | "likely_automated" | "unknown"
  statusFamily?: "2xx" | "3xx" | "4xx" | "5xx"
  country?: string
  minRequests?: number
  sortBy?: "requests" | "2xx" | "4xx" | "5xx" | "success" | "lastSeen"
  sortDir?: "asc" | "desc"
}

export interface TrafficIpListResponseDTO {
  items: TrafficIpItemDTO[]
  page: number
  limit: number
  total: number
  otherRequestCount: number
  coveragePercentage: number
}

export interface TrafficIpRecentLog {
  id: string
  timestamp: string
  method: string
  path: string
  statusCode: number
  latencyMs: number
  bytes?: number
  userAgent?: string
}

export interface TrafficIpDetailDTO {
  ip: string
  countryCode: string
  countryName: string
  city?: string
  totalRequests: number
  statusCounts: {
    status2xx: number
    status3xx: number
    status4xx: number
    status5xx: number
  }
  successRate: number
  signal: {
    classification: TrafficSignal
    confidence: number
    reasons: string[]
  }
  pathsByStatus: {
    status2xx: Array<{ path: string; count: number }>
    status3xx: Array<{ path: string; count: number }>
    status4xx: Array<{ path: string; count: number }>
    status5xx: Array<{ path: string; count: number }>
  }
  userAgents: Array<{
    raw: string
    browser: string
    os: string
    device: string
    count: number
  }>
  timeline: Array<{ timestamp: string; requests: number; errors: number }>
  firstSeen: string
  lastSeen: string
  velocity: {
    maxRpm: number
    isBurst: boolean
  }
  staticAssetShare: number
  recentLogs?: TrafficIpRecentLog[]
  blockInfo?: {
    id: string
    isBlocked: boolean
    status: "pending" | "active" | "failed" | "expired" | "revoked"
    reason: string
    durationMinutes: number | null
    errorMessage?: string | null
    enforcedAt?: string | null
    expiresAt?: string | null
    createdBy: string
    createdAt: string
  } | null
}

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
