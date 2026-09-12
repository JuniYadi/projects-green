"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowsClockwise,
  Cpu,
  FileText,
  GitBranch,
  Pulse,
  TerminalWindow,
  WarningCircle,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import type {
  ClusterBuildsDTO,
  ClusterDeploymentsDTO,
  ClusterHealthDTO,
  ClusterLogsDTO,
  ClusterMetricsDTO,
  ClusterProviderStateDTO,
} from "@/modules/deploy/cluster-operations.dto"

type ClusterOperationsTabsProps = {
  clusterId: string
  activeTab: string
}

type OperationView = "health" | "logs" | "deployments" | "builds" | "metrics"

type OperationData =
  | ClusterHealthDTO
  | ClusterLogsDTO
  | ClusterDeploymentsDTO
  | ClusterBuildsDTO
  | ClusterMetricsDTO

const operationTabs: Array<{
  value: OperationView
  label: string
  icon: typeof Cpu
}> = [
  { value: "health", label: "Health", icon: Cpu },
  { value: "logs", label: "Logs", icon: FileText },
  { value: "deployments", label: "Deployments", icon: GitBranch },
  { value: "builds", label: "Builds", icon: TerminalWindow },
  { value: "metrics", label: "Metrics", icon: Pulse },
]

const stateLabel: Record<ClusterProviderStateDTO["state"], string> = {
  live: "Live",
  empty: "Empty",
  stale: "Stale",
  unavailable: "Unavailable",
  forbidden: "Forbidden",
  configuration_only: "Configuration only",
}

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

function ProviderStateBadge({ state }: { state: ClusterProviderStateDTO }) {
  return (
    <Badge variant={stateVariant(state.state)} className="text-[10px]">
      {stateLabel[state.state]}
    </Badge>
  )
}

function ProviderStatePanel({
  state,
  onRetry,
}: {
  state: ClusterProviderStateDTO
  onRetry: () => void
}) {
  const message = state.message ?? "No additional provider details."
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
            <ProviderStateBadge state={state} />
            {state.source && (
              <span className="text-muted-foreground">
                Source: {state.source}
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">{message}</p>
          {state.observedAt && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Observed {formatTimestamp(state.observedAt)}
              {state.staleAfter
                ? ` · stale after ${formatTimestamp(state.staleAfter)}`
                : ""}
            </p>
          )}
        </div>
      </div>
      {state.retryable && state.state !== "live" && (
        <Button type="button" size="xs" variant="outline" onClick={onRetry}>
          <ArrowsClockwise size={13} className="mr-1" />
          Retry
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
}: ClusterOperationsTabsProps) {
  const [data, setData] = useState<OperationData | null>(null)
  const [dataView, setDataView] = useState<OperationView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [logSource, setLogSource] = useState<"all" | "application" | "http">(
    "all"
  )
  const [debouncedLogQuery, setDebouncedLogQuery] = useState("")
  const [logQuery, setLogQuery] = useState("")
  const [logLevel, setLogLevel] = useState("ALL")
  const [logService, setLogService] = useState("ALL")
  const [metricsRange, setMetricsRange] = useState<"1h" | "6h" | "24h">("1h")
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
          throw new Error(payload?.message ?? "Unable to load provider data.")
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
              : "Unable to load provider data."
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
    debouncedLogQuery,
    logService,
    logSource,
    metricsRange,
    retry,
    view,
  ])

  const retryView = () => setRetry((value) => value + 1)
  const provider = data && "provider" in data ? data.provider : null

  return (
    <>
      <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
        {operationTabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="gap-1.5 px-3 py-1.5"
          >
            <Icon size={15} /> {label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="settings" className="gap-1.5 px-3 py-1.5">
          Settings
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
                Loading provider data…
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
                Retry
              </Button>
            </div>
          )}
          {activeTab === value &&
            !loading &&
            !error &&
            dataView === view &&
            data &&
            renderView(view, data, {
              logSource,
              logQuery,
              logLevel,
              logService,
              metricsRange,
              onLogSourceChange: setLogSource,
              onLogQueryChange: setLogQuery,
              onLogLevelChange: setLogLevel,
              onLogServiceChange: setLogService,
              onMetricsRangeChange: setMetricsRange,
              onRetry: retryView,
            })}
          {activeTab === value &&
            !loading &&
            !error &&
            !data &&
            provider === null && (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No provider data has been requested yet.
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
  metricsRange: "1h" | "6h" | "24h"
  onLogSourceChange: (value: "all" | "application" | "http") => void
  onLogQueryChange: (value: string) => void
  onLogLevelChange: (value: string) => void
  onLogServiceChange: (value: string) => void
  onMetricsRangeChange: (value: "1h" | "6h" | "24h") => void
  onRetry: () => void
}

function renderView(
  view: OperationView,
  data: OperationData,
  controls: ViewControls
) {
  if (view === "health")
    return (
      <HealthView data={data as ClusterHealthDTO} onRetry={controls.onRetry} />
    )
  if (view === "logs")
    return <LogsView data={data as ClusterLogsDTO} controls={controls} />
  if (view === "deployments")
    return (
      <DeploymentsView
        data={data as ClusterDeploymentsDTO}
        onRetry={controls.onRetry}
      />
    )
  if (view === "builds")
    return (
      <BuildsView data={data as ClusterBuildsDTO} onRetry={controls.onRetry} />
    )
  return <MetricsView data={data as ClusterMetricsDTO} controls={controls} />
}

function HealthView({
  data,
  onRetry,
}: {
  data: ClusterHealthDTO
  onRetry: () => void
}) {
  return (
    <>
      <ProviderStatePanel state={data.provider} onRetry={onRetry} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Cluster status" value={data.status} />
        <MetricCard
          label="Nodes ready"
          value={formatCount(data.nodes.ready, data.nodes.total)}
        />
        <MetricCard
          label="Workloads ready"
          value={formatCount(data.workloads.ready, data.workloads.total)}
        />
        <MetricCard
          label="Recent deployment"
          value={data.recentDeployment?.status ?? "—"}
          detail={data.recentDeployment?.application}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider observations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.providers).map(([name, state]) => (
            <div key={name} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize">{name}</span>
                <ProviderStateBadge state={state} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {state.message ?? state.source ?? "No observation"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}

function LogsView({
  data,
  controls,
}: {
  data: ClusterLogsDTO
  controls: ViewControls
}) {
  const services = useMemo(
    () =>
      Array.from(
        new Set(data.entries.map((entry) => entry.service).filter(Boolean))
      ) as string[],
    [data.entries]
  )
  return (
    <>
      <ProviderStatePanel state={data.provider} onRetry={controls.onRetry} />
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Cluster logs</CardTitle>
              <p className="text-xs text-muted-foreground">
                {data.indexPatterns.join(" + ")} · {data.total} matching events
              </p>
            </div>
            <select
              aria-label="Log source"
              value={controls.logSource}
              onChange={(event) =>
                controls.onLogSourceChange(
                  event.target.value as ViewControls["logSource"]
                )
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">All logs</option>
              <option value="application">Application</option>
              <option value="http">HTTP traffic</option>
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input
              aria-label="Log text filter"
              placeholder="Search message, service, or route"
              value={controls.logQuery}
              onChange={(event) =>
                controls.onLogQueryChange(event.target.value)
              }
            />
            <select
              aria-label="Log severity"
              value={controls.logLevel}
              onChange={(event) =>
                controls.onLogLevelChange(event.target.value)
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="ALL">All severities</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>
            <select
              aria-label="Log service"
              value={controls.logService}
              onChange={(event) =>
                controls.onLogServiceChange(event.target.value)
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="ALL">All services</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {data.entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No logs found for the selected source and filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Route / status</th>
                    <th className="px-3 py-2">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="px-3 py-2">{entry.severity ?? "—"}</td>
                      <td className="px-3 py-2">{entry.service ?? "—"}</td>
                      <td className="px-3 py-2">
                        {entry.route ?? "—"}
                        {entry.status ? ` · ${entry.status}` : ""}
                      </td>
                      <td className="max-w-xl px-3 py-2">
                        {entry.message || "—"}
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

function DeploymentsView({
  data,
  onRetry,
}: {
  data: ClusterDeploymentsDTO
  onRetry: () => void
}) {
  return (
    <>
      <ProviderStatePanel state={data.provider} onRetry={onRetry} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Argo CD application state</CardTitle>
        </CardHeader>
        <CardContent>
          {data.deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No application deployments found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Application</th>
                    <th className="px-3 py-2">Sync</th>
                    <th className="px-3 py-2">Health</th>
                    <th className="px-3 py-2">Revision</th>
                    <th className="px-3 py-2">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.deployments.map((deployment) => (
                    <tr key={deployment.application}>
                      <td className="px-3 py-2 font-medium">
                        {deployment.application}
                      </td>
                      <td className="px-3 py-2">
                        {deployment.syncState ?? "—"}
                      </td>
                      <td className="px-3 py-2">{deployment.health ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">
                        {deployment.revision ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {deployment.failureReason ?? deployment.message ?? "—"}
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
  onRetry,
}: {
  data: ClusterBuildsDTO
  onRetry: () => void
}) {
  return (
    <>
      <ProviderStatePanel state={data.provider} onRetry={onRetry} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jenkins builds</CardTitle>
        </CardHeader>
        <CardContent>
          {data.builds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No builds found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Job</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Branch / commit</th>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Artifacts</th>
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
                        {build.branch ?? "—"}
                        {build.commit ? ` · ${build.commit}` : ""}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {build.startedAt
                          ? formatTimestamp(build.startedAt)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {build.artifactCount ?? "—"}
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

function MetricsView({
  data,
  controls,
}: {
  data: ClusterMetricsDTO
  controls: ViewControls
}) {
  return (
    <>
      <ProviderStatePanel state={data.provider} onRetry={controls.onRetry} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Prometheus metrics</CardTitle>
            <p className="text-xs text-muted-foreground">
              Provider samples only; missing series remain unavailable.
            </p>
          </div>
          <select
            aria-label="Metrics time range"
            value={controls.metricsRange}
            onChange={(event) =>
              controls.onMetricsRangeChange(
                event.target.value as ViewControls["metricsRange"]
              )
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
          </select>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.metrics.map((metric) => (
            <div
              key={metric.name}
              className="rounded-lg border border-border p-4"
            >
              <p className="text-xs text-muted-foreground">
                {metric.name.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatMetric(metric.value, metric.unit)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {metric.sampleAt
                  ? `Sample ${formatTimestamp(metric.sampleAt)}`
                  : "No sample"}
              </p>
            </div>
          ))}
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

function formatCount(ready: number | null, total: number | null): string {
  if (ready === null || total === null) return "—"
  return `${ready} / ${total}`
}
