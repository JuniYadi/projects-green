"use client"

import { useId, useState } from "react"
import { cn } from "@/lib/utils"

export type WhatsAppDailyTraffic = {
  date: string
  label?: string
  messageInboxCount: number
  messageOutboxCount: number
}

export type WhatsAppTrafficChartProps = {
  data: WhatsAppDailyTraffic[]
  locale?: string
  height?: number
  className?: string
  showSummary?: boolean
}

export function WhatsAppTrafficChart({
  data,
  locale = "id",
  height = 200,
  className,
  showSummary = true,
}: WhatsAppTrafficChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const rawId = useId()
  const gradientId = `whatsapp-traffic-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`

  const isAllZero =
    !data ||
    data.length === 0 ||
    data.every(
      (d) =>
        (d.messageInboxCount ?? 0) === 0 && (d.messageOutboxCount ?? 0) === 0
    )

  if (isAllZero) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-xs text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        {locale === "id" ? "Belum ada data trafik" : "No traffic data"}
      </div>
    )
  }

  const allInbound = data.map((d) => d.messageInboxCount ?? 0)
  const allOutbound = data.map((d) => d.messageOutboxCount ?? 0)
  const rawMax = Math.max(1, ...allInbound, ...allOutbound)
  const getNiceYScale = (val: number) => {
    if (val <= 2) return { max: 2, mid: 1 }
    if (val <= 4) return { max: 4, mid: 2 }
    if (val <= 6) return { max: 6, mid: 3 }
    if (val <= 10) return { max: 10, mid: 5 }
    if (val <= 20) return { max: 20, mid: 10 }
    if (val <= 50) return { max: 50, mid: 25 }
    if (val <= 100) return { max: 100, mid: 50 }
    const mag = Math.pow(10, Math.floor(Math.log10(val)))
    const step = Math.ceil(val / (mag * 2)) * (mag * 2)
    return { max: step, mid: Math.round(step / 2) }
  }
  const { max: maxY, mid: midY } = getNiceYScale(rawMax)

  const totalInbox = allInbound.reduce((acc, v) => acc + v, 0)
  const totalOutbox = allOutbound.reduce((acc, v) => acc + v, 0)

  const paddingTop = 8
  const paddingBottom = 8
  const chartHeight = 100 - paddingTop - paddingBottom

  const getY = (val: number) => {
    const clamped = Math.max(0, val)
    return paddingTop + (1 - clamped / maxY) * chartHeight
  }

  const getX = (idx: number) => {
    if (data.length <= 1) return 0
    return (idx / (data.length - 1)) * 400
  }

  const primaryLineD =
    data.length === 1
      ? `M 0,${getY(data[0].messageInboxCount).toFixed(1)} L 400,${getY(data[0].messageInboxCount).toFixed(1)}`
      : `M ${data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.messageInboxCount).toFixed(1)}`).join(" L ")}`

  const primaryAreaD = `${primaryLineD} L 400,100 L 0,100 Z`

  const secondaryLineD =
    data.length === 1
      ? `M 0,${getY(data[0].messageOutboxCount).toFixed(1)} L 400,${getY(data[0].messageOutboxCount).toFixed(1)}`
      : `M ${data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.messageOutboxCount).toFixed(1)}`).join(" L ")}`

  const formatTickDate = (d?: WhatsAppDailyTraffic) => {
    if (!d) return ""
    if (d.label) return d.label
    try {
      const parsed = new Date(d.date)
      if (Number.isNaN(parsed.getTime())) return d.date
      return parsed.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
        day: "numeric",
        month: "short",
      })
    } catch {
      return d.date
    }
  }

  const firstLabel = formatTickDate(data[0])
  const middleIndex = Math.floor(data.length / 2)
  const middleLabel =
    data.length > 2 ? formatTickDate(data[middleIndex]) : undefined
  const lastLabel = data.length > 1 ? formatTickDate(data[data.length - 1]) : ""

  const hoveredItem =
    hoveredIdx !== null && data[hoveredIdx] ? data[hoveredIdx] : null

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <div className="flex w-full items-stretch gap-2.5" style={{ height }}>
        {/* Left Y-axis scale numbers */}
        <div
          data-testid="traffic-y-axis"
          className="flex w-6 shrink-0 flex-col justify-between pt-1 pb-1 text-right font-mono text-[10px] text-muted-foreground/80 select-none"
        >
          <span>{maxY}</span>
          <span>{midY}</span>
          <span>0</span>
        </div>

        {/* SVG Canvas Area */}
        <div
          className="relative flex-1"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <svg
            viewBox="0 0 400 100"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            className="overflow-visible select-none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Guide Lines */}
            <line
              x1={0}
              y1={paddingTop}
              x2={400}
              y2={paddingTop}
              stroke="currentColor"
              strokeDasharray="3 3"
              strokeOpacity={0.15}
              data-testid="traffic-grid-top"
            />
            <line
              x1={0}
              y1={paddingTop + chartHeight / 2}
              x2={400}
              y2={paddingTop + chartHeight / 2}
              stroke="currentColor"
              strokeDasharray="3 3"
              strokeOpacity={0.15}
              data-testid="traffic-grid-mid"
            />
            <line
              x1={0}
              y1={100 - paddingBottom}
              x2={400}
              y2={100 - paddingBottom}
              stroke="currentColor"
              strokeOpacity={0.2}
              data-testid="traffic-grid-base"
            />
            {/* Inbound Gradient Fill Area */}
            <path
              d={primaryAreaD}
              fill={`url(#${gradientId})`}
              data-testid="traffic-primary-area"
            />

            {/* Outbound Line (Sky-400) */}
            <path
              d={secondaryLineD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              data-testid="traffic-secondary-line"
            />

            {/* Inbound Line (Emerald-500) */}
            <path
              d={primaryLineD}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              data-testid="traffic-primary-line"
            />

            {/* Hover Crosshair and Markers */}
            {hoveredIdx !== null && hoveredItem && (
              <g data-testid="traffic-hover-group">
                <line
                  x1={getX(hoveredIdx)}
                  y1={0}
                  x2={getX(hoveredIdx)}
                  y2={100}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  data-testid="traffic-crosshair"
                />
                <circle
                  cx={getX(hoveredIdx)}
                  cy={getY(hoveredItem.messageInboxCount)}
                  r={3.5}
                  fill="#10b981"
                  stroke="white"
                  strokeWidth={1.5}
                  data-testid="traffic-inbound-marker"
                />
                <circle
                  cx={getX(hoveredIdx)}
                  cy={getY(hoveredItem.messageOutboxCount)}
                  r={3.5}
                  fill="#38bdf8"
                  stroke="white"
                  strokeWidth={1.5}
                  data-testid="traffic-outbound-marker"
                />
              </g>
            )}

            {/* Interactive Invisible Slice Columns for Hover Tracking */}
            {data.map((item, idx) => {
              const sliceWidth = 400 / data.length
              const x = idx * sliceWidth
              return (
                <rect
                  key={`slice-${item.date}-${idx}`}
                  x={x}
                  y={0}
                  width={sliceWidth}
                  height={100}
                  fill="transparent"
                  className="cursor-pointer"
                  data-testid={`traffic-slice-${idx}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              )
            })}
          </svg>
        </div>
      </div>

      {/* External Bottom Ticks */}
      <div
        className="flex items-center justify-between pr-0.5 pl-[34px] text-[11px] font-medium text-muted-foreground"
        data-testid="traffic-chart-ticks"
      >
        <span>{firstLabel}</span>
        {middleLabel && <span>{middleLabel}</span>}
        {lastLabel && <span>{lastLabel}</span>}
      </div>

      {/* Interactive Tooltip Badge when Hovered or Summary */}
      {hoveredItem ? (
        <div
          data-testid="traffic-tooltip"
          className="flex items-center justify-center gap-4 rounded-md border border-border/80 bg-muted/40 px-3 py-1 text-xs"
        >
          <span className="font-semibold text-foreground">
            {hoveredItem.label ??
              new Date(hoveredItem.date).toLocaleDateString(
                locale === "id" ? "id-ID" : "en-US",
                { weekday: "short", day: "numeric", month: "short" }
              )}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-emerald-500">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>
              {locale === "id" ? "Masuk" : "Inbound"}:{" "}
              <strong>{hoveredItem.messageInboxCount}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-sky-400">
            <span className="size-1.5 rounded-full bg-sky-400" />
            <span>
              {locale === "id" ? "Keluar" : "Outbound"}:{" "}
              <strong>{hoveredItem.messageOutboxCount}</strong>
            </span>
          </span>
        </div>
      ) : showSummary ? (
        <div
          data-testid="traffic-summary"
          className="flex items-center justify-center gap-4 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>
              {locale === "id" ? "Masuk" : "Inbound"}:{" "}
              <strong>{totalInbox}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-sky-500 dark:text-sky-400">
            <span className="size-1.5 rounded-full bg-sky-400" />
            <span>
              {locale === "id" ? "Keluar" : "Outbound"}:{" "}
              <strong>{totalOutbox}</strong>
            </span>
          </span>
        </div>
      ) : null}
    </div>
  )
}
