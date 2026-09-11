import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  WarningCircle,
  MagnifyingGlass,
  ArrowSquareOut,
  CheckCircle,
} from "@phosphor-icons/react"
import type { LogErrorSignature } from "../../opensearch/opensearch-log-health.types"

export interface LogTopErrorsCardProps {
  appSlug: string
  topErrors: LogErrorSignature[]
  onFilterLogText?: (filter: string) => void
}

export function LogTopErrorsCard({
  appSlug,
  topErrors,
  onFilterLogText,
}: LogTopErrorsCardProps) {
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false)
  const [drilldownLogs, setDrilldownLogs] = useState<LogErrorSignature[]>([])
  const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false)

  const handleOpenDrilldown = async () => {
    setIsDrilldownOpen(true)
    setIsLoadingDrilldown(true)
    try {
      const res = await fetch(
        `/api/deploy/apps/${encodeURIComponent(appSlug)}/logs/errors?limit=50`
      )
      if (res.ok) {
        const json = await res.json()
        setDrilldownLogs((json.data ?? []) as LogErrorSignature[])
      }
    } catch {
      // Fallback to topErrors
      setDrilldownLogs(topErrors)
    } finally {
      setIsLoadingDrilldown(false)
    }
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <WarningCircle size={18} className="text-muted-foreground" />
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  Daftar Masalah & Exception Terdeteksi
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Ringkasan error paling sering muncul (Top 10)
                </CardDescription>
              </div>
            </div>
            {topErrors.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDrilldown}
                className="gap-1.5 text-xs"
              >
                <span>Lihat Semua Masalah</span>
                <ArrowSquareOut size={13} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {topErrors.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center text-xs text-emerald-500">
              <CheckCircle size={24} weight="duotone" />
              <div>
                <p className="font-semibold">Aplikasi Berjalan Sempurna!</p>
                <p className="text-muted-foreground">
                  Tidak ada error atau exception yang dicatat oleh pod aplikasi.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topErrors.map((err, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between gap-2 rounded-md border border-border bg-muted/10 p-3 text-xs sm:flex-row sm:items-center"
                >
                  <div className="max-w-[500px] space-y-0.5">
                    <p className="truncate font-mono font-medium text-foreground">
                      {err.signature}
                    </p>
                    {err.sampleMessage &&
                      err.sampleMessage !== err.signature && (
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {err.sampleMessage}
                        </p>
                      )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-[11px] text-destructive"
                    >
                      {err.count.toLocaleString("id-ID")}x insiden
                    </Badge>
                    {onFilterLogText && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onFilterLogText(err.signature)}
                        className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <MagnifyingGlass size={12} />
                        <span>Filter Log</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal On-Demand Deep Drilldown */}
      <Dialog open={isDrilldownOpen} onOpenChange={setIsDrilldownOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Katalog Lengkap Masalah & Exception
            </DialogTitle>
            <DialogDescription className="text-xs">
              Daftar seluruh error yang dicatat oleh pod aplikasi {appSlug} dari
              OpenSearch
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pt-2">
            {isLoadingDrilldown ? (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Memuat katalog error dari OpenSearch...
              </p>
            ) : drilldownLogs.length === 0 ? (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Tidak ada error tambahan yang ditemukan.
              </p>
            ) : (
              drilldownLogs.map((err, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/10 p-2.5 text-xs"
                >
                  <div className="max-w-[420px] space-y-0.5">
                    <p className="truncate font-mono font-medium text-foreground">
                      {err.signature}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {err.sampleMessage}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] text-destructive"
                    >
                      {err.count}x
                    </Badge>
                    {onFilterLogText && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          onFilterLogText(err.signature)
                          setIsDrilldownOpen(false)
                        }}
                        className="text-[10px]"
                      >
                        Filter di Konsol
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
