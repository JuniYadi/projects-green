import type { LogMessage } from "../operate.types"

export type NormalizedLogEntry = LogMessage & {
  id?: string
  isoTimestamp?: string
  raw?: Record<string, unknown>
}

export type OpenSearchLogHit = {
  _id?: string
  _index?: string
  _source?: Record<string, unknown>
}

// Strip ANSI color / style escape sequences
const ANSI_REGEX = /\u001b\[[0-9;]*[mK]/g

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "")
}

function resolveLevel(
  src: Record<string, unknown>,
  cleanMessage: string
): "INFO" | "WARN" | "ERROR" {
  const rawLevel = src.level

  if (typeof rawLevel === "number") {
    // Standard Pino numeric levels: 10/20 debug, 30 info, 40 warn, 50 error, 60 fatal
    if (rawLevel >= 50) return "ERROR"
    if (rawLevel >= 40) return "WARN"
    return "INFO"
  }

  if (typeof rawLevel === "string" && rawLevel.trim().length > 0) {
    const upper = rawLevel.toUpperCase()
    if (
      upper.includes("ERR") ||
      upper.includes("FATAL") ||
      upper.includes("CRIT") ||
      upper.includes("EMERG")
    ) {
      return "ERROR"
    }
    if (upper.includes("WARN")) {
      return "WARN"
    }
    return "INFO"
  }

  // Infer from stream
  if (src.stream === "stderr") {
    return "ERROR"
  }

  // Fastify/Pino res.statusCode or status
  const rawStatus =
    (src.res &&
      typeof src.res === "object" &&
      (src.res as Record<string, unknown>).statusCode) ??
    src.statusCode ??
    src.status
  if (typeof rawStatus === "number") {
    if (rawStatus >= 500) return "ERROR"
    if (rawStatus >= 400) return "WARN"
  }

  // Infer from message keywords (including Laravel, NestJS, Python trace)
  if (
    /(?:\[|\b)(?:EMERGENCY|ALERT|CRIT|CRITICAL|ERROR|FATAL|FAIL|FAILED|EXCEPTION|TRACEBACK)(?:\]|\b)/i.test(
      cleanMessage
    ) ||
    cleanMessage.startsWith("Traceback (most recent call last):")
  ) {
    return "ERROR"
  }

  if (/(?:\[|\b)(?:WARN|WARNING)(?:\]|\b)/i.test(cleanMessage)) {
    return "WARN"
  }
  return "INFO"
}

function resolveTimestamp(src: Record<string, unknown>): {
  timestamp: string
  isoTimestamp?: string
} {
  const rawTime = src["@timestamp"] ?? src.time ?? src.timestamp
  if (typeof rawTime === "string" || typeof rawTime === "number") {
    const d = new Date(rawTime)
    if (!Number.isNaN(d.getTime())) {
      // Format as HH:MM:SS in UTC or local
      const hours = String(d.getUTCHours()).padStart(2, "0")
      const minutes = String(d.getUTCMinutes()).padStart(2, "0")
      const seconds = String(d.getUTCSeconds()).padStart(2, "0")
      return {
        timestamp: `${hours}:${minutes}:${seconds}`,
        isoTimestamp: d.toISOString(),
      }
    }
  }

  const now = new Date()
  const hours = String(now.getUTCHours()).padStart(2, "0")
  const minutes = String(now.getUTCMinutes()).padStart(2, "0")
  const seconds = String(now.getUTCSeconds()).padStart(2, "0")
  return {
    timestamp: `${hours}:${minutes}:${seconds}`,
    isoTimestamp: now.toISOString(),
  }
}

function resolveSource(src: Record<string, unknown>): string {
  const k8s =
    typeof src.kubernetes === "object" && src.kubernetes !== null
      ? (src.kubernetes as Record<string, unknown>)
      : undefined

  if (k8s) {
    if (
      typeof k8s.container_name === "string" &&
      k8s.container_name.length > 0
    ) {
      return k8s.container_name
    }
    const labels =
      typeof k8s.labels === "object" && k8s.labels !== null
        ? (k8s.labels as Record<string, unknown>)
        : undefined
    if (
      labels &&
      typeof labels["app.kubernetes.io/instance"] === "string" &&
      labels["app.kubernetes.io/instance"].length > 0
    ) {
      return labels["app.kubernetes.io/instance"]
    }
    if (typeof k8s.pod_name === "string" && k8s.pod_name.length > 0) {
      return k8s.pod_name
    }
  }

  if (typeof src.context === "string" && src.context.length > 0) {
    return src.context
  }

  if (typeof src.source === "string" && src.source.length > 0) {
    return src.source
  }

  if (typeof src.hostname === "string" && src.hostname.length > 0) {
    return src.hostname
  }

  return "app"
}

function resolveMessage(src: Record<string, unknown>): string {
  const rawMsg = src.message ?? src.msg ?? src.log

  if (typeof rawMsg === "string" && rawMsg.trim().length > 0) {
    // If Fastify/Pino request summary, format nicely
    if (
      rawMsg === "request completed" &&
      src.req &&
      typeof src.req === "object"
    ) {
      const req = src.req as Record<string, unknown>
      const res = (
        src.res && typeof src.res === "object" ? src.res : {}
      ) as Record<string, unknown>
      const method = req.method ?? "HTTP"
      const url = req.url ?? "/"
      const status = res.statusCode ?? 200
      const time = src.responseTime ? ` in ${src.responseTime}ms` : ""
      return `${method} ${url} ${status}${time}`
    }
    return stripAnsi(rawMsg).trim()
  }

  // Fallback if message is an object or error object
  if (rawMsg !== null && typeof rawMsg === "object") {
    try {
      return JSON.stringify(rawMsg)
    } catch {
      return String(rawMsg)
    }
  }

  // Fallback if only req/res exists without message/msg
  if (src.req && typeof src.req === "object") {
    const req = src.req as Record<string, unknown>
    return `${req.method ?? "GET"} ${req.url ?? "/"}`
  }

  if (rawMsg !== undefined && rawMsg !== null) {
    return String(rawMsg).trim()
  }

  return ""
}

export function normalizeOpenSearchLogDoc(
  hit: OpenSearchLogHit
): NormalizedLogEntry {
  const src = hit._source ?? {}
  const { timestamp, isoTimestamp } = resolveTimestamp(src)
  const message = resolveMessage(src)
  const level = resolveLevel(src, message)
  const source = resolveSource(src)

  return {
    id: hit._id,
    timestamp,
    isoTimestamp,
    level,
    source,
    message,
    raw: src,
  }
}
