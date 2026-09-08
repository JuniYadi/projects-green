"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

export type CategoryCostItem = {
  category: string
  count: number
  totalCost?: number
}

export type WhatsAppCategoryDonutProps = {
  items: CategoryCostItem[]
  totalEntries?: number
  locale?: string
  className?: string
}

export const META_CATEGORY_COLORS: Record<string, string> = {
  UTILITY: "#22c55e",
  AUTHENTICATION: "#3b82f6",
  MARKETING: "#f59e0b",
  SERVICE: "#a855f7",
}

export function WhatsAppCategoryDonut({
  items,
  totalEntries,
  locale = "id",
  className,
}: WhatsAppCategoryDonutProps) {
  const [hoveredCat, setHoveredCat] = useState<string | null>(null)

  const totalCount = useMemo(() => {
    if (typeof totalEntries === "number" && totalEntries > 0)
      return totalEntries
    return items.reduce((sum, item) => sum + item.count, 0)
  }, [items, totalEntries])

  // Geometry calculations for SVG Donut Ring
  const size = 130
  const center = size / 2
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Calculate arc slices (pure, no mutation)
  const slices = useMemo(() => {
    const percents = items.map((item) => Math.max(0, item.count / totalCount))
    // Precompute cumulative offsets for strokeDashoffset
    const offsets = percents.reduce<number[]>((acc, pct) => {
      acc.push((acc[acc.length - 1] ?? 0) + pct)
      return acc
    }, [])

    return items.map((item, idx) => {
      const cleanName = item.category
        .replace("WHATSAPP_MESSAGE_", "")
        .replace("WHATSAPP_", "")
      const pct = percents[idx]
      const prevOffset = idx > 0 ? (offsets[idx - 1] ?? 0) : 0
      const strokeDasharray = `${pct * circumference} ${circumference * (1 - pct)}`
      const strokeDashoffset = -(prevOffset * circumference)

      const color =
        META_CATEGORY_COLORS[item.category] ??
        META_CATEGORY_COLORS[cleanName] ??
        "#10b981"

      return {
        category: item.category,
        name: cleanName,
        count: item.count,
        percent: Number((pct * 100).toFixed(1)),
        color,
        strokeDasharray,
        strokeDashoffset,
      }
    })
  }, [items, totalCount, circumference])

  if (!items || items.length === 0 || totalCount === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground",
          className
        )}
      >
        <span>
          {locale === "id"
            ? "Belum ada data kategori bulan ini."
            : "No category data available this month."}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-6 sm:flex-row",
        className
      )}
    >
      {/* Left: Pure-SVG Donut Ring */}
      <div className="relative flex size-[140px] shrink-0 items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="-rotate-90 overflow-visible select-none"
        >
          {/* Background Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />

          {/* Slices */}
          {slices.map((slice) => {
            const isHovered = hoveredCat === slice.category
            return (
              <circle
                key={slice.category}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredCat(slice.category)}
                onMouseLeave={() => setHoveredCat(null)}
                className="cursor-pointer transition-all duration-150 hover:opacity-90"
                data-testid={`donut-slice-${slice.name.toLowerCase()}`}
              >
                <title>{`${slice.name}: ${slice.count} (${slice.percent}%)`}</title>
              </circle>
            )
          })}
        </svg>

        {/* Donut Center Label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-xl font-extrabold tracking-tight text-foreground">
            {totalCount.toLocaleString()}
          </span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            {locale === "id" ? "Pesan" : "Messages"}
          </span>
        </div>
      </div>

      {/* Right: Modern Category Breakdown Rows */}
      <div className="w-full space-y-2.5 text-xs">
        {slices.map((slice) => {
          const isHovered = hoveredCat === slice.category
          return (
            <div
              key={slice.category}
              onMouseEnter={() => setHoveredCat(slice.category)}
              onMouseLeave={() => setHoveredCat(null)}
              className={cn(
                "group cursor-pointer rounded-lg border border-transparent p-1.5 transition-all",
                isHovered ? "border-border bg-muted/30" : "hover:bg-muted/15"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-semibold text-foreground">
                    {slice.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-muted-foreground">
                    {slice.count.toLocaleString()}{" "}
                    {locale === "id" ? "pesan" : "msgs"}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">
                    {slice.percent}%
                  </span>
                </div>
              </div>

              {/* Progress bar track */}
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${slice.percent}%`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
