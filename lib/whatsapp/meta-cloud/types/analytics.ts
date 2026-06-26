/** Meta WhatsApp Analytics API — types */

export type AnalyticsMetricType =
  | "CONVERSATION"
  | "MESSAGING"
  | "PRICING"
  | "CALL"
  | "GROUP"
  | "TEMPLATE"
  | "TEMPLATE_GROUP"

export type AnalyticsGranularity = "DAY" | "WEEK" | "MONTH"

export type AnalyticsQueryParams = {
  start: number // unix timestamp
  end: number // unix timestamp
  granularity: AnalyticsGranularity
  phone_numbers?: string[]
  metric_types?: AnalyticsMetricType
}

export type AnalyticsCost = {
  amount: number
  currency: string
}

export type AnalyticsDataItem = {
  phone_number_id?: string
  phone_number?: string
  country?: string
  conversation_direction?: string
  conversation_category?: string
  conversation_start?: number
  conversation_end?: number
  conversation_duration_seconds?: number
  message_count?: number
  message_inbound_count?: number
  message_outbound_count?: number
  cost?: AnalyticsCost
  [key: string]: unknown
}

export type AnalyticsPaging = {
  cursors?: { before?: string; after?: string }
  next?: string
  previous?: string
}

export type AnalyticsResponse<T = AnalyticsDataItem> = {
  data: T[]
  paging?: AnalyticsPaging
}

export type AnalyticsResult<T = AnalyticsDataItem> = {
  data: T[]
  totalPages: number
}
