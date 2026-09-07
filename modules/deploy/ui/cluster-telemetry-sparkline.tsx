import { useId } from "react"
import { cn } from "@/lib/utils"

export type SparklineDataPoint = {
  label: string
  value: number
  secondaryValue?: number
  limit?: number
}

export type ClusterTelemetrySparklineProps = {
  data: SparklineDataPoint[]
  color?: string // default primary Tailwind hex or CSS var e.g. "hsl(var(--primary))" or "#10b981"
  secondaryColor?: string // e.g. "#38bdf8" (for dual line e.g. Network Rx vs Tx)
  height?: number // default 100
  showArea?: boolean // default true
  showLimitLine?: boolean // default true
  unit?: string // e.g. "vCPU", "GB", "MB/s"
  formatter?: (val: number) => string
  className?: string
}

export function ClusterTelemetrySparkline({
  data,
  color = "#10b981",
  secondaryColor = "#38bdf8",
  height = 100,
  showArea = true,
  showLimitLine = true,
  unit,
  formatter,
  className,
}: ClusterTelemetrySparklineProps) {
  const rawId = useId()
  const gradientId = `sparkline-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-xs text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        No telemetry data
      </div>
    )
  }

  // Determine limit and scales
  const limitValue = data.find(
    (d) => typeof d.limit === "number" && d.limit > 0
  )?.limit

  const values = data.map((d) => d.value)
  const secondaryValues = data
    .map((d) => d.secondaryValue)
    .filter((v): v is number => typeof v === "number")

  const allValues = [
    ...values,
    ...secondaryValues,
    ...(typeof limitValue === "number" ? [limitValue] : []),
  ]
  const maxValue = Math.max(1, ...allValues)

  const paddingTop = 8
  const paddingBottom = 8
  const chartHeight = 100 - paddingTop - paddingBottom

  const getY = (val: number) => {
    const clamped = Math.max(0, val)
    return paddingTop + (1 - clamped / maxValue) * chartHeight
  }

  const getX = (idx: number) => {
    if (data.length <= 1) return 0
    return (idx / (data.length - 1)) * 400
  }

  // Primary path
  const primaryLineD =
    data.length === 1
      ? `M 0,${getY(data[0].value).toFixed(1)} L 400,${getY(data[0].value).toFixed(1)}`
      : `M ${data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`).join(" L ")}`

  const primaryAreaD = `${primaryLineD} L 400,100 L 0,100 Z`

  // Secondary path (if any secondary values exist)
  const hasSecondary = secondaryValues.length > 0
  const secondaryLineD = hasSecondary
    ? data.length === 1
      ? `M 0,${getY(data[0].secondaryValue ?? 0).toFixed(1)} L 400,${getY(data[0].secondaryValue ?? 0).toFixed(1)}`
      : `M ${data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.secondaryValue ?? 0).toFixed(1)}`).join(" L ")}`
    : null

  // Limit line
  const hasLimitLine =
    showLimitLine && typeof limitValue === "number" && limitValue > 0
  const limitY = hasLimitLine ? getY(limitValue).toFixed(1) : null

  // Labels for bottom axis
  const firstLabel = data[0]?.label ?? ""
  const middleIndex = Math.floor(data.length / 2)
  const middleLabel = data.length > 2 ? data[middleIndex]?.label : undefined
  const lastLabel = data.length > 1 ? (data[data.length - 1]?.label ?? "") : ""

  const formatValue = (v: number) =>
    formatter ? formatter(v) : `${v}${unit ? ` ${unit}` : ""}`

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div className="relative w-full" style={{ height }}>
        <svg
          viewBox="0 0 400 100"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {showArea && (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
          )}

          {/* Limit dashed threshold line */}
          {hasLimitLine && limitY && (
            <line
              x1="0"
              y1={limitY}
              x2="400"
              y2={limitY}
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeOpacity={0.35}
              strokeWidth={1}
              data-testid="sparkline-limit-line"
            >
              <title>{`Limit: ${formatValue(limitValue!)}`}</title>
            </line>
          )}

          {/* Area under curve */}
          {showArea && (
            <path
              d={primaryAreaD}
              fill={`url(#${gradientId})`}
              data-testid="sparkline-area"
            />
          )}

          {/* Secondary line (e.g. Tx traffic) */}
          {hasSecondary && secondaryLineD && (
            <path
              d={secondaryLineD}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              data-testid="sparkline-secondary-line"
            />
          )}

          {/* Primary line */}
          <path
            d={primaryLineD}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="sparkline-primary-line"
          />
        </svg>
      </div>

      {/* Bottom X-axis label ticks */}
      <div
        className="flex items-center justify-between px-0.5 text-[11px] font-medium text-muted-foreground"
        data-testid="sparkline-ticks"
      >
        <span>{firstLabel}</span>
        {middleLabel && <span>{middleLabel}</span>}
        {lastLabel && <span>{lastLabel}</span>}
      </div>
    </div>
  )
}
