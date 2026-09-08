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
  showYAxis?: boolean // default true
  showGridLines?: boolean // default false (removes background line noise)
  yAxisTicks?: number // default 4 or 5
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
  showYAxis = true,
  showGridLines = false,
  yAxisTicks = 5,
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

  const maxValue = Math.max(1, ...values, ...secondaryValues)
  const ceiling =
    typeof limitValue === "number" && limitValue > maxValue
      ? limitValue
      : maxValue

  const tickCount = Math.max(2, yAxisTicks)
  const tickValues = Array.from({ length: tickCount }, (_, i) => {
    const ratio = 1 - i / (tickCount - 1)
    return ceiling * ratio
  })

  const paddingTop = 8
  const paddingBottom = 8
  const chartHeight = 100 - paddingTop - paddingBottom

  const getY = (val: number) => {
    const clamped = Math.max(0, val)
    return paddingTop + (1 - clamped / ceiling) * chartHeight
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

  const formatTick = (val: number, isTop: boolean) => {
    if (formatter) {
      return formatter(val)
    }
    const formattedNum =
      Number.isInteger(val) && (ceiling > 10 || val === 0)
        ? val.toString()
        : val.toFixed(1)
    if (isTop && unit) {
      return `${formattedNum} ${unit}`
    }
    return formattedNum
  }

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div
        className="relative flex w-full items-stretch gap-2"
        style={{ height }}
      >
        {showYAxis && (
          <div
            data-testid="sparkline-y-axis"
            className="relative shrink-0 pr-1 text-right text-[10px] font-medium text-muted-foreground tabular-nums select-none"
            style={{ width: unit ? 54 : 36 }}
          >
            {tickValues.map((val, idx) => (
              <span
                key={idx}
                className="absolute right-1 -translate-y-1/2 whitespace-nowrap"
                style={{ top: `${getY(val)}%` }}
              >
                {formatTick(val, idx === 0)}
              </span>
            ))}
          </div>
        )}

        <div className="relative flex-1" style={{ height }}>
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

            {/* Horizontal gridlines (optional, off by default) */}
            {showGridLines &&
              tickValues.map((val, idx) => {
                const y = getY(val).toFixed(1)
                return (
                  <line
                    key={idx}
                    x1="0"
                    y1={y}
                    x2="400"
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    strokeOpacity={0.12}
                    strokeWidth={1}
                    data-testid="sparkline-grid-line"
                  />
                )
              })}

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
      </div>
      {/* Bottom X-axis label ticks */}
      <div
        className={cn(
          "flex items-center justify-between px-0.5 text-[11px] font-medium text-muted-foreground",
          showYAxis && (unit ? "pl-[62px]" : "pl-[44px]")
        )}
        data-testid="sparkline-ticks"
      >
        <span>{firstLabel}</span>
        {middleLabel && <span>{middleLabel}</span>}
        {lastLabel && <span>{lastLabel}</span>}
      </div>
    </div>
  )
}
