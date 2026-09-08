"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"

export type PodSeries = {
  id: string
  name: string
  color: string
  values: number[]
}

export type PodMultiSeriesSparklineProps = {
  labels: string[]
  series: PodSeries[]
  limit?: number
  height?: number
  unit?: string
  formatter?: (val: number) => string
  className?: string
}

export function PodMultiSeriesSparkline({
  labels,
  series,
  limit,
  height = 110,
  unit,
  formatter,
  className,
}: PodMultiSeriesSparklineProps) {
  const rawId = useId()
  const componentId = `pod-sparkline-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`

  if (!series || series.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-xs text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        No telemetry data available
      </div>
    )
  }

  const allValues = series.flatMap((s) => s.values)
  const maxVal = Math.max(0.001, ...allValues)
  const ceiling =
    typeof limit === "number" && limit > 0
      ? Math.max(limit, maxVal)
      : maxVal * 1.35

  const tickCount = 4
  const tickValues = Array.from({ length: tickCount }, (_, i) => {
    const ratio = 1 - i / (tickCount - 1)
    return ceiling * ratio
  })

  const paddingTop = 8
  const paddingBottom = 8
  const chartHeight = 100 - paddingTop - paddingBottom

  const getY = (val: number) => {
    if (ceiling <= 0) return 100 - paddingBottom
    const clamped = Math.max(0, Math.min(val, ceiling))
    return paddingTop + (1 - clamped / ceiling) * chartHeight
  }

  const pointCount = Math.max(
    labels.length,
    ...series.map((s) => s.values.length),
    2
  )

  const getX = (index: number) => {
    if (pointCount <= 1) return 0
    return (index / (pointCount - 1)) * 100
  }

  const formatVal = (val: number) => {
    if (formatter) return formatter(val)
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`
    if (val >= 10) return val.toFixed(1)
    if (val > 0) return val.toFixed(2)
    return "0"
  }

  const limitY = typeof limit === "number" && limit > 0 ? getY(limit) : null

  // Generate paths for each series
  const seriesPaths = series.map((s) => {
    if (s.values.length === 0) return { ...s, path: "" }
    const path = s.values
      .map((val, idx) => {
        const x = getX(idx)
        const y = getY(val)
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(" ")
    return { ...s, path }
  })

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <div className="flex w-full" style={{ height }}>
        {/* Y-Axis scale */}
        <div
          className="flex flex-col justify-between pr-2 text-right font-mono text-[9px] text-muted-foreground select-none"
          style={{ width: "48px" }}
          aria-hidden="true"
        >
          {tickValues.map((t, idx) => (
            <span key={`${componentId}-tick-${idx}`} className="leading-none">
              {formatVal(t)}
              {idx === 0 && unit ? ` ${unit}` : ""}
            </span>
          ))}
        </div>

        {/* SVG Chart area */}
        <div className="relative flex-1 overflow-hidden rounded-md border border-border bg-muted/10">
          <svg
            className="h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="Pod telemetry line chart"
          >
            {/* Grid lines */}
            {tickValues.map((t, idx) => (
              <line
                key={`${componentId}-grid-${idx}`}
                x1="0"
                y1={getY(t)}
                x2="100"
                y2={getY(t)}
                stroke="currentColor"
                className="text-border/40"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            ))}

            {/* Limit line */}
            {limitY !== null && (
              <g>
                <line
                  x1="0"
                  y1={limitY}
                  x2="100"
                  y2={limitY}
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              </g>
            )}

            {/* Per-pod line paths */}
            {seriesPaths.map((s) => (
              <path
                key={s.id}
                d={s.path}
                fill="none"
                stroke={s.color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {/* Limit badge tag */}
          {limitY !== null && limit && (
            <div
              className="py-0.2 pointer-events-none absolute right-1.5 -translate-y-1/2 rounded bg-destructive/15 px-1 font-mono text-[9px] font-semibold text-destructive"
              style={{ top: `${limitY}%` }}
            >
              Limit: {formatVal(limit)} {unit ?? ""}
            </div>
          )}
        </div>
      </div>

      {/* X-Axis time ticks */}
      {labels.length > 0 && (
        <div
          className="flex justify-between pr-1 pl-12 font-mono text-[9px] text-muted-foreground select-none"
          aria-hidden="true"
        >
          <span>{labels[0]}</span>
          {labels.length > 2 && (
            <span>{labels[Math.floor(labels.length / 2)]}</span>
          )}
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}

      {/* Series Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
        {series.map((s) => {
          const lastVal = s.values[s.values.length - 1] ?? 0
          return (
            <div key={s.id} className="flex items-center gap-1.5 font-medium">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-mono text-muted-foreground">{s.name}:</span>
              <span className="font-mono font-semibold text-foreground">
                {formatVal(lastVal)} {unit ?? ""}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
