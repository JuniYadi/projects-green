"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowDown,
  ArrowsClockwise,
  ArrowsInSimple,
  ArrowsOutSimple,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [granularity, setGranularity] = useState<
    "daily" | "monthly" | "yearly"
  >("daily")
  const [targetDate, setTargetDate] = useState("")
  const [targetMonth, setTargetMonth] = useState("")
  const [targetYear, setTargetYear] = useState("")

  // State for collapsible analytics section (log-first baby UX)
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

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
  const [sourceFilter, setSourceFilter] = useState("ALL")
  const [isLiveTailing, setIsLiveTailing] = useState(true)
  const [isLoading, setIsLoading] = useState(Boolean(appSlug))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedLog, setSelectedLog] = useState<
    NormalizedLogEntry | LogMessage | null
  >(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

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

  // Extract unique sources for noise reduction filtering
  const availableSources = useMemo(() => {
    const sources = new Set<string>()
    for (const log of activeLogs) {
      if (log.source && log.source.trim().length > 0) {
        sources.add(log.source.trim())
      }
    }
    return Array.from(sources).sort()
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

  // Polling for fallback mode
  useEffect(() => {
    if (appSlug || !isLiveTailing || diagnosticMode === "production") return

    const interval = setInterval(() => {
      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`

      const dynamicPool = [
        {
          timestamp: timeStr,
          level: "INFO" as const,
          source: "app",
          message: `Worker heartbeat processed job: tick-${Date.now().toString().slice(-4)}`,
        },
        {
          timestamp: timeStr,
          level: "INFO" as const,
          source: "nginx",
          message: `GET /api/v1/health 200 OK (${Math.floor(Math.random() * 40 + 10)}ms)`,
        },
      ]

      const randomLog =
        dynamicPool[Math.floor(Math.random() * dynamicPool.length)]
      if (randomLog) {
        updateLogs((prev) => [...prev, randomLog])
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [appSlug, isLiveTailing, diagnosticMode, updateLogs])

  // Filter logs by query, level, and source
  const errorCount = useMemo(() => {
    return activeLogs.filter((l) => l.level === "ERROR").length
  }, [activeLogs])

  const filteredLogs = useMemo(() => {
    return activeLogs.filter((log) => {
      const matchQuery =
        log.message.toLowerCase().includes(logFilterQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(logFilterQuery.toLowerCase())
      const matchLevel =
        logFilterLevel === "ALL" || log.level === logFilterLevel
      const matchSource = sourceFilter === "ALL" || log.source === sourceFilter
      return matchQuery && matchLevel && matchSource
    })
  }, [activeLogs, logFilterQuery, logFilterLevel, sourceFilter])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, safeCurrentPage, pageSize])

  const startIndex = (safeCurrentPage - 1) * pageSize + 1
  const endIndex = Math.min(safeCurrentPage * pageSize, filteredLogs.length)

  const handleJumpToLatest = () => {
    setCurrentPage(totalPages)
    requestAnimationFrame(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* 1. Compact Health & Quick Status Bar (Log-First Layout) */}
      {appSlug && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {healthReport ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1 text-xs">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        healthReport.healthScore >= 90
                          ? "bg-emerald-500"
                          : healthReport.healthScore >= 70
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                    />
                    <span className="font-semibold text-foreground">
                      {messages.pDeployOperateTabLogs.stabilityStatusLabel}:{" "}
                      {healthReport.healthScore}%
                    </span>
                    <span className="text-muted-foreground">
                      ({healthReport.periodLabel})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1 text-xs">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        healthReport.errorCount > 0
                          ? "bg-red-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    <span className="font-semibold text-foreground">
                      {messages.pDeployOperateTabLogs.errorsTodayLabel}:{" "}
                      {healthReport.errorCount}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {messages.pDeployOperateTabLogs.appHealthReportDescription}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setIsAnalyticsExpanded((prev) => !prev)}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChartBar size={13} />
              <span>
                {isAnalyticsExpanded
                  ? messages.pDeployOperateTabLogs.toggleAnalyticsHide
                  : messages.pDeployOperateTabLogs.toggleAnalyticsShow}
              </span>
              {isAnalyticsExpanded ? (
                <CaretUp size={11} />
              ) : (
                <CaretDown size={11} />
              )}
            </Button>
          </div>

          {/* Collapsible expanded analytics section */}
          {isAnalyticsExpanded && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {messages.pDeployOperateTabLogs.appHealthReportTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {messages.pDeployOperateTabLogs.appHealthReportDescription}
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
                      {messages.pDeployOperateTabLogs.granularityDaily}
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
                      {messages.pDeployOperateTabLogs.granularityMonthly}
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
                      {messages.pDeployOperateTabLogs.granularityYearly}
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
                      placeholder={
                        messages.pDeployOperateTabLogs.yearPlaceholder
                      }
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
                      setCurrentPage(1)
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Primary Log Explorer Console */}
      <Card
        className={`rounded-xl border border-border bg-card shadow-sm transition-all ${
          isFullscreen
            ? "fixed inset-0 z-50 flex h-full w-full flex-col rounded-none border-none p-4 sm:p-6"
            : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold text-foreground">
              {messages.pDeployOperateTabLogs.opensearchLogViewerTitle}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {messages.pDeployOperateTabLogs.opensearchLogViewerDescription}
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
                <span>{messages.pDeployOperateTabLogs.refreshButton}</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={
                isFullscreen
                  ? messages.pDeployOperateTabLogs.fullscreenExit
                  : messages.pDeployOperateTabLogs.fullscreenEnter
              }
              className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {isFullscreen ? (
                <ArrowsInSimple size={13} />
              ) : (
                <ArrowsOutSimple size={13} />
              )}
            </Button>

            <span
              className="cursor-pointer text-xs text-muted-foreground select-none"
              onClick={() => setIsLiveTailing(!isLiveTailing)}
            >
              {messages.pDeployOperateTabLogs.liveTailToggleLabel}
            </span>
            <Switch
              checked={isLiveTailing}
              onCheckedChange={setIsLiveTailing}
              aria-label={messages.pDeployOperateTabLogs.liveTailAriaLabel}
            />
          </div>
        </CardHeader>
        <CardContent
          className={`space-y-3 ${isFullscreen ? "flex flex-1 flex-col overflow-hidden" : ""}`}
        >
          {/* Search, Level & Source Filter bar */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3.5 py-2 text-xs dark:bg-black/40">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlass
                size={14}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="text"
                placeholder={
                  messages.pDeployOperateTabLogs.searchLogsPlaceholder
                }
                value={logFilterQuery}
                onChange={(e) => {
                  setLogFilterQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-8 rounded-lg pl-9 text-xs"
              />
            </div>

            {/* Level filters */}
            <div className="flex gap-1">
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
                    aria-label={lvl}
                    onClick={() => {
                      setLogFilterLevel(lvl)
                      setCurrentPage(1)
                    }}
                    variant={isActive ? "default" : "outline"}
                    size="xs"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                    <span>{lvl}</span>
                    {lvl === "ERROR" && errorCount > 0 && (
                      <span className="py-0.2 ml-0.5 rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-500 dark:text-red-400">
                        {errorCount}
                      </span>
                    )}
                  </Button>
                )
              })}
            </div>

            {/* Source filter dropdown/pills if multiple sources exist */}
            {availableSources.length > 1 && (
              <div className="flex items-center gap-1.5 border-l border-border pl-2">
                <span className="text-[11px] text-muted-foreground">
                  {messages.pDeployOperateTabLogs.sourceFilterLabel}:
                </span>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden"
                >
                  <option value="ALL">
                    {messages.pDeployOperateTabLogs.sourceFilterAll}
                  </option>
                  {availableSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Structured Log Explorer Table */}
          <div
            className={`overflow-hidden rounded-xl border border-border bg-card shadow-xs ${
              isFullscreen ? "flex flex-1 flex-col" : ""
            }`}
          >
            <div
              ref={logContainerRef}
              className={`overflow-auto ${
                isFullscreen ? "flex-1" : "max-h-[580px] min-h-[280px]"
              }`}
            >
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/70 text-[11px] backdrop-blur-xs">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="w-8 px-2" />
                    <TableHead className="w-24 font-semibold text-foreground">
                      {messages.pDeployOperateTabLogs.colTime}
                    </TableHead>
                    <TableHead className="w-20 font-semibold text-foreground">
                      {messages.pDeployOperateTabLogs.colLevel}
                    </TableHead>
                    <TableHead className="w-24 font-semibold text-foreground">
                      {messages.pDeployOperateTabLogs.colSource}
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
                      {messages.pDeployOperateTabLogs.colMessage}
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
                            {messages.pDeployOperateTabLogs.loadingLogs}
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
                          <p>{messages.pDeployOperateTabLogs.emptyLogsTitle}</p>
                          <p className="text-[11px] text-muted-foreground/60">
                            {messages.pDeployOperateTabLogs.emptyLogsSubtitle}
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
                            {messages.pDeployOperateTabLogs.recheckButton}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLogs.map((log, idx) => {
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

            {/* Pagination Controls Bar */}
            {filteredLogs.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/15 px-4 py-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    {messages.pDeployOperateTabLogs.paginationShowing
                      .replace("{from}", String(startIndex))
                      .replace("{to}", String(endIndex))
                      .replace("{total}", String(filteredLogs.length))}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {messages.pDeployOperateTabLogs.paginationRowsPerPage}
                    </span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:outline-hidden"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleJumpToLatest}
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                    title={messages.pDeployOperateTabLogs.jumpToLatest}
                  >
                    <ArrowDown size={12} />
                    <span>{messages.pDeployOperateTabLogs.jumpToLatest}</span>
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={safeCurrentPage <= 1}
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      className="h-7 px-2"
                      aria-label={messages.pDeployOperateTabLogs.paginationPrev}
                    >
                      <CaretLeft size={12} />
                    </Button>

                    <span className="px-2 text-xs font-medium text-foreground">
                      {messages.pDeployOperateTabLogs.paginationPageOf
                        .replace("{page}", String(safeCurrentPage))
                        .replace("{totalPages}", String(totalPages))}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      className="h-7 px-2"
                      aria-label={messages.pDeployOperateTabLogs.paginationNext}
                    >
                      <CaretRight size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
          setCurrentPage(1)
        }}
      />
    </div>
  )
}
