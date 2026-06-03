export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG"

export interface LogEntry {
  timestamp: string
  level: LogLevel
  source: string
  message: string
  tenantSlug: string
  stackId?: string
  container?: string
  buildId?: string
  deployId?: string
  metadata?: Record<string, unknown>
}

export interface LogQueryParams {
  tenantSlug: string
  query?: string
  level?: LogLevel
  stackId?: string
  container?: string
  deployId?: string
  from?: string
  to?: string
  fromOffset?: number
  size?: number
}

export interface LogQueryResult {
  hits: LogEntry[]
  total: number
  took: number
}

export interface DeployAggregation {
  deployFrequency: Array<{
    date: string
    count: number
  }>
  successRate: {
    total: number
    success: number
    failed: number
    rate: number
  }
  avgDurationMs: number
}
