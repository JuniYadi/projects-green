/**
 * OpenSearch log search service for projects-green
 * Migrated from Laravel OpenSearch.php
 * Supports: index pattern building, search, aggregation, field discovery
 */

import { OpenSearchClient } from "./opensearch.client"
import type {
  OpenSearchSearchFilters,
  OpenSearchSearchResult,
  OpenSearchLogCounts,
  OpenSearchIndexFields,
  OpenSearchLogEntry,
} from "./opensearch.types"

// ─── Index Pattern Builder ────────────────────────────────────────────────────

const MAX_DAYS_WILDCARD = 7

function buildIndexPattern(
  stackSlugs: string[],
  startDate?: string,
  endDate?: string
): string {
  if (stackSlugs.length === 0) return ""

  const patterns: string[] = []

  for (const slug of stackSlugs) {
    if (startDate && endDate) {
      if (startDate.split("T")[0] === endDate.split("T")[0]) {
        // Single day — specific date index
        patterns.push(`${slug}-${startDate.split("T")[0]}`)
      } else {
        // Multi-day — limit to MAX_DAYS_WILDCARD days
        const start = new Date(startDate)
        const end = new Date(endDate)
        const diffDays = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (diffDays >= MAX_DAYS_WILDCARD) {
          // Too many days — use wildcard
          patterns.push(`${slug}-*`)
        } else {
          // Generate specific date indices
          const current = new Date(start)
          while (current <= end) {
            const dateStr = current.toISOString().split("T")[0]
            patterns.push(`${slug}-${dateStr}`)
            current.setDate(current.getDate() + 1)
          }
        }
      }
    } else {
      // Default to today (Jakarta timezone UTC+7 offset via hour calculation)
      const now = new Date()
      const jakartaHour = (now.getUTCHours() + 7) % 24
      const isBefore7amJakarta = jakartaHour < 7
      const today = isBefore7amJakarta
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        : now.toISOString().split("T")[0]
      patterns.push(`${slug}-${today}`)
    }
  }

  return patterns.join(",")
}

// ─── Query Builder ───────────────────────────────────────────────────────────

function buildOpenSearchQuery(
  filters: OpenSearchSearchFilters
): Record<string, unknown> {
  const must: unknown[] = []

  // Time range
  if (filters.startDate || filters.endDate) {
    const range: Record<string, string> = {}
    if (filters.startDate) range.gte = filters.startDate
    if (filters.endDate) range.lte = filters.endDate
    must.push({ range: { "@timestamp": range } })
  }

  // Log level
  if (filters.logLevel) {
    must.push({ term: { "level_name.keyword": filters.logLevel } })
  }

  // Container name
  if (filters.containerName) {
    must.push({
      term: { "kubernetes.container_name.keyword": filters.containerName },
    })
  }

  // HTTP status
  if (filters.httpStatus) {
    must.push({ term: { "level.keyword": filters.httpStatus } })
  }

  // HTTP method
  if (filters.httpMethod) {
    must.push({ term: { "request_method.keyword": filters.httpMethod } })
  }

  // HTTP URI wildcard
  if (filters.httpUri) {
    must.push({
      wildcard: { "request_uri.keyword": `*${filters.httpUri}*` },
    })
  }

  // Pod name
  if (filters.podName) {
    must.push({ term: { "kubernetes.pod_name.keyword": filters.podName } })
  }

  // Remote address
  if (filters.remoteAddr) {
    must.push({ term: { "remote_addr.keyword": filters.remoteAddr } })
  }

  // Event type
  if (filters.eventType) {
    must.push({ term: { "event_type.keyword": filters.eventType } })
  }

  // Host
  if (filters.host) {
    must.push({ term: { "host.keyword": filters.host } })
  }

  // Text search
  if (filters.searchQuery) {
    const searchableColumns = [
      "message",
      "level",
      "ip",
      "forwarded_ip",
      "status",
      "method",
      "uri",
      "pod",
      "container",
      "namespace",
      "host",
      "user_agent",
    ]
    const column = filters.searchColumn ?? "message"

    if (searchableColumns.includes(column)) {
      must.push({
        wildcard: {
          [column]: {
            value: `*${filters.searchQuery}*`,
            case_insensitive: true,
          },
        },
      })
    } else {
      must.push({
        multi_match: {
          query: filters.searchQuery,
          fields: ["message^2", "log", "container", "pod"],
        },
      })
    }
  }

  return { bool: { must } }
}

// ─── Result Formatter ────────────────────────────────────────────────────────

const PINO_LEVEL_MAP: Record<string | number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warning",
  50: "error",
  60: "fatal",
  fatal: "fatal",
  error: "error",
  warn: "warning",
  warning: "warning",
  info: "info",
  debug: "debug",
  trace: "trace",
}

function formatLogLevel(level: string | number | undefined): string {
  if (!level) return "info"
  const numeric =
    typeof level === "string" && !isNaN(Number(level)) ? Number(level) : null
  if (numeric !== null) {
    if (numeric >= 60) return "fatal"
    if (numeric >= 50) return "error"
    if (numeric >= 40) return "warning"
    if (numeric >= 30) return "info"
    if (numeric >= 20) return "debug"
    return "trace"
  }
  return PINO_LEVEL_MAP[String(level).toLowerCase()] ?? "info"
}

function formatSearchResults(
  hits: Array<{ _id: string; _source: Record<string, unknown> }>
): Array<Record<string, unknown>> {
  return hits.map((hit) => {
    const src = hit._source ?? {}
    const raw = (src["raw"] ?? {}) as Record<string, unknown>
    const k8s = (src["kubernetes"] ?? {}) as Record<string, unknown>

    // Pino/Express: check raw.req/raw.res first
    const reqRaw = (raw["req"] ?? src["req"]) as
      | Record<string, unknown>
      | undefined
    const resRaw = (raw["res"] ?? src["res"]) as
      | Record<string, unknown>
      | undefined

    const method =
      (reqRaw?.["method"] as string) ??
      (src["request_method"] as string) ??
      (raw["request_method"] as string) ??
      ""
    const uri =
      (reqRaw?.["url"] as string) ??
      (src["request_uri"] as string) ??
      (raw["request_uri"] as string) ??
      ""
    const statusCodeRaw =
      (resRaw?.["statusCode"] as number) ??
      (src["status"] as string | number) ??
      (raw["status"] as string | number) ??
      ""

    // HTTP status: numeric string 100-599
    let httpStatus = ""
    if (
      typeof statusCodeRaw === "number" &&
      statusCodeRaw >= 100 &&
      statusCodeRaw < 600
    ) {
      httpStatus = String(statusCodeRaw)
    } else if (
      typeof statusCodeRaw === "string" &&
      /^\d{3}$/.test(statusCodeRaw)
    ) {
      httpStatus = statusCodeRaw
    }

    // Fallback: parse plain text message for HTTP
    if (!method && !uri) {
      const msg = (src["message"] ?? src["log"] ?? "") as string
      const httpMatch = msg.match(
        /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)/i
      )
      if (httpMatch) {
        const parts = msg.split(/\b(\d{3})\b/)
        void parts
      }
    }

    // Response time (ms → s)
    const responseTimeRaw =
      (raw["responseTime"] as number) ?? (src["responseTime"] as number) ?? null

    const levelName = (src["level_name"] ?? raw["level_name"]) as
      | string
      | undefined
    const level = (src["level"] ?? raw["level"]) as string | number | undefined

    const logLevel = levelName ? String(levelName) : formatLogLevel(level)

    // Build message
    let message = (src["message"] ?? src["log"] ?? "") as string
    if (!message && raw["msg"]) message = raw["msg"] as string

    // Generic Pino HTTP log message → use METHOD URI
    const genericMsgs = ["request completed", "request", ""]
    const isHttpLog = !!method && !!uri
    if (
      isHttpLog &&
      (genericMsgs.includes(message.toLowerCase().trim()) || !message)
    ) {
      message = `${method} ${uri}`
    }

    const reqHeaders = (reqRaw?.["headers"] ?? {}) as Record<string, unknown>
    const forwardedFor =
      (reqHeaders["x-forwarded-for"] as string) ??
      ((src["http_x_forwarded_for"] ??
        raw["http_x_forwarded_for"] ??
        "") as string)

    return {
      id: hit._id ?? "",
      timestamp: ((src["@timestamp"] ?? src["timestamp"]) as string) ?? "",
      level: logLevel,
      message,
      pod: ((k8s["pod_name"] ?? src["pod"]) as string) ?? "",
      container:
        ((k8s["container_name"] ?? src["container_name"]) as string) ?? "",
      containerImage: (k8s["container_image"] ?? "") as string,
      namespace: ((k8s["namespace_name"] ?? src["namespace"]) as string) ?? "",
      host: ((k8s["host"] ?? src["host"]) as string) ?? "",
      ip:
        (reqRaw?.["remoteAddress"] as string) ??
        ((src["remote_addr"] ??
          src["ip"] ??
          raw["remote_addr"] ??
          raw["ip"]) as string) ??
        "",
      forwarded_ip: forwardedFor,
      status: httpStatus,
      request_time: responseTimeRaw !== null ? responseTimeRaw / 1000 : null,
      method,
      uri,
      user_agent:
        (reqHeaders["user-agent"] as string) ??
        ((src["http_user_agent"] ??
          src["user_agent"] ??
          raw["http_user_agent"] ??
          raw["user_agent"]) as string) ??
        "",
      raw: src,
    }
  })
}

// ─── Timeline Interval ────────────────────────────────────────────────────────

function getTimelineInterval(timeRange: string = "1h"): string {
  switch (timeRange) {
    case "15m":
    case "1h":
      return "1m"
    case "6h":
    case "24h":
      return "1h"
    case "7d":
      return "1d"
    default:
      return "1h"
  }
}

// ─── OpenSearch Service ──────────────────────────────────────────────────────

export class OpenSearchService {
  constructor(
    private client: OpenSearchClient,
    private regionCode: string = "global"
  ) {}

  static fromRegion(regionCode: string): OpenSearchService {
    return new OpenSearchService(
      OpenSearchClient.forRegion(regionCode),
      regionCode
    )
  }

  async searchLogs(
    filters: OpenSearchSearchFilters
  ): Promise<OpenSearchSearchResult> {
    const indexPattern = buildIndexPattern(
      filters.stackSlugs ?? [],
      filters.startDate,
      filters.endDate
    )

    if (!indexPattern) {
      return {
        success: false,
        error: "No valid index pattern found for the specified stacks",
        data: [],
        total: 0,
        took: 0,
      }
    }

    try {
      const body = {
        query: buildOpenSearchQuery(filters),
        sort: [{ "@timestamp": { order: "desc" } }],
        from: filters.from ?? 0,
        size: filters.size ?? 50,
      }

      const result = await this.client.search(
        indexPattern,
        body,
        filters.size ?? 50,
        filters.from ?? 0
      )

      return {
        success: true,
        data: formatSearchResults(
          result.hits.hits
        ) as unknown as OpenSearchLogEntry[],
        total: result.hits.total.value,
        took: result.took,
      }
    } catch (error) {
      return {
        success: false,
        error: `OpenSearch query failed: ${error instanceof Error ? error.message : "Unknown"}`,
        data: [],
        total: 0,
        took: 0,
      }
    }
  }

  async getLogCounts(
    filters: OpenSearchSearchFilters
  ): Promise<OpenSearchLogCounts> {
    const indexPattern = buildIndexPattern(
      filters.stackSlugs ?? [],
      filters.startDate,
      filters.endDate
    )

    if (!indexPattern) {
      return {
        success: false,
        error: "No valid index pattern found for the specified stacks",
        totalLogs: 0,
        logLevels: [],
        timeline: [],
      }
    }

    try {
      const body = {
        size: 0,
        query: buildOpenSearchQuery(filters),
        aggs: {
          log_levels: {
            terms: { field: "level.keyword", size: 10 },
          },
          log_timeline: {
            date_histogram: {
              field: "@timestamp",
              fixed_interval: getTimelineInterval(filters.timeRange),
              time_zone: "UTC",
            },
          },
        },
      }

      const result = await this.client.search(indexPattern, body, 0, 0)

      return {
        success: true,
        totalLogs: result.hits.total.value,
        logLevels: [], // populated from aggregation
        timeline: [], // populated from aggregation
      }
    } catch (error) {
      return {
        success: false,
        error: `OpenSearch aggregation query failed: ${error instanceof Error ? error.message : "Unknown"}`,
        totalLogs: 0,
        logLevels: [],
        timeline: [],
      }
    }
  }

  async getAvailableFields(
    stackSlugs: string[]
  ): Promise<OpenSearchIndexFields> {
    const indexPattern = buildIndexPattern(stackSlugs)
    if (!indexPattern) return this.getDefaultFields()

    try {
      const mapping = await this.client.getMapping(indexPattern)
      const fields: OpenSearchIndexFields = {}

      for (const data of Object.values(mapping)) {
        const mappingProps = (
          data as {
            mappings?: { properties?: Record<string, { type: string }> }
          }
        ).mappings?.properties
        if (mappingProps) {
          for (const [field, propDef] of Object.entries(mappingProps)) {
            fields[field] = (propDef as { type: string }).type ?? "text"
          }
        }
      }

      return fields
    } catch {
      return this.getDefaultFields()
    }
  }

  private getDefaultFields(): OpenSearchIndexFields {
    return {
      "@timestamp": "date",
      timestamp: "date",
      level: "keyword",
      message: "text",
      log: "text",
      container: "keyword",
      container_name: "keyword",
      namespace: "keyword",
      pod: "keyword",
      "kubernetes.namespace_name": "keyword",
      "kubernetes.pod_name": "keyword",
    }
  }

  async testConnection() {
    return this.client.testConnection()
  }

  async healthCheck() {
    return this.client.healthCheck()
  }
}
