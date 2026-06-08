/**
 * OpenSearch log search types for projects-green
 * Migrated from Laravel OpenSearch.php + OpenSearchClient.php
 */

export interface OpenSearchConfig {
  host: string
  username: string
  password: string
  sslVerify: boolean
  timeout: number
  apiKey?: string
}

export interface OpenSearchRegionConfig extends OpenSearchConfig {
  regionCode: string
}

export interface OpenSearchSearchFilters {
  stackSlugs?: string[]
  startDate?: string // ISO date string
  endDate?: string
  logLevel?: string
  containerName?: string
  httpStatus?: string
  httpMethod?: string
  httpUri?: string
  podName?: string
  remoteAddr?: string
  eventType?: string
  host?: string
  searchQuery?: string
  searchColumn?: string
  timeRange?: string
  from?: number
  size?: number
}

export interface OpenSearchLogEntry {
  id: string
  timestamp: string
  level: string
  message: string
  pod: string
  container: string
  containerImage: string
  namespace: string
  host: string
  ip: string
  forwardedIp: string
  status: string
  requestTime: number | null
  method: string
  uri: string
  userAgent: string
  raw: Record<string, unknown>
}

export interface OpenSearchSearchResult {
  success: boolean
  data: OpenSearchLogEntry[]
  total: number
  took: number
  error?: string
}

export interface OpenSearchLogCounts {
  success: boolean
  totalLogs: number
  logLevels: LogLevelBucket[]
  timeline: TimelineBucket[]
  error?: string
}

export interface LogLevelBucket {
  key: string
  doc_count: number
}

export interface TimelineBucket {
  key_as_string: string
  key: number
  doc_count: number
}

export interface OpenSearchHealthCheck {
  success: boolean
  status: string
  clusterName: string
  numberOfNodes: number
  message: string
  error?: string
}

export interface OpenSearchConnectionTest {
  success: boolean
  info?: Record<string, unknown>
  error?: string
  message: string
}

export interface OpenSearchIndexFields {
  [field: string]: string
}