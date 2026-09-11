import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  UsersThree,
  CheckCircle,
  Lightning,
  HardDrive,
  WarningCircle,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export interface TrafficSummaryCardsProps {
  totalRequests: number
  successRate: number
  avgLatencyMs: number
  totalBytesFormatted: string
  periodLabel: string
}

export function TrafficSummaryCards({
  totalRequests,
  successRate,
  avgLatencyMs,
  totalBytesFormatted,
  periodLabel,
}: TrafficSummaryCardsProps) {
  const isHealthy = successRate >= 98
  const isFast = avgLatencyMs > 0 && avgLatencyMs < 200

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Kunjungan */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Total Kunjungan
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {totalRequests.toLocaleString("id-ID")}
            </p>
            <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground">
            <UsersThree size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Status Keberhasilan */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Tingkat Keberhasilan
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {totalRequests > 0 ? `${successRate}%` : "100%"}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 text-[11px] font-medium",
                  isHealthy
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-500 dark:text-amber-400"
                )}
              >
                {isHealthy ? (
                  <>
                    <CheckCircle size={12} weight="fill" />
                    <span>Lancar</span>
                  </>
                ) : (
                  <>
                    <WarningCircle size={12} weight="fill" />
                    <span>Perhatian</span>
                  </>
                )}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {totalRequests > 0
                ? `${Math.round(((100 - successRate) * totalRequests) / 100)} respon error`
                : "Semua respon aman"}
            </p>
          </div>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg border",
              isHealthy
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                : "border-amber-500/20 bg-amber-500/10 text-amber-500"
            )}
          >
            <CheckCircle size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Kecepatan Respon */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Kecepatan Respon
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {avgLatencyMs > 0
                  ? `${(avgLatencyMs / 1000).toFixed(2)}s`
                  : "< 0.05s"}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 text-[11px] font-medium",
                  isFast
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                    : "border-border bg-muted/10 text-muted-foreground"
                )}
              >
                <Lightning size={12} weight="fill" />
                <span>{isFast ? "Cepat" : "Normal"}</span>
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Rata-rata {avgLatencyMs} ms
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground">
            <Lightning size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Kuota Bandwidth */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Transfer Data
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {totalBytesFormatted}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Total bandwidth keluar
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground">
            <HardDrive size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
