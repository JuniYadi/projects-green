"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowsClockwise,
  CaretRight,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { LogHealthSummaryCards } from "./log-health-summary-cards"
import { LogHourlyChart } from "./log-hourly-chart"
import { LogTopErrorsCard } from "./log-top-errors-card"
import { LogColumnPicker } from "./log-column-picker"
import { LogInspectorDrawer } from "./log-inspector-drawer"
import {
  discoverLogFields,
  formatAttributeValue,
  getNestedValue,
} from "./log-table-utils"
import type { AppLogReportDTO } from "../../opensearch/opensearch-log-health.types"
import type { NormalizedLogEntry } from "../../opensearch/opensearch-log-normalizer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
      if (!appSlug) throw new Error("Missing appSlug")
      const p = new URLSearchParams()
      p.set("granularity", granularity)
      if (granularity === "daily" && targetDate) p.set("date", targetDate)
      if (granularity === "monthly" && targetMonth) p.set("month", targetMonth)
      if (granularity === "yearly" && targetYear) p.set("year", targetYear)
      const res = await fetch(
        `/api/deploy/apps/${encodeURIComponent(appSlug)}/logs/report?${p.toString()}`
      )
      if (!res.ok) throw new Error("Failed to fetch log health report")
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
  const [selectedLog, setSelectedLog] = useState<
    NormalizedLogEntry | LogMessage | null
  >(null)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem(
        `app-log-columns-${appSlug || "default"}`
      )
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })
  const [prevAppSlug, setPrevAppSlug] = useState(appSlug)

  if (prevAppSlug !== appSlug) {
    setPrevAppSlug(appSlug)
    let restored: string[] = []
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(
          `app-log-columns-${appSlug || "default"}`
        )
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) restored = parsed
        }
      } catch {
        // ignore
      }
    }
    setSelectedColumns(restored)
  }

  const handleToggleColumn = useCallback(
    (field: string) => {
      setSelectedColumns((prev) => {
        const next = prev.includes(field)
          ? prev.filter((f) => f !== field)
          : [...prev, field]
        try {
          localStorage.setItem(
            `app-log-columns-${appSlug || "default"}`,
            JSON.stringify(next)
          )
        } catch {
          // ignore
        }
        return next
      })
    },
    [appSlug]
  )

  const handleResetColumns = useCallback(() => {
    setSelectedColumns([])
    try {
      localStorage.removeItem(`app-log-columns-${appSlug || "default"}`)
    } catch {
      // ignore
    }
  }, [appSlug])

  const handleAddColumn = useCallback(
    (field: string) => {
      setSelectedColumns((prev) => {
        if (prev.includes(field)) return prev
        const next = [...prev, field]
        try {
          localStorage.setItem(
            `app-log-columns-${appSlug || "default"}`,
            JSON.stringify(next)
          )
        } catch {
          // ignore
        }
        return next
      })
    },
    [appSlug]
  )

  const activeLogs = propLogs ?? internalLogs
  const updateLogs = propSetLogs ?? setInternalLogs
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Dynamically discover all JSON fields across active logs
  const availableFields = useMemo(() => {
    return discoverLogFields(
      activeLogs as Array<
        { raw?: Record<string, unknown> } & Record<string, unknown>
      >
    )
  }, [activeLogs])

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
    if (logContainerRef.current && isLiveTailing) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
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
          <div className="flex items-center gap-2 sm:gap-3">
            <LogColumnPicker
              availableFields={availableFields}
              selectedColumns={selectedColumns}
              onToggleColumn={handleToggleColumn}
              onResetColumns={handleResetColumns}
            />

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
                className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
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

          {/* Structured Log Explorer Table (Datadog & Kibana style) */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div
              ref={logContainerRef}
              className="max-h-[520px] min-h-[240px] overflow-auto"
            >
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/70 text-[11px] backdrop-blur-xs">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="w-8 px-2" />
                    <TableHead className="w-24 font-semibold text-foreground">
                      Waktu
                    </TableHead>
                    <TableHead className="w-20 font-semibold text-foreground">
                      Level
                    </TableHead>
                    <TableHead className="w-24 font-semibold text-foreground">
                      Sumber
                    </TableHead>
                    {selectedColumns.map((col) => (
                      <TableHead
                        key={col}
                        className="font-mono text-[11px] font-semibold whitespace-nowrap text-foreground"
                      >
                        {col}
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold text-foreground">
                      Pesan / Ringkasan Log
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {isLoading && activeLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5 + selectedColumns.length}
                        className="h-48 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ArrowsClockwise
                            size={20}
                            className="animate-spin text-primary"
                          />
                          <p className="text-xs">
                            Memuat log dari OpenSearch cluster...
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5 + selectedColumns.length}
                        className="h-48 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2 p-8 font-sans text-xs font-medium text-muted-foreground/80">
                          <p>
                            Belum ada output log di OpenSearch untuk service
                            ini.
                          </p>
                          <p className="text-[11px] text-muted-foreground/60">
                            Pod mungkin sedang proses booting atau belum
                            menghasilkan output stdout/stderr.
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
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const levelBadgeStyle =
                        log.level === "ERROR"
                          ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                          : log.level === "WARN"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"

                      const rawEntry =
                        (log as NormalizedLogEntry).raw ??
                        (log as Record<string, unknown>)

                      return (
                        <TableRow
                          key={idx}
                          onClick={() => setSelectedLog(log)}
                          className="group cursor-pointer border-b border-border/60 transition-colors select-text hover:bg-muted/40"
                        >
                          <TableCell className="w-8 px-2 text-muted-foreground group-hover:text-foreground">
                            <CaretRight
                              size={12}
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </TableCell>
                          <TableCell className="w-24 font-mono text-[11px] font-medium whitespace-nowrap text-muted-foreground">
                            {log.timestamp}
                          </TableCell>
                          <TableCell className="w-20">
                            <span
                              className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${levelBadgeStyle}`}
                            >
                              {log.level}
                            </span>
                          </TableCell>
                          <TableCell className="w-24 max-w-[120px] truncate font-mono text-[11px] text-muted-foreground">
                            [{log.source}]
                          </TableCell>
                          {selectedColumns.map((col) => {
                            const val = getNestedValue(rawEntry, col)
                            return (
                              <TableCell
                                key={col}
                                className="max-w-[160px] truncate font-mono text-[11px] whitespace-nowrap text-foreground/80"
                              >
                                {formatAttributeValue(val)}
                              </TableCell>
                            )
                          })}
                          <TableCell className="font-mono text-[11px] leading-relaxed break-all text-foreground">
                            {log.message}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <LogInspectorDrawer
        log={selectedLog}
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null)
        }}
        selectedColumns={selectedColumns}
        onAddColumn={handleAddColumn}
        onApplyFilter={(text) => {
          setLogFilterQuery(text)
        }}
      />
    </div>
  )
}
