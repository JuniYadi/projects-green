"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export type WhatsAppDailyTraffic = {
  date: string
  messageInboxCount: number
  messageOutboxCount: number
}

export type WhatsAppTrafficChartProps = {
  data: WhatsAppDailyTraffic[]
  locale?: string
  height?: number
  className?: string
}

export function WhatsAppTrafficChart({
  data,
  locale = "id",
  height = 200,
  className,
}: WhatsAppTrafficChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
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

  // Calculate maximum count to scale Y-axis cleanly (at least 5 for empty/low data)
  const maxRaw = Math.max(
    ...data.flatMap((d) => [d.messageInboxCount, d.messageOutboxCount]),
    5
  )
  // Round up to nice integer ticks
  const maxY = Math.ceil(maxRaw * 1.15)
  const ticks = [0, Math.round(maxY * 0.5), maxY]

  // Chart dimensions in viewBox coordinates
  const svgWidth = 500
  const svgHeight = 160
  const chartTop = 15
  const chartBottom = 135
  const chartLeft = 35
  const chartRight = 490
  const chartPlotWidth = chartRight - chartLeft
  const chartPlotHeight = chartBottom - chartTop

  const getY = (val: number) => {
    const clamped = Math.max(0, val)
    return chartBottom - (clamped / maxY) * chartPlotHeight
  }

  const stepX = chartPlotWidth / Math.max(data.length, 1)
  const barWidth = Math.min(14, stepX * 0.35)
  const barGap = 3

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <div className="relative w-full" style={{ height }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          className="overflow-visible select-none"
        >
          {/* Horizontal grid lines & Y-axis labels */}
          {ticks.map((tickVal) => {
            const yPos = getY(tickVal)
            return (
              <g key={`tick-${tickVal}`} className="text-muted-foreground/50">
                <line
                  x1={chartLeft}
                  y1={yPos}
                  x2={chartRight}
                  y2={yPos}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  strokeWidth={0.8}
                  strokeOpacity={0.25}
                />
                <text
                  x={chartLeft - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-[10px]"
                >
                  {tickVal}
                </text>
              </g>
            )
          })}

          {/* Grouped Bars per Date */}
          {data.map((item, idx) => {
            const groupCenterX = chartLeft + idx * stepX + stepX / 2
            const barInX = groupCenterX - barWidth - barGap / 2
            const barOutX = groupCenterX + barGap / 2

            const inY = getY(item.messageInboxCount)
            const inHeight = Math.max(0, chartBottom - inY)

            const outY = getY(item.messageOutboxCount)
            const outHeight = Math.max(0, chartBottom - outY)

            const isHovered = hoveredIdx === idx
            const formattedDate = new Date(item.date).toLocaleDateString(
              locale === "id" ? "id-ID" : "en-US",
              { day: "numeric", month: "short" }
            )

            return (
              <g
                key={`group-${item.date}-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer transition-opacity"
              >
                {/* Transparent column hit area for hover */}
                <rect
                  x={chartLeft + idx * stepX}
                  y={chartTop}
                  width={stepX}
                  height={chartPlotHeight}
                  fill={isHovered ? "currentColor" : "transparent"}
                  className="text-muted/15"
                />

                {/* Inbound Bar (Green) */}
                {inHeight > 0 && (
                  <rect
                    x={barInX}
                    y={inY}
                    width={barWidth}
                    height={inHeight}
                    rx={2.5}
                    className="fill-emerald-500 transition-all hover:brightness-110"
                    data-testid={`bar-in-${idx}`}
                  >
                    <title>{`${formattedDate} - Masuk: ${item.messageInboxCount}`}</title>
                  </rect>
                )}

                {/* Outbound Bar (Blue) */}
                {outHeight > 0 && (
                  <rect
                    x={barOutX}
                    y={outY}
                    width={barWidth}
                    height={outHeight}
                    rx={2.5}
                    className="fill-sky-500 transition-all hover:brightness-110"
                    data-testid={`bar-out-${idx}`}
                  >
                    <title>{`${formattedDate} - Keluar: ${item.messageOutboxCount}`}</title>
                  </rect>
                )}

                {/* Bottom X-axis Date Label */}
                <text
                  x={groupCenterX}
                  y={chartBottom + 16}
                  textAnchor="middle"
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    isHovered
                      ? "fill-foreground font-bold"
                      : "fill-muted-foreground"
                  )}
                >
                  {formattedDate}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Badge when Hovered */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          data-testid="traffic-tooltip"
          className="flex items-center justify-center gap-4 rounded-md border border-border/80 bg-muted/40 px-3 py-1 text-xs"
        >
          <span className="font-semibold text-foreground">
            {new Date(data[hoveredIdx].date).toLocaleDateString(
              locale === "id" ? "id-ID" : "en-US",
              { weekday: "short", day: "numeric", month: "short" }
            )}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-emerald-500">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>
              {locale === "id" ? "Masuk" : "Inbound"}:{" "}
              <strong>{data[hoveredIdx].messageInboxCount}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-sky-500">
            <span className="size-1.5 rounded-full bg-sky-500" />
            <span>
              {locale === "id" ? "Keluar" : "Outbound"}:{" "}
              <strong>{data[hoveredIdx].messageOutboxCount}</strong>
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
