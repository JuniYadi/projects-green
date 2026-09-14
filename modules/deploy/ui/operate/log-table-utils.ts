const EXCLUDED_FIELDS = new Set([
  "message",
  "msg",
  "log",
  "timestamp",
  "@timestamp",
  "time",
  "level",
  "source",
  "_index",
  "_id",
  "_score",
])

export function flattenObject(
  obj: Record<string, unknown> | null | undefined,
  prefix = ""
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  if (!obj || typeof obj !== "object") return result

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value === null || value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      result[fullKey] = value
        .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
        .join(", ")
    } else if (typeof value === "object") {
      const nested = flattenObject(value as Record<string, unknown>, fullKey)
      Object.assign(result, nested)
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[fullKey] = value
    }
  }

  return result
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined
  const parts = path.split(".")
  let current: unknown = obj

  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

export function discoverLogFields(
  logs: Array<{ raw?: Record<string, unknown> } & Record<string, unknown>>
): string[] {
  const fieldCounts = new Map<string, number>()

  for (const log of logs) {
    const rawData = log.raw ?? log
    const flat = flattenObject(rawData)

    for (const key of Object.keys(flat)) {
      if (EXCLUDED_FIELDS.has(key)) continue
      fieldCounts.set(key, (fieldCounts.get(key) ?? 0) + 1)
    }
  }

  // Sort fields by occurrence frequency descending, then alphabetically
  return Array.from(fieldCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => key)
}

export function formatAttributeValue(val: unknown): string {
  if (val === null || val === undefined) return "-"
  if (typeof val === "boolean") return val ? "true" : "false"
  if (typeof val === "number") return String(val)
  if (typeof val === "string") return val.trim().length > 0 ? val : "-"
  if (typeof val === "object") {
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }
  return String(val)
}
