/**
 * Pure helpers for extracting semantic key/value pairs from a VpnAuditLog
 * `details` JSON blob. Kept in a standalone module so it can be unit-tested
 * without rendering any React.
 *
 * The extractor recognizes a set of known keys emitted by the provisioning
 * pipeline (see `modules/vpn/provisioning/vpn-provisioning.service.ts`) and
 * any `VpnAuditLog` top-level columns that carry useful context. Unknown
 * keys are preserved under the "Other" bucket so nothing is lost.
 */

export type AuditDetailRow = {
  /** Display label, e.g. "Server name". */
  label: string
  /** Rendered value (already stringified/formatted). */
  value: string
  /**
   * Severity hint the UI can use for coloring. Rows that aren't status-like
   * default to "neutral".
   */
  tone: "neutral" | "success" | "warning" | "danger"
}

/** Ordered list of known keys with their display labels. */
const KNOWN_KEYS: Array<{ key: string; label: string }> = [
  { key: "step", label: "Step" },
  { key: "status", label: "Status" },
  { key: "serverName", label: "Server" },
  { key: "serverId", label: "Server ID" },
  { key: "protocol", label: "Protocol" },
  { key: "host", label: "Host" },
  { key: "port", label: "Port" },
  { key: "message", label: "Message" },
  { key: "reason", label: "Reason" },
  { key: "failureReason", label: "Failure reason" },
  { key: "error", label: "Error" },
  { key: "durationMs", label: "Duration" },
  { key: "username", label: "Username" },
  { key: "clientName", label: "Client" },
  { key: "region", label: "Region" },
  { key: "countryCode", label: "Country" },
  { key: "ip", label: "IP" },
  { key: "userAgent", label: "User-Agent" },
  { key: "adminId", label: "Admin" },
  { key: "userId", label: "User" },
  { key: "deviceId", label: "Device" },
  { key: "serverAccountId", label: "Server account" },
]

const SUCCESS_TOKENS = new Set([
  "ok",
  "success",
  "active",
  "done",
  "completed",
  "passed",
])

const DANGER_TOKENS = new Set([
  "failed",
  "error",
  "revoked",
  "denied",
  "timeout",
  "refused",
])

const WARNING_TOKENS = new Set([
  "pending",
  "provisioning",
  "retried",
  "partial",
  "warn",
  "warning",
])

function toneFromValue(raw: string): AuditDetailRow["tone"] {
  const v = raw.trim().toLowerCase()
  if (SUCCESS_TOKENS.has(v)) return "success"
  if (DANGER_TOKENS.has(v)) return "danger"
  if (WARNING_TOKENS.has(v)) return "warning"
  return "neutral"
}

function formatDuration(ms: unknown): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rem = Math.round(seconds % 60)
  return `${minutes}m ${rem}s`
}

/** Stringify any JSON value into a single-line readable cell. */
function stringify(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export type ExtractedDetails = {
  rows: AuditDetailRow[]
  /** Remaining unknown keys, rendered as raw rows after the known ones. */
  other: AuditDetailRow[]
}

/**
 * Extract semantic detail rows from a `details` payload plus the audit log's
 * top-level columns. Falls back gracefully when `details` is null or not an
 * object — in that case we only surface the column-level context.
 */
export function extractAuditDetails(input: {
  details?: Record<string, unknown> | null
  step?: string | null
  status?: string | null
  serverAccountId?: string | null
  deviceId?: string | null
  userId?: string | null
  adminId?: string | null
  ip?: string | null
  userAgent?: string | null
  action?: string | null
}): ExtractedDetails {
  const rows: AuditDetailRow[] = []
  const other: AuditDetailRow[] = []

  const details =
    input.details && typeof input.details === "object" ? input.details : {}
  const seenKeys = new Set<string>()

  // 1. Top-level columns that are useful in the expanded panel. We emit them
  //    only when the same key isn't already present in `details` (details
  //    wins because it is the more specific payload written by the pipeline).
  const columnFallbacks: Array<{ key: string; label: string; value: unknown }> =
    [
      { key: "step", label: "Step", value: input.step },
      { key: "status", label: "Status", value: input.status },
      {
        key: "serverAccountId",
        label: "Server account",
        value: input.serverAccountId,
      },
      { key: "deviceId", label: "Device", value: input.deviceId },
      { key: "userId", label: "User", value: input.userId },
      { key: "adminId", label: "Admin", value: input.adminId },
      { key: "ip", label: "IP", value: input.ip },
      { key: "userAgent", label: "User-Agent", value: input.userAgent },
    ]

  for (const { key, label, value } of columnFallbacks) {
    if (value === null || value === undefined || value === "") continue
    // Skip if details already provides this key — we'll render from details.
    if (key in details) {
      seenKeys.add(key)
      continue
    }
    pushRow(rows, other, key, label, value)
  }

  // 2. Known keys from `details`, in the canonical order above.
  for (const { key, label } of KNOWN_KEYS) {
    if (!(key in details)) continue
    seenKeys.add(key)
    const value = (details as Record<string, unknown>)[key]
    pushRow(rows, other, key, label, value)
  }

  // 3. Unknown keys → "other" bucket, sorted alphabetically for stability.
  for (const [key, value] of Object.entries(details)) {
    if (seenKeys.has(key)) continue
    other.push({
      label: humanizeKey(key),
      value: stringify(value),
      tone: "neutral",
    })
  }
  other.sort((a, b) => a.label.localeCompare(b.label))

  return { rows, other }
}

function pushRow(
  rows: AuditDetailRow[],
  other: AuditDetailRow[],
  key: string,
  label: string,
  value: unknown
) {
  if (value === null || value === undefined || value === "") return

  // Special formatting for duration.
  if (key === "durationMs") {
    const formatted = formatDuration(value)
    if (formatted) {
      rows.push({ label, value: formatted, tone: "neutral" })
      return
    }
  }

  const rendered = stringify(value)
  if (!rendered) return

  rows.push({
    label,
    value: rendered,
    tone:
      key === "status" ||
      key === "error" ||
      key === "failureReason" ||
      key === "reason"
        ? toneFromValue(rendered)
        : "neutral",
  })
}

function humanizeKey(key: string): string {
  // Split on camelCase boundaries, underscores, and hyphens, then title-case
  // each word so labels read consistently ("extra_payload" → "Extra Payload",
  // "mixed-snake_case" → "Mixed Snake Case").
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
  return words
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
}

/** Map an audit `action` to a display badge tone. */
export function actionTone(action: string): AuditDetailRow["tone"] {
  const a = action.toUpperCase()
  if (
    a.includes("SUCCESS") ||
    a === "REGISTERED" ||
    a === "CONFIG_DOWNLOADED"
  ) {
    return "success"
  }
  if (a.includes("FAILED") || a === "REVOKED") {
    return "danger"
  }
  if (
    a.includes("RETRIED") ||
    a.includes("PROVISIONING_STARTED") ||
    a === "PROVISIONING_STEP"
  ) {
    return "warning"
  }
  return "neutral"
}
