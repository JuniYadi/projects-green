"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowsClockwise, MagnifyingGlass } from "@phosphor-icons/react"
import { LogHealthSummaryCards } from "./log-health-summary-cards"
import { LogHourlyChart } from "./log-hourly-chart"
import { LogTopErrorsCard } from "./log-top-errors-card"
import type { AppLogReportDTO } from "../../opensearch/opensearch-log-health.types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

import type { LogMessage } from "@/modules/deploy/operate.types"

type TabLogsProps = {
  logs?: LogMessage[]
  setLogs?: React.Dispatch<React.SetStateAction<LogMessage[]>>
  diagnosticMode?: string
  appSlug?: string
}

export function TabLogs({
  logs: propLogs,
  setLogs: propSetLogs,
  diagnosticMode = "production",
  appSlug,
}: TabLogsProps) {
  const [granularity, setGranularity] = useState<
    "daily" | "monthly" | "yearly"
  >("daily")
  const [targetDate, setTargetDate] = useState("")
  const [targetMonth, setTargetMonth] = useState("")
  const [targetYear, setTargetYear] = useState("")

  // Query health report from PostgreSQL snapshots
  const { data: healthReport } = useQuery<AppLogReportDTO>({
    queryKey: [
      "app-log-health-report",
      appSlug,
      granularity,
      targetDate,
      targetMonth,
      targetYear,
    ],
    queryFn: async () => {
      if (!appSlug) return null
      const p = new URLSearchParams()
      p.set("granularity", granularity)
      if (granularity === "daily" && targetDate) p.set("date", targetDate)
      if (granularity === "monthly" && targetMonth) p.set("month", targetMonth)
      if (granularity === "yearly" && targetYear) p.set("year", targetYear)
      const res = await fetch(
        `/api/deploy/apps/${encodeURIComponent(appSlug)}/logs/report?${p.toString()}`
      )
      if (!res.ok) return null
      const json = await res.json()
      return json.data as AppLogReportDTO
    },
    enabled: Boolean(appSlug),
  })
  const [internalLogs, setInternalLogs] = useState<LogMessage[]>(propLogs ?? [])
  const [logFilterQuery, setLogFilterQuery] = useState("")
  const [logFilterLevel, setLogFilterLevel] = useState<
    "ALL" | "INFO" | "WARN" | "ERROR"
  >("ALL")
  const [isLiveTailing, setIsLiveTailing] = useState(true)
  const [isLoading, setIsLoading] = useState(Boolean(appSlug))
  const [isRefreshing, setIsRefreshing] = useState(false)

  const activeLogs = propLogs ?? internalLogs
  const updateLogs = propSetLogs ?? setInternalLogs
  const logConsoleEndRef = useRef<HTMLDivElement>(null)

  // Fetch real logs from OpenSearch API when appSlug is present
  const fetchRealLogs = useCallback(async () => {
    if (!appSlug) return
    try {
      const queryParams = new URLSearchParams()
      queryParams.set("limit", "100")
      queryParams.set("order", "asc")
      if (logFilterLevel !== "ALL") {
        queryParams.set("level", logFilterLevel)
      }
      if (logFilterQuery.trim().length > 0) {
        queryParams.set("q", logFilterQuery.trim())
      }

      const res = await fetch(
        `/api/deploy/apps/${encodeURIComponent(appSlug)}/logs?${queryParams.toString()}`
      )
      if (res.ok) {
        const json = await res.json()
        if (json?.ok && Array.isArray(json.data)) {
          updateLogs(json.data)
        }
      }
    } catch (error) {
      console.error("[TabLogs] Failed to fetch real OpenSearch logs:", error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [appSlug, logFilterLevel, logFilterQuery, updateLogs])

  // Initial fetch on mount or when filter changes
  useEffect(() => {
    if (!appSlug) return
    void fetchRealLogs()
  }, [appSlug, fetchRealLogs])

  // Polling for live tailing when appSlug is present
  useEffect(() => {
    if (!appSlug || !isLiveTailing) return

    const interval = setInterval(() => {
      void fetchRealLogs()
    }, 30000)

    return () => clearInterval(interval)
  }, [appSlug, isLiveTailing, fetchRealLogs])
  // Scroll to bottom of logs when new logs arrive
  useEffect(() => {
    if (logConsoleEndRef.current && isLiveTailing) {
      logConsoleEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [activeLogs, isLiveTailing])

  // Fallback simulator ONLY when appSlug is NOT provided and diagnosticMode != production
  useEffect(() => {
    if (appSlug || !isLiveTailing || diagnosticMode === "production") return

    const interval = setInterval(() => {
      const now = new Date()
      const timestamp = now.toTimeString().split(" ")[0]

      const randomLogs: LogMessage[] = [
        {
          timestamp,
          level: "INFO",
          source: "nginx",
          message: `172.19.0.4 - "GET /api/v1/health HTTP/1.1" 200 42 "-"`,
        },
        {
          timestamp,
          level: "INFO",
          source: "app",
          message: "Resolved route: Api\\HealthController@check",
        },
        {
          timestamp,
          level: "INFO",
          source: "database",
          message: "SQL query completed (0.4ms): SELECT 1",
        },
      ]

      if (diagnosticMode === "error_502") {
        randomLogs.push({
          timestamp,
          level: "ERROR",
          source: "nginx",
          message:
            '[error] 14#14: *1534 connect() failed (111: Connection refused) while connecting to upstream, client: 162.158.12.98, server: laravelshop.com, request: "GET / HTTP/1.1", upstream: "http://127.0.0.1:9000/"',
        })
      } else if (diagnosticMode === "ssl_expired") {
        randomLogs.push({
          timestamp,
          level: "ERROR",
          source: "nginx",
          message:
            "[crit] 14#14: *1539 SSL_do_handshake() failed (SSL: error:0A0000C4:SSL routines::ssl handshake failure:expired certificate) while SSL handshaking, client: 172.69.7.35",
        })
      } else if (diagnosticMode === "redirect_loop") {
        randomLogs.push({
          timestamp,
          level: "WARN",
          source: "nginx",
          message:
            '162.158.14.88 - "GET / HTTP/1.1" 301 162 "-" (Internal redirection loop detected)',
        })
      }

      const randomSelection =
        randomLogs[Math.floor(Math.random() * randomLogs.length)]
      updateLogs((prev) => [...prev.slice(-30), randomSelection])
    }, 30000)

    return () => clearInterval(interval)
  }, [appSlug, isLiveTailing, diagnosticMode, updateLogs])

  const filteredLogs = useMemo(() => {
    return activeLogs.filter((log) => {
      const matchQuery =
        log.message.toLowerCase().includes(logFilterQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(logFilterQuery.toLowerCase())
      const matchLevel =
        logFilterLevel === "ALL" || log.level === logFilterLevel
      return matchQuery && matchLevel
    })
  }, [activeLogs, logFilterQuery, logFilterLevel])

  return (
    <div className="space-y-6">
      {/* 1. Health Insights Section (Baby UX) */}
      {appSlug && (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Laporan Kesehatan Aplikasi (Logs Health)
              </h2>
              <p className="text-xs text-muted-foreground">
                Skor stabilitas dan deteksi insiden runtime pod container
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-muted/10 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setGranularity("daily")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    granularity === "daily"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Harian
                </button>
                <button
                  type="button"
                  onClick={() => setGranularity("monthly")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    granularity === "monthly"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setGranularity("yearly")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    granularity === "yearly"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tahunan
                </button>
              </div>

              {granularity === "daily" && (
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
                />
              )}
              {granularity === "monthly" && (
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
                />
              )}
              {granularity === "yearly" && (
                <input
                  type="number"
                  min="2024"
                  max="2035"
                  placeholder="Tahun"
                  value={targetYear}
                  onChange={(e) => setTargetYear(e.target.value)}
                  className="h-8 w-24 rounded-md border border-border bg-background px-2.5 text-xs text-foreground"
                />
              )}
            </div>
          </div>

          {healthReport && (
            <div className="space-y-4">
              <LogHealthSummaryCards
                healthScore={healthReport.healthScore}
                totalLogs={healthReport.totalLogs}
                errorCount={healthReport.errorCount}
                warnCount={healthReport.warnCount}
                periodLabel={healthReport.periodLabel}
              />
              <LogHourlyChart
                trend={healthReport.trend}
                granularity={healthReport.granularity}
                periodLabel={healthReport.periodLabel}
              />
              <LogTopErrorsCard
                appSlug={appSlug}
                topErrors={healthReport.topErrors}
                onFilterLogText={(text) => {
                  setLogFilterQuery(text)
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 2. Raw Live Log Console Section */}
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold text-foreground">
              Opensearch Log Viewer
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Live streaming log aggregates index from this workspace cluster
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {appSlug && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setIsRefreshing(true)
                  void fetchRealLogs()
                }}
                disabled={isRefreshing}
                className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground"
              >
                <ArrowsClockwise
                  size={13}
                  className={isRefreshing ? "animate-spin" : ""}
                />
                <span>Refresh</span>
              </Button>
            )}
            <span
              className="cursor-pointer text-xs text-muted-foreground select-none"
              onClick={() => setIsLiveTailing(!isLiveTailing)}
            >
              Live Tail (30s)
            </span>
            <Switch
              checked={isLiveTailing}
              onCheckedChange={setIsLiveTailing}
              aria-label="Live Tail"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Level Filter bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-2.5 text-xs dark:bg-black/40">
            <div className="relative min-w-[240px] flex-1">
              <MagnifyingGlass
                size={15}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="text"
                placeholder="Search logs (e.g. nginx, connect, database)..."
                value={logFilterQuery}
                onChange={(e) => setLogFilterQuery(e.target.value)}
                className="h-8 rounded-lg pl-9 text-xs"
              />
            </div>

            <div className="flex gap-1.5">
              {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => {
                const isActive = logFilterLevel === lvl
                const dotColor =
                  lvl === "INFO"
                    ? "bg-blue-400"
                    : lvl === "WARN"
                      ? "bg-amber-400"
                      : lvl === "ERROR"
                        ? "bg-red-400"
                        : "bg-foreground"
                return (
                  <Button
                    key={lvl}
                    type="button"
                    onClick={() => setLogFilterLevel(lvl)}
                    variant={isActive ? "default" : "outline"}
                    size="xs"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                    {lvl}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Logs display shell */}
          <div className="max-h-[350px] min-h-[220px] space-y-1 overflow-auto rounded-xl border border-border bg-zinc-950 px-4 py-3.5 font-mono text-[11px] leading-relaxed text-zinc-100 shadow-inner dark:bg-[#050507]">
            {isLoading && activeLogs.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
                <ArrowsClockwise
                  size={20}
                  className="animate-spin text-primary"
                />
                <p className="text-xs">Memuat log dari OpenSearch cluster...</p>
              </div>
            ) : (
              filteredLogs.map((log, idx) => {
                const levelBadgeStyle =
                  log.level === "ERROR"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : log.level === "WARN"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"

                const sourceBadgeStyle =
                  log.source === "nginx"
                    ? "text-purple-400"
                    : log.source === "app" || log.source === "deploy"
                      ? "text-cyan-400"
                      : "text-amber-300"

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-1 transition-colors select-text hover:border-white/[0.03] hover:bg-white/[0.03]"
                  >
                    <span className="shrink-0 font-semibold text-muted-foreground/60 select-none">
                      {log.timestamp}
                    </span>
                    <span
                      className={`py-0.2 shrink-0 rounded border px-1.5 text-[9px] font-bold tracking-wider uppercase ${levelBadgeStyle}`}
                    >
                      {log.level}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-semibold ${sourceBadgeStyle}`}
                    >
                      [{log.source}]
                    </span>
                    <span className="leading-relaxed font-medium break-all text-white/90">
                      {log.message}
                    </span>
                  </div>
                )
              })
            )}

            {!isLoading && filteredLogs.length === 0 && (
              <div className="flex h-[200px] flex-col items-center justify-center gap-2 p-10 text-center font-sans text-xs font-medium text-muted-foreground/80">
                <p>Belum ada output log di OpenSearch untuk service ini.</p>
                <p className="text-[11px] text-muted-foreground/60">
                  Pod mungkin sedang proses booting atau belum menghasilkan
                  output stdout/stderr.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setIsRefreshing(true)
                    void fetchRealLogs()
                  }}
                  className="mt-2 text-xs"
                >
                  Cek Ulang
                </Button>
              </div>
            )}
            <div ref={logConsoleEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
