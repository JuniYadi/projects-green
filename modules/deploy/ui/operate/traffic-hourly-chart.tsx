import { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import type { TrafficTrendItem } from "../../opensearch/opensearch-traffic.types"

export interface TrafficHourlyChartProps {
  trend: TrafficTrendItem[]
  granularity: "daily" | "monthly" | "yearly"
  periodLabel: string
}

type ChartMetric = "visitors" | "requests"

export function TrafficHourlyChart({
  trend,
  granularity,
  periodLabel,
}: TrafficHourlyChartProps) {
  const [metric, setMetric] = useState<ChartMetric>("visitors")

  const maxValue = useMemo(() => {
    let max = 1
    for (const item of trend) {
      const value = metric === "visitors" ? item.visitors : item.requests
      if (value > max) max = value
    }
    return max
  }, [trend, metric])

  const axisSubtitle =
    granularity === "daily"
      ? "Distribusi per jam (00:00 - 23:00 UTC)"
      : granularity === "monthly"
        ? "Distribusi per tanggal (1 - 31)"
        : "Distribusi per bulan (Jan - Des)"

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              {metric === "visitors"
                ? "Estimasi Pengunjung"
                : "Komposisi Permintaan"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {axisSubtitle} — {periodLabel}
              {metric === "visitors" ? " (estimasi, bukan angka pasti)" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border bg-muted/10 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMetric("visitors")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  metric === "visitors"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Visitors
              </button>
              <button
                type="button"
                onClick={() => setMetric("requests")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  metric === "requests"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Requests
              </button>
            </div>
            {metric === "requests" && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  <span>Human-like</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  <span>Automated</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trend.length === 0 || trend.every((t) => t.requests === 0) ? (
          <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/5 text-xs text-muted-foreground">
            <p>Belum ada rekaman aktivitas kunjungan pada periode ini.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Chart Area */}
            <div className="flex h-44 items-end gap-1.5 pt-6 pb-2">
              {trend.map((item, idx) => {
                const value =
                  metric === "visitors" ? item.visitors : item.requests
                const heightPercent = Math.max(
                  Math.round((value / maxValue) * 100),
                  4
                )
                const automatedPercent =
                  item.requests > 0
                    ? Math.round((item.automated / item.requests) * 100)
                    : 0

                return (
                  <div
                    key={idx}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center rounded-md border border-border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground shadow-sm group-hover:flex">
                      <span className="font-semibold">{item.label}</span>
                      {metric === "visitors" ? (
                        <span>
                          ~{item.visitors.toLocaleString("id-ID")} pengunjung
                        </span>
                      ) : (
                        <>
                          <span>
                            {item.requests.toLocaleString("id-ID")} permintaan
                          </span>
                          <span>
                            {item.humanLike.toLocaleString("id-ID")} human-like,{" "}
                            {item.automated.toLocaleString("id-ID")} automated
                          </span>
                        </>
                      )}
                      {item.errors > 0 && (
                        <span className="text-destructive">
                          {item.errors.toLocaleString("id-ID")} error
                        </span>
                      )}
                    </div>

                    {/* Bar representation */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full overflow-hidden rounded-t transition-all hover:opacity-80"
                    >
                      {metric === "visitors" ? (
                        <div className="h-full w-full bg-primary" />
                      ) : (
                        <>
                          <div
                            style={{ height: `${automatedPercent}%` }}
                            className="w-full bg-amber-500"
                          />
                          <div
                            style={{ height: `${100 - automatedPercent}%` }}
                            className="w-full bg-primary"
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="flex items-center justify-between border-t border-border pt-1.5 text-[10px] text-muted-foreground">
              {trend.length <= 24 ? (
                // Daily (24 hours)
                <>
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </>
              ) : trend.length <= 31 ? (
                // Monthly (31 days)
                <>
                  <span>Tgl 01</span>
                  <span>Tgl 08</span>
                  <span>Tgl 15</span>
                  <span>Tgl 22</span>
                  <span>Tgl {trend.length}</span>
                </>
              ) : (
                // Yearly (12 months)
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
