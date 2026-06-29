"use client"

import * as React from "react"

type QuotaProgressBarProps = {
  used: number
  total: number
  label?: string
  showPercent?: boolean
}

export function QuotaProgressBar({
  used,
  total,
  label,
  showPercent = true,
}: QuotaProgressBarProps) {
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0

  const colorClass =
    percent >= 90
      ? "bg-red-500"
      : percent >= 70
        ? "bg-yellow-500"
        : "bg-green-500"

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          {showPercent && (
            <span
              className={
                percent >= 90
                  ? "font-medium text-red-600 dark:text-red-400"
                  : percent >= 70
                    ? "font-medium text-yellow-600 dark:text-yellow-400"
                    : "text-muted-foreground"
              }
            >
              {percent.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{used.toLocaleString()} used</span>
        <span>{total.toLocaleString()} quota</span>
      </div>
    </div>
  )
}
