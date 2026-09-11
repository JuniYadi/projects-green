import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck,
  WarningCircle,
  Warning,
  FileText,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export interface LogHealthSummaryCardsProps {
  healthScore: number
  totalLogs: number
  errorCount: number
  warnCount: number
  periodLabel: string
}

export function LogHealthSummaryCards({
  healthScore = 100,
  totalLogs = 0,
  errorCount = 0,
  warnCount = 0,
  periodLabel = "",
}: LogHealthSummaryCardsProps) {
  const isHealthy = healthScore >= 95

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Skor Kestabilan */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Skor Kestabilan Aplikasi
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {healthScore}%
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 text-[11px] font-medium",
                  isHealthy
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                {isHealthy ? (
                  <>
                    <ShieldCheck size={12} weight="fill" />
                    <span>Stabil</span>
                  </>
                ) : (
                  <>
                    <WarningCircle size={12} weight="fill" />
                    <span>Insiden</span>
                  </>
                )}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
          </div>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg border",
              isHealthy
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            )}
          >
            <ShieldCheck size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Total Error */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Total Insiden Error
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {errorCount.toLocaleString("id-ID")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {errorCount > 0
                ? "Perlu perhatian developer"
                : "Tidak ada exception"}
            </p>
          </div>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg border",
              errorCount > 0
                ? "border-destructive/20 bg-destructive/10 text-destructive"
                : "border-border bg-muted/20 text-muted-foreground"
            )}
          >
            <WarningCircle size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Peringatan (Warn) */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Peringatan (Warn)
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {warnCount.toLocaleString("id-ID")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Level peringatan non-kritis
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground">
            <Warning size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Total Baris Log */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Total Baris Log
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {totalLogs.toLocaleString("id-ID")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Output container stdout/stderr
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/20 text-muted-foreground">
            <FileText size={24} weight="duotone" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
