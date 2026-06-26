export type SyncAnalyticsInput = {
  deviceId: string
  organizationId: string
  startDate: string // "YYYY-MM-DD"
  endDate: string // "YYYY-MM-DD"
  granularity?: "DAY" | "WEEK" | "MONTH"
}

export type ComparisonRow = {
  date: string
  phoneNumberId?: string
  metric: string
  metaValue: number
  localValue: number
  delta: number
  deltaPercent: number
}

export type CostReconciliationRow = {
  phoneNumberId?: string
  conversationCategory?: string
  date: string
  metaCost: number
  localCost: number
  delta: number
  currency: string
}

export type AnalyticsSyncResult = {
  syncedCount: number
  discrepancies: ComparisonRow[]
}

export type AnalyticsReport = {
  from: string
  to: string
  deviceId: string
  comparisons: ComparisonRow[]
  summary: {
    totalMeta: number
    totalLocal: number
    totalDelta: number
    rowsWithDiscrepancy: number
  }
}

export type CostReconciliationReport = {
  rows: CostReconciliationRow[]
  totalMetaCost: number
  totalLocalCost: number
  totalDelta: number
}
