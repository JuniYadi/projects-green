export interface LogHourlyTrendItem {
  hour: number // 0 - 23
  info: number
  warn: number
  error: number
}

export interface LogErrorSignature {
  signature: string
  count: number
  sampleMessage: string
}

export interface AppLogReportDTO {
  granularity: "daily" | "monthly" | "yearly"
  periodLabel: string
  date?: string
  month?: string
  year?: string
  totalLogs: number
  infoCount: number
  warnCount: number
  errorCount: number
  healthScore: number // 0 - 100 (%)
  trend: Array<{
    label: string
    info: number
    warn: number
    error: number
  }>
  topErrors: LogErrorSignature[]
}

export interface HourlyRollupWindow {
  windowStart: Date
  windowEnd: Date
  targetDate: Date
  targetHour: number
}

export interface HourlyLogAggregationResult {
  stackId: string
  slug: string
  window: HourlyRollupWindow
  totalLogs: number
  infoCount: number
  warnCount: number
  errorCount: number
  topErrors: LogErrorSignature[]
}
