import { useMemo } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

export interface LogHourlyTrendItemDTO {
  label: string
  info: number
  warn: number
  error: number
}

export interface LogHourlyChartProps {
  trend: LogHourlyTrendItemDTO[]
  granularity: "daily" | "monthly" | "yearly"
  periodLabel: string
}

export function LogHourlyChart({
  trend,
  granularity,
  periodLabel,
}: LogHourlyChartProps) {
  const maxLogs = useMemo(() => {
    let max = 1
    for (const item of trend) {
      const sum = item.info + item.warn + item.error
      if (sum > max) max = sum
    }
    return max
  }, [trend])

  const axisSubtitle =
    granularity === "daily"
      ? "Distribusi per jam (00:00 - 23:00 UTC)"
      : granularity === "monthly"
        ? "Distribusi per tanggal (1 - 31)"
        : "Distribusi per bulan (Jan - Des)"

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Grafik Tren Insiden Log
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {axisSubtitle} — {periodLabel}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
              <span>Info</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              <span>Warn</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
              <span>Error</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ||
        trend.every((t) => t.info === 0 && t.warn === 0 && t.error === 0) ? (
          <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/5 text-xs text-muted-foreground">
            <p>Belum ada rekaman log container pada periode ini.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex h-44 items-end gap-1.5 pt-6 pb-2">
              {trend.map((item, idx) => {
                const total = item.info + item.warn + item.error
                const heightPercent = Math.max(
                  Math.round((total / maxLogs) * 100),
                  4
                )

                const errorPercent =
                  total > 0 ? Math.round((item.error / total) * 100) : 0
                const warnPercent =
                  total > 0 ? Math.round((item.warn / total) * 100) : 0

                return (
                  <div
                    key={idx}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center rounded-md border border-border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground shadow-sm group-hover:flex">
                      <span className="font-semibold">{item.label}</span>
                      <span>
                        {total.toLocaleString("id-ID")} logs
                        {item.error > 0 ? ` (${item.error} err)` : ""}
                      </span>
                    </div>

                    {/* Bar representation */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="flex w-full flex-col justify-end overflow-hidden rounded-t transition-all hover:opacity-80"
                    >
                      <div
                        style={{ height: `${errorPercent}%` }}
                        className="w-full bg-destructive"
                      />
                      <div
                        style={{ height: `${warnPercent}%` }}
                        className="w-full bg-amber-500"
                      />
                      <div
                        style={{
                          height: `${100 - errorPercent - warnPercent}%`,
                        }}
                        className="w-full bg-primary"
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X-Axis */}
            <div className="flex items-center justify-between border-t border-border pt-1.5 text-[10px] text-muted-foreground">
              {trend.length <= 24 ? (
                <>
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </>
              ) : trend.length <= 31 ? (
                <>
                  <span>Tgl 01</span>
                  <span>Tgl 08</span>
                  <span>Tgl 15</span>
                  <span>Tgl 22</span>
                  <span>Tgl {trend.length}</span>
                </>
              ) : (
                trend.map((t, idx) => (
                  <span key={idx} className="hidden sm:inline">
                    {t.label}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
