import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { ChartBar } from "@phosphor-icons/react"
import type { TrafficRequestQuality } from "../../opensearch/opensearch-traffic.types"

export interface TrafficRequestQualityCardProps {
  requestQuality: TrafficRequestQuality
}

const STATUS_ROWS = [
  {
    key: "status2xx" as const,
    pctKey: "status2xxPct" as const,
    label: "2xx Berhasil",
    className: "bg-emerald-500",
  },
  {
    key: "status3xx" as const,
    pctKey: "status3xxPct" as const,
    label: "3xx Dialihkan",
    className: "bg-sky-500",
  },
  {
    key: "status4xx" as const,
    pctKey: "status4xxPct" as const,
    label: "4xx Error Klien",
    className: "bg-amber-500",
  },
  {
    key: "status5xx" as const,
    pctKey: "status5xxPct" as const,
    label: "5xx Error Server",
    className: "bg-rose-500",
  },
]

export function TrafficRequestQualityCard({
  requestQuality,
}: TrafficRequestQualityCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ChartBar size={18} className="text-muted-foreground" />
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Kualitas Permintaan
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Komposisi status HTTP periode ini (termasuk aset statis)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!requestQuality.hasBreakdown ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Data rinci status belum tersedia untuk periode ini
          </div>
        ) : (
          <div className="space-y-3">
            {STATUS_ROWS.map((row) => {
              const count = requestQuality[row.key]
              const pct = requestQuality[row.pctKey]
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {row.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {pct}%
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({count.toLocaleString("id-ID")} req)
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${row.className}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
