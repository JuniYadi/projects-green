"use client"

import { Fragment, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Cpu,
  FileText,
  GitBranch,
  Pulse,
  TerminalWindow,
  WarningCircle,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import type { ClusterMessages } from "@/lib/i18n/messages/types"
import type {
  ClusterBuildsDTO,
  ClusterDeploymentsDTO,
  ClusterHealthDTO,
  ClusterLogsDTO,
  ClusterMetricDTO,
  ClusterMetricsDTO,
  ClusterProviderKey,
  ClusterProviderStateDTO,
} from "@/modules/deploy/cluster-operations.dto"

type ClusterOperationsTabsProps = {
  clusterId: string
  activeTab: string
  locale: string
  messages: ClusterMessages
  onTabChange: (tab: string) => void
}
type OperationView = "health" | "logs" | "deployments" | "builds" | "metrics"

type LogRange = "1h" | "6h" | "24h" | "all"

type OperationData =
  | ClusterHealthDTO
  | ClusterLogsDTO
  | ClusterDeploymentsDTO
  | ClusterBuildsDTO
  | ClusterMetricsDTO

const operationTabs: Array<{
  value: OperationView
  labelKey: keyof ClusterMessages["tabs"]
  icon: typeof Cpu
}> = [
  { value: "health", labelKey: "health", icon: Cpu },
  { value: "logs", labelKey: "logs", icon: FileText },
  { value: "deployments", labelKey: "deployments", icon: GitBranch },
  { value: "builds", labelKey: "builds", icon: TerminalWindow },
  { value: "metrics", labelKey: "metrics", icon: Pulse },
]

const PROVIDER_ORDER: ClusterProviderKey[] = [
  "kubernetes",
  "opensearch",
  "argocd",
  "jenkins",
  "prometheus",
]

const PROVIDER_TAB: Record<ClusterProviderKey, OperationView | "settings"> = {
  kubernetes: "settings",
  opensearch: "logs",
  argocd: "deployments",
  jenkins: "builds",
  prometheus: "metrics",
}

const METRIC_NAME_KEY: Record<
  string,
  keyof ClusterMessages["metrics"]["names"]
> = {
  request_rate: "requestRate",
  error_4xx_rate: "error4xxRate",
  error_5xx_rate: "error5xxRate",
  p95_latency: "p95Latency",
  cpu_usage: "cpuUsage",
  memory_usage: "memoryUsage",
  storage_utilization: "storageUtilization",
}

const TRAFFIC_METRICS = [
  "request_rate",
  "error_4xx_rate",
  "error_5xx_rate",
  "p95_latency",
]

const LOG_PAGE_SIZE = 100
/** The service clamps here too; the button must not promise more. */
const LOG_MAX_ROWS = 500

const RANGE_MINUTES: Record<"1h" | "6h" | "24h", number> = {
  "1h": 60,
  "6h": 360,
  "24h": 1440,
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  )

const stateVariant = (
  state: ClusterProviderStateDTO["state"]
):
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline" => {
  if (state === "live") return "success"
  if (state === "stale") return "warning"
  if (state === "unavailable" || state === "forbidden") return "destructive"
  if (state === "empty") return "secondary"
  return "outline"
}

const stateLabelOf = (
  messages: ClusterMessages,
  state: ClusterProviderStateDTO["state"]
): string =>
  state === "configuration_only"
    ? messages.providerState.configurationOnly
    : messages.providerState[state]

function ProviderStateBadge({
  state,
  messages,
}: {
  state: ClusterProviderStateDTO
  messages: ClusterMessages
}) {
  return (
    <Badge variant={stateVariant(state.state)} className="text-[10px]">
      {stateLabelOf(messages, state.state)}
    </Badge>
  )
}

function ProviderStatePanel({
  state,
  messages,
  onRetry,
}: {
  state: ClusterProviderStateDTO
  messages: ClusterMessages
  onRetry: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-3 text-xs">
      <div className="flex min-w-0 items-start gap-2">
        <WarningCircle
          size={16}
          className={
            state.state === "live"
              ? "mt-0.5 shrink-0 text-emerald-500"
              : "mt-0.5 shrink-0 text-muted-foreground"
          }
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ProviderStateBadge state={state} messages={messages} />
            {state.source && (
              <span className="text-muted-foreground">
                {messages.common.source}: {state.source}
              </span>
            )}
          </div>
          {["unavailable", "forbidden", "stale"].includes(state.state) &&
            state.message && (
              <p className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">
                  {messages.health.technicalDetail}:
                </span>{" "}
                {state.message}
              </p>
            )}
          {state.observedAt && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {fill(messages.common.observed, {
                time: formatTime(state.observedAt),
              })}
              {state.staleAfter
                ? ` · ${fill(messages.common.refreshDue, {
                    time: formatTime(state.staleAfter),
                  })}`
                : ""}
            </p>
          )}
        </div>
      </div>
      {state.retryable && state.state !== "live" && (
        <Button type="button" size="xs" variant="outline" onClick={onRetry}>
          <ArrowsClockwise size={13} className="mr-1" />
          {messages.common.retry}
        </Button>
      )}
    </div>
  )
}

const formatTimestamp = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const formatTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString()
}

const csvCell = (value: string | number | null): string =>
  value === null ? "" : `"${String(value).replaceAll('"', '""')}"`

/** Exports what is on screen, which is why the button sits by the row count. */
const exportLogsCsv = (entries: ClusterLogsDTO["entries"], source: string) => {
  const header = "timestamp,severity,service,namespace,route,status,message"
  const rows = entries.map((entry) =>
    [
      entry.timestamp,
      entry.severityLabel,
      entry.service,
      entry.namespace,
      entry.route,
      entry.status,
      entry.message,
    ]
      .map(csvCell)
      .join(",")
  )
  const blob = new Blob([[header, ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `cluster-logs-${source}-${new Date().toISOString().slice(0, 19)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const formatDuration = (ms: number | null): string => {
  if (ms === null) return "—"
  if (ms < 1000) return `${ms} ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

const formatMetric = (value: number | null, unit: string): string => {
  if (value === null) return "—"
  if (unit === "bytes") {
    const units = ["B", "KB", "MB", "GB", "TB"]
    let current = value
    let index = 0
    while (current >= 1024 && index < units.length - 1) {
      current /= 1024
      index += 1
    }
    return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[index]}`
  }
  if (unit === "percent") return `${value.toFixed(1)}%`
  if (unit === "seconds") return `${value.toFixed(3)} s`
  if (unit === "cores") return `${value.toFixed(2)} cores`
  if (unit === "requests/s") return `${value.toFixed(2)} req/s`
  return value.toFixed(2)
}
export function ClusterOperationsTabs({
  clusterId,
  activeTab,
  locale,
  messages,
  onTabChange,
}: ClusterOperationsTabsProps) {
  const [data, setData] = useState<OperationData | null>(null)
  const [dataView, setDataView] = useState<OperationView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  // Application is the only source with readable text on every document.
  const [logSource, setLogSource] = useState<"all" | "application" | "http">(
    "application"
  )
  const [debouncedLogQuery, setDebouncedLogQuery] = useState("")
  const [logQuery, setLogQuery] = useState("")
  const [logLevel, setLogLevel] = useState("ALL")
  const [logService, setLogService] = useState("ALL")
  const [logRange, setLogRange] = useState<LogRange>("1h")
  const [metricsRange, setMetricsRange] = useState<"1h" | "6h" | "24h">("1h")
  const [logLimit, setLogLimit] = useState(LOG_PAGE_SIZE)
  const view = operationTabs.some((tab) => tab.value === activeTab)
    ? (activeTab as OperationView)
    : "health"

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedLogQuery(logQuery), 300)
    return () => clearTimeout(timeout)
  }, [logQuery])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setData(null)
      setDataView(null)
      setError(null)
      const query =
        view === "logs"
          ? {
              source: logSource,
              ...(debouncedLogQuery.trim()
                ? { q: debouncedLogQuery.trim() }
                : {}),
              ...(logLevel !== "ALL" ? { level: logLevel } : {}),
              ...(logService !== "ALL" ? { service: logService } : {}),
              ...(logRange !== "all"
                ? { from: `now-${logRange}`, to: "now" }
                : {}),
              limit: logLimit,
            }
          : view === "metrics"
            ? { range: metricsRange }
            : {}
      try {
        const result = await eden.api.admin["app-hosting"].clusters[
          clusterId
        ].operations[view].get({ $query: query })
        const payload = result.data as
          { ok?: boolean; data?: OperationData; message?: string } | undefined
        if (result.error || !payload?.ok || !payload.data) {
          throw new Error(
            payload?.message ?? messages.settings.unableToLoadProviderData
          )
        }
        if (!cancelled) {
          setData(payload.data)
          setDataView(view)
        }
      } catch (cause) {
        if (!cancelled) {
          setData(null)
          setDataView(null)
          setError(
            cause instanceof Error
              ? cause.message
              : messages.settings.unableToLoadProviderData
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [
    clusterId,
    logLevel,
    logLimit,
    debouncedLogQuery,
    logRange,
    logService,
    logSource,
    metricsRange,
    messages.settings.unableToLoadProviderData,
    retry,
    view,
  ])

  const retryView = () => setRetry((value) => value + 1)
  const provider = data && "provider" in data ? data.provider : null

  const controls: ViewControls = {
    logSource,
    logQuery,
    logLevel,
    logService,
    logRange,
    logLimit,
    metricsRange,
    // A new filter is a new result set, so any extra pages no longer apply.
    onLogSourceChange: (value) => {
      setLogLimit(LOG_PAGE_SIZE)
      setLogSource(value)
    },
    onLogQueryChange: (value) => {
      setLogLimit(LOG_PAGE_SIZE)
      setLogQuery(value)
    },
    onLogLevelChange: (value) => {
      setLogLimit(LOG_PAGE_SIZE)
      setLogLevel(value)
    },
    onLogServiceChange: (value) => {
      setLogLimit(LOG_PAGE_SIZE)
      setLogService(value)
    },
    onLogRangeChange: (value) => {
      setLogLimit(LOG_PAGE_SIZE)
      setLogRange(value)
    },
    onLogLimitChange: setLogLimit,
    onMetricsRangeChange: setMetricsRange,
    onRetry: retryView,
    onTabChange,
  }

  return (
    <>
      <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
        {operationTabs.map(({ value, labelKey, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="gap-1.5 px-3 py-1.5"
          >
            <Icon size={15} /> {messages.tabs[labelKey]}
          </TabsTrigger>
        ))}
        <TabsTrigger value="settings" className="gap-1.5 px-3 py-1.5">
          {messages.tabs.settings}
        </TabsTrigger>
      </TabsList>

      {operationTabs.map(({ value }) => (
        <TabsContent
          key={value}
          value={value}
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          {loading && activeTab === value && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {messages.common.loading}
              </CardContent>
            </Card>
          )}
          {error && activeTab === value && (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              <span>{error}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={retryView}
              >
                {messages.common.retry}
              </Button>
            </div>
          )}
          {activeTab === value &&
            !loading &&
            !error &&
            dataView === view &&
            data &&
            renderView(view, data, messages, controls, locale)}

          {activeTab === value &&
            !loading &&
            !error &&
            !data &&
            provider === null && (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  {messages.common.loading}
                </CardContent>
              </Card>
            )}
        </TabsContent>
      ))}
    </>
  )
}

type ViewControls = {
  logSource: "all" | "application" | "http"
  logQuery: string
  logLevel: string
  logService: string
  logRange: LogRange
  logLimit: number
  metricsRange: "1h" | "6h" | "24h"
  onLogSourceChange: (value: "all" | "application" | "http") => void
  onLogQueryChange: (value: string) => void
  onLogLevelChange: (value: string) => void
  onLogServiceChange: (value: string) => void
  onLogRangeChange: (value: LogRange) => void
  onLogLimitChange: (value: number) => void
  onMetricsRangeChange: (value: "1h" | "6h" | "24h") => void
  onRetry: () => void
  onTabChange: (tab: string) => void
}

function renderView(
  view: OperationView,
  data: OperationData,
  messages: ClusterMessages,
  controls: ViewControls,
  locale: string
) {
  if (view === "health")
    return (
      <HealthView
        data={data as ClusterHealthDTO}
        messages={messages}
        controls={controls}
        locale={locale}
      />
    )
  if (view === "logs")
    return (
      <LogsView
        data={data as ClusterLogsDTO}
        messages={messages}
        controls={controls}
      />
    )
  if (view === "deployments")
    return (
      <DeploymentsView
        data={data as ClusterDeploymentsDTO}
        messages={messages}
        onRetry={controls.onRetry}
      />
    )
  if (view === "builds")
    return (
      <BuildsView
        data={data as ClusterBuildsDTO}
        messages={messages}
        onRetry={controls.onRetry}
      />
    )
  return (
    <MetricsView
      data={data as ClusterMetricsDTO}
      messages={messages}
      controls={controls}
    />
  )
}

function HealthView({
  data,
  messages,
  controls,
  locale,
}: {
  data: ClusterHealthDTO
  messages: ClusterMessages
  controls: ViewControls
  locale: string
}) {
  const liveCount = PROVIDER_ORDER.filter(
    (key) => data.providers[key].state === "live"
  ).length
  const liveCapabilities = PROVIDER_ORDER.filter(
    (key) => key !== "kubernetes" && data.providers[key].state === "live"
  ).map(
    (key) => messages.tabs[PROVIDER_TAB[key] as keyof ClusterMessages["tabs"]]
  )
  const capabilityList = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(liveCapabilities)

  if (data.status === "unknown") {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {messages.health.unknownHeading}
            </p>
            <p className="text-xs text-muted-foreground">
              {messages.health.unknownDescription}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => controls.onTabChange("settings")}
          >
            {messages.health.configureIntegrations}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const firstIssue = PROVIDER_ORDER.find((key) =>
    ["unavailable", "forbidden", "stale"].includes(data.providers[key].state)
  )
  const kubernetesTotalsDiffer =
    (data.nodes.total !== null && data.nodes.ready !== data.nodes.total) ||
    (data.workloads.total !== null &&
      data.workloads.ready !== data.workloads.total)
  const heroDetail =
    data.status === "unverified"
      ? messages.health.unverifiedDescription
      : data.status === "healthy"
        ? messages.health.healthyDescription
        : firstIssue
          ? fill(
              data.providers[firstIssue].state === "unavailable"
                ? messages.health.providerUnavailable
                : data.providers[firstIssue].state === "forbidden"
                  ? messages.health.providerForbidden
                  : messages.health.providerStale,
              { provider: messages.providerNames[firstIssue] }
            )
          : kubernetesTotalsDiffer
            ? messages.health.nodesOrWorkloadsNotReady
            : messages.health.healthyDescription
  const heroHeading =
    data.status === "unverified"
      ? messages.health.unverifiedHeading
      : data.status === "healthy"
        ? messages.health.healthyHeading
        : messages.health.heading

  return (
    <>
      <div
        className={
          data.status === "healthy"
            ? "rounded-lg border border-border bg-card/60 p-4"
            : "rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
        }
        role={data.status === "healthy" ? undefined : "status"}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">{heroHeading}</p>
            <p className="text-xs text-muted-foreground">{heroDetail}</p>
            {data.status === "unverified" && (
              <>
                <p className="text-xs text-muted-foreground">
                  {fill(messages.health.liveSummary, {
                    live: liveCount,
                    total: PROVIDER_ORDER.length,
                  })}
                </p>
                {capabilityList && (
                  <p className="text-xs text-muted-foreground">
                    {capabilityList}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data.status === "unverified" && (
              <Button
                type="button"
                size="xs"
                onClick={() => controls.onTabChange("settings")}
              >
                {messages.health.reviewKubernetes}
              </Button>
            )}
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={controls.onRetry}
            >
              <ArrowsClockwise size={13} className="mr-1" />
              {messages.common.refresh}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={messages.health.nodesReady}
          value={
            formatCount(data.nodes.ready, data.nodes.total) ??
            messages.common.unknown
          }
          detail={
            data.providers.kubernetes.state !== "live"
              ? messages.health.needsKubernetes
              : undefined
          }
        />
        <MetricCard
          label={messages.health.workloadsReady}
          value={
            formatCount(data.workloads.ready, data.workloads.total) ??
            messages.common.unknown
          }
          detail={
            data.providers.kubernetes.state !== "live"
              ? messages.health.needsKubernetes
              : undefined
          }
        />
        <MetricCard
          label={messages.health.lastDeployment}
          value={data.recentDeployment?.status ?? messages.common.none}
          detail={data.recentDeployment?.application}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.health.providerTable}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">
                    {messages.health.columnProvider}
                  </th>
                  <th className="px-3 py-2">{messages.health.columnState}</th>
                  <th className="px-3 py-2">{messages.health.columnPowers}</th>
                  <th className="px-3 py-2">
                    {messages.health.columnLastCheck}
                  </th>
                  <th className="px-3 py-2">{messages.health.columnAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PROVIDER_ORDER.map((key) => {
                  const state = data.providers[key]
                  const target = PROVIDER_TAB[key]
                  const showMessage =
                    state.state === "unavailable" || state.state === "forbidden"
                  return (
                    <tr key={key}>
                      <td className="px-3 py-2 font-medium">
                        <div>{messages.providerNames[key]}</div>
                        {showMessage && state.message && (
                          <p className="mt-1 text-[11px] font-normal text-destructive">
                            {state.message}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <ProviderStateBadge state={state} messages={messages} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {messages.providerPowers[key]}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {state.observedAt
                          ? formatTime(state.observedAt)
                          : messages.common.none}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => controls.onTabChange(target)}
                        >
                          {state.state === "live"
                            ? messages.common.view
                            : messages.common.configure}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function LogsView({
  data,
  messages,
  controls,
}: {
  data: ClusterLogsDTO
  messages: ClusterMessages
  controls: ViewControls
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const countTemplate = data.totalIsLowerBound
    ? messages.logs.showingAtLeast
    : messages.logs.showing
  return (
    <>
      <ProviderStatePanel
        state={data.provider}
        messages={messages}
        onRetry={controls.onRetry}
      />
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">{messages.logs.heading}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {fill(countTemplate, {
                  shown: data.entries.length,
                  total: data.total.toLocaleString(),
                  pattern: data.indexPatterns.join(" + "),
                })}
              </p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={data.entries.length === 0}
                onClick={() => exportLogsCsv(data.entries, data.source)}
              >
                {messages.common.export}
              </Button>
              {data.entries.length >= controls.logLimit &&
                controls.logLimit < LOG_MAX_ROWS && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      controls.onLogLimitChange(
                        Math.min(
                          LOG_MAX_ROWS,
                          controls.logLimit + LOG_PAGE_SIZE
                        )
                      )
                    }
                  >
                    {fill(messages.logs.loadMore, { count: LOG_PAGE_SIZE })}
                  </Button>
                )}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <select
              id="cluster-log-source"
              name="clusterLogSource"
              aria-label={messages.logs.sourceLabel}
              value={controls.logSource}
              onChange={(event) =>
                controls.onLogSourceChange(
                  event.target.value as ViewControls["logSource"]
                )
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="application">
                {messages.logs.sourceApplication}
              </option>
              <option value="http">{messages.logs.sourceHttp}</option>
              <option value="all">{messages.logs.sourceAll}</option>
            </select>
            <select
              id="cluster-log-range"
              name="clusterLogRange"
              aria-label={messages.logs.timeLabel}
              value={controls.logRange}
              onChange={(event) =>
                controls.onLogRangeChange(event.target.value as LogRange)
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="1h">{messages.logs.time1h}</option>
              <option value="6h">{messages.logs.time6h}</option>
              <option value="24h">{messages.logs.time24h}</option>
              <option value="all">{messages.logs.timeAll}</option>
            </select>
            <select
              id="cluster-log-level"
              name="clusterLogLevel"
              aria-label={messages.logs.levelLabel}
              value={controls.logLevel}
              onChange={(event) =>
                controls.onLogLevelChange(event.target.value)
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="ALL">{messages.logs.levelAll}</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>
            <select
              id="cluster-log-service"
              name="clusterLogService"
              aria-label={messages.logs.serviceLabel}
              value={controls.logService}
              onChange={(event) =>
                controls.onLogServiceChange(event.target.value)
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="ALL">{messages.logs.serviceAll}</option>
              {data.services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="cluster-log-search"
            name="clusterLogSearch"
            aria-label={messages.logs.searchPlaceholder}
            placeholder={messages.logs.searchPlaceholder}
            value={controls.logQuery}
            onChange={(event) => controls.onLogQueryChange(event.target.value)}
          />
        </CardHeader>
        <CardContent>
          {data.entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {messages.logs.empty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-6 px-2 py-2" />
                    <th className="px-3 py-2">{messages.logs.columnTime}</th>
                    <th className="px-3 py-2">{messages.logs.columnLevel}</th>
                    <th className="px-3 py-2">{messages.logs.columnService}</th>
                    <th className="px-3 py-2">{messages.logs.columnRoute}</th>
                    <th className="px-3 py-2">{messages.logs.columnMessage}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.entries.map((entry) => {
                    const open = expanded === entry.id
                    return (
                      <Fragment key={entry.id}>
                        <tr
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => setExpanded(open ? null : entry.id)}
                        >
                          <td className="px-2 py-2 text-muted-foreground">
                            <span
                              aria-label={
                                open
                                  ? messages.logs.collapse
                                  : messages.logs.expand
                              }
                            >
                              {open ? (
                                <CaretDown size={12} />
                              ) : (
                                <CaretRight size={12} />
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground">
                            {entry.timestamp
                              ? formatTime(entry.timestamp)
                              : messages.logs.noTimestamp}
                          </td>
                          <td className="px-3 py-2">
                            {entry.severityLabel ?? messages.common.none}
                          </td>
                          <td className="px-3 py-2">
                            {entry.service ?? messages.common.none}
                          </td>
                          <td className="px-3 py-2">
                            {entry.route ?? messages.common.none}
                            {entry.status ? ` · ${entry.status}` : ""}
                          </td>
                          <td className="max-w-xl truncate px-3 py-2">
                            {entry.message || messages.common.none}
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-muted/20">
                            <td />
                            <td colSpan={5} className="px-3 py-3">
                              <p className="text-[11px] text-muted-foreground">
                                {entry.timestamp
                                  ? formatTimestamp(entry.timestamp)
                                  : messages.logs.noTimestamp}
                                {entry.namespace
                                  ? ` · ${messages.logs.namespace}: ${entry.namespace}`
                                  : ""}
                                {entry.severity
                                  ? ` · ${messages.logs.columnLevel}: ${entry.severity}`
                                  : ""}
                              </p>
                              <pre className="mt-2 max-h-64 overflow-auto font-mono text-[11px] whitespace-pre-wrap">
                                {entry.message || messages.common.none}
                              </pre>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                className="mt-2"
                                onClick={() =>
                                  void navigator.clipboard.writeText(
                                    entry.message
                                  )
                                }
                              >
                                {messages.common.copy}
                              </Button>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function DeploymentsView({
  data,
  messages,
  onRetry,
}: {
  data: ClusterDeploymentsDTO
  messages: ClusterMessages
  onRetry: () => void
}) {
  return (
    <>
      <ProviderStatePanel
        state={data.provider}
        messages={messages}
        onRetry={onRetry}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.deployments.heading}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {messages.deployments.empty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">
                      {messages.deployments.columnApplication}
                    </th>
                    <th className="px-3 py-2">
                      {messages.deployments.columnSync}
                    </th>
                    <th className="px-3 py-2">
                      {messages.deployments.columnHealth}
                    </th>
                    <th className="px-3 py-2">
                      {messages.deployments.columnRevision}
                    </th>
                    <th className="px-3 py-2">
                      {messages.deployments.columnObserved}
                    </th>
                    <th className="px-3 py-2">
                      {messages.deployments.columnMessage}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.deployments.map((deployment) => (
                    <tr key={deployment.application}>
                      <td className="px-3 py-2 font-medium">
                        {deployment.application}
                      </td>
                      <td className="px-3 py-2">
                        {deployment.syncState ?? messages.common.none}
                      </td>
                      <td className="px-3 py-2">
                        {deployment.health ?? messages.common.none}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {deployment.revision?.slice(0, 10) ??
                          messages.common.none}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {deployment.observedAt
                          ? formatTimestamp(deployment.observedAt)
                          : messages.common.none}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {deployment.failureReason ??
                          deployment.message ??
                          messages.common.none}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function BuildsView({
  data,
  messages,
  onRetry,
}: {
  data: ClusterBuildsDTO
  messages: ClusterMessages
  onRetry: () => void
}) {
  return (
    <>
      <ProviderStatePanel
        state={data.provider}
        messages={messages}
        onRetry={onRetry}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data.scope === "cluster"
              ? messages.builds.heading
              : messages.builds.headingUnfiltered}
          </CardTitle>
          {data.scopeFilter && (
            <p className="text-xs text-muted-foreground">
              {fill(messages.builds.scopeFiltered, {
                filter: data.scopeFilter,
              })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {data.builds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {messages.builds.empty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{messages.builds.columnJob}</th>
                    <th className="px-3 py-2">
                      {messages.builds.columnStatus}
                    </th>
                    <th className="px-3 py-2">
                      {messages.builds.columnBranch}
                    </th>
                    <th className="px-3 py-2">
                      {messages.builds.columnStarted}
                    </th>
                    <th className="px-3 py-2">
                      {messages.builds.columnDuration}
                    </th>
                    <th className="px-3 py-2">
                      {messages.builds.columnArtifacts}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.builds.map((build) => (
                    <tr key={`${build.job}-${build.startedAt ?? "none"}`}>
                      <td className="px-3 py-2 font-medium">
                        {build.url ? (
                          <a
                            className="underline"
                            href={build.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {build.job}
                          </a>
                        ) : (
                          build.job
                        )}
                      </td>
                      <td className="px-3 py-2">{build.status}</td>
                      <td className="px-3 py-2 font-mono">
                        {build.branch ?? messages.common.none}
                        {build.commit ? ` · ${build.commit.slice(0, 10)}` : ""}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {build.startedAt
                          ? formatTimestamp(build.startedAt)
                          : messages.common.none}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDuration(build.durationMs)}
                      </td>
                      <td className="px-3 py-2">
                        {build.artifactCount ?? messages.common.none}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/** Inline sparkline; a chart library would be a lot of bytes for 60 points. */
function Sparkline({ series }: { series: Array<[number, number]> }) {
  if (series.length < 2) return null
  const values = series.map(([, value]) => value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = series
    .map(([, value], index) => {
      const x = (index / (series.length - 1)) * 100
      const y = 24 - ((value - min) / span) * 22
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className="mt-2 h-6 w-full text-muted-foreground"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function MetricTile({
  metric,
  messages,
  range,
  onConfigure,
}: {
  metric: ClusterMetricDTO
  messages: ClusterMessages
  range: "1h" | "6h" | "24h"
  onConfigure: () => void
}) {
  const nameKey = METRIC_NAME_KEY[metric.name]
  const label = nameKey
    ? messages.metrics.names[nameKey]
    : metric.name.replaceAll("_", " ")
  if (metric.value === null) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 text-xl font-semibold text-muted-foreground">
          {messages.metrics.noSeries}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {fill(messages.metrics.notExported, {
            metric: metric.missingSeries[0] ?? metric.name,
          })}
        </p>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="mt-2"
          onClick={onConfigure}
        >
          {messages.metrics.setMetricNames}
        </Button>
      </div>
    )
  }
  const percent =
    metric.capacity && metric.capacity > 0
      ? Math.round((metric.value / metric.capacity) * 100)
      : null
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">
        {formatMetric(metric.value, metric.unit)}
        {metric.capacity !== null && (
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            {fill(messages.metrics.ofCapacity, {
              capacity: formatMetric(metric.capacity, metric.unit),
            })}
            {percent !== null ? ` · ${percent}%` : ""}
          </span>
        )}
      </p>
      <Sparkline series={metric.series} />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {fill(messages.metrics.window, { minutes: RANGE_MINUTES[range] })}
        {metric.sampleAt
          ? ` · ${fill(messages.metrics.sampledAt, {
              time: formatTime(metric.sampleAt),
            })}`
          : ""}
      </p>
    </div>
  )
}

function MetricsView({
  data,
  messages,
  controls,
}: {
  data: ClusterMetricsDTO
  messages: ClusterMessages
  controls: ViewControls
}) {
  const traffic = data.metrics.filter((metric) =>
    TRAFFIC_METRICS.includes(metric.name)
  )
  const capacity = data.metrics.filter(
    (metric) => !TRAFFIC_METRICS.includes(metric.name)
  )
  const openSettings = () => controls.onTabChange("settings")
  return (
    <>
      <ProviderStatePanel
        state={data.provider}
        messages={messages}
        onRetry={controls.onRetry}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {messages.metrics.heading}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {fill(messages.health.seriesFound, {
                found: data.seriesFound,
                total: data.seriesTotal,
              })}
            </p>
          </div>
          <select
            id="cluster-metrics-range"
            name="clusterMetricsRange"
            aria-label={messages.metrics.rangeLabel}
            value={controls.metricsRange}
            onChange={(event) =>
              controls.onMetricsRangeChange(
                event.target.value as ViewControls["metricsRange"]
              )
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="1h">{messages.metrics.range1h}</option>
            <option value="6h">{messages.metrics.range6h}</option>
            <option value="24h">{messages.metrics.range24h}</option>
          </select>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {messages.metrics.groupTraffic}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {traffic.map((metric) => (
                <MetricTile
                  key={metric.name}
                  metric={metric}
                  messages={messages}
                  range={data.range}
                  onConfigure={openSettings}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {messages.metrics.groupCapacity}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capacity.map((metric) => (
                <MetricTile
                  key={metric.name}
                  metric={metric}
                  messages={messages}
                  range={data.range}
                  onConfigure={openSettings}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {detail && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {detail}
        </p>
      )}
    </Card>
  )
}

function formatCount(
  ready: number | null,
  total: number | null
): string | null {
  if (ready === null || total === null) return null
  return `${ready} / ${total}`
}
