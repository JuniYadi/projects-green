export type PredefinedTimeRange =
  "5m" | "15m" | "30m" | "1h" | "3h" | "6h" | "12h" | "24h" | "2d" | "7d"

export type TimeRangeSelection =
  | { type: "preset"; preset: PredefinedTimeRange }
  | { type: "custom"; from: number; to: number }

export const PRESET_LABELS: Record<PredefinedTimeRange, string> = {
  "5m": "Last 5 minutes",
  "15m": "Last 15 minutes",
  "30m": "Last 30 minutes",
  "1h": "Last 1 hour",
  "3h": "Last 3 hours",
  "6h": "Last 6 hours",
  "12h": "Last 12 hours",
  "24h": "Last 24 hours",
  "2d": "Last 2 days",
  "7d": "Last 7 days",
}

export const PRESET_SECONDS: Record<PredefinedTimeRange, number> = {
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "3h": 10800,
  "6h": 21600,
  "12h": 43200,
  "24h": 86400,
  "2d": 172800,
  "7d": 604800,
}

const PRESET_CONFIG: Record<
  PredefinedTimeRange,
  { stepSeconds: number; rateWindow: string }
> = {
  "5m": { stepSeconds: 15, rateWindow: "30s" },
  "15m": { stepSeconds: 30, rateWindow: "1m" },
  "30m": { stepSeconds: 60, rateWindow: "2m" },
  "1h": { stepSeconds: 300, rateWindow: "5m" },
  "3h": { stepSeconds: 900, rateWindow: "10m" },
  "6h": { stepSeconds: 1800, rateWindow: "15m" },
  "12h": { stepSeconds: 3600, rateWindow: "20m" },
  "24h": { stepSeconds: 7200, rateWindow: "30m" },
  "2d": { stepSeconds: 10800, rateWindow: "1h" },
  "7d": { stepSeconds: 14400, rateWindow: "2h" },
}

function toDate(date: Date | number): Date {
  if (date instanceof Date) {
    return date
  }
  return new Date(date < 1e11 ? date * 1000 : date)
}

export function format24hTime(
  date: Date | number,
  options?: { showSeconds?: boolean; timeZone?: string }
): string {
  const d = toDate(date)
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: options?.showSeconds ? "2-digit" : undefined,
    hour12: false,
    timeZone: options?.timeZone,
  }).format(d)
}

export function format24hDateTime(
  date: Date | number,
  timeZone?: string
): string {
  const d = toDate(date)
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  })
  const parts = formatter.formatToParts(d)
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${partMap.day} ${partMap.month} ${partMap.hour}:${partMap.minute}`
}

export function formatTelemetryTick(
  unixSeconds: number,
  durationSeconds: number,
  timeZone?: string
): string {
  if (durationSeconds <= 900) {
    return format24hTime(unixSeconds, { showSeconds: true, timeZone })
  }
  if (durationSeconds <= 86400) {
    return format24hTime(unixSeconds, { showSeconds: false, timeZone })
  }
  return format24hDateTime(unixSeconds, timeZone)
}

export function resolveTimeRangeBounds(
  selection: TimeRangeSelection,
  nowSeconds?: number
): {
  startSeconds: number
  endSeconds: number
  stepSeconds: number
  rateWindow: string
} {
  if (selection.type === "preset") {
    const config = PRESET_CONFIG[selection.preset]
    const duration = PRESET_SECONDS[selection.preset]
    const now = nowSeconds ?? Math.floor(Date.now() / 1000)
    const endSeconds = Math.floor(now / config.stepSeconds) * config.stepSeconds
    const startSeconds = endSeconds - duration
    return {
      startSeconds,
      endSeconds,
      stepSeconds: config.stepSeconds,
      rateWindow: config.rateWindow,
    }
  }

  const startSeconds = selection.from
  const endSeconds = selection.to
  const duration = Math.max(0, endSeconds - startSeconds)
  const stepSeconds = Math.max(15, Math.floor(duration / 30))
  const rateWindow =
    stepSeconds <= 30
      ? "1m"
      : stepSeconds <= 120
        ? "2m"
        : stepSeconds <= 600
          ? "5m"
          : stepSeconds <= 1800
            ? "15m"
            : "1h"

  return {
    startSeconds,
    endSeconds,
    stepSeconds,
    rateWindow,
  }
}
