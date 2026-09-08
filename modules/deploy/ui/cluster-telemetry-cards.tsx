"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Cpu, HardDrive, ArrowsLeftRight, Globe } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { eden } from "@/lib/eden"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  TimeRangeDropdown,
  type AutoRefreshInterval,
} from "@/components/telemetry/time-range-dropdown"
import {
  generateClusterTelemetrySummary,
  formatBytes,
  formatCores,
  formatThroughput,
} from "@/modules/deploy/telemetry.service"
import type { ClusterTelemetrySummary } from "@/modules/deploy/telemetry.types"
import {
  ClusterTelemetrySparkline,
  type SparklineDataPoint,
} from "@/modules/deploy/ui/cluster-telemetry-sparkline"
import {
  type TimeRangeSelection,
  format24hTime,
  PRESET_SECONDS,
  formatTelemetryTick,
} from "@/lib/time-range"
export type ClusterTelemetryCardsProps = {
  clusterCode?: string
  appSlug?: string
  title?: string
  columns?: 1 | 3 | "auto"
  chartHeight?: number
  showPodBreakdown?: boolean
  className?: string
}

export function ClusterTelemetryCards({
  clusterCode = "sgp",
  appSlug,
  title,
  columns = "auto",
  chartHeight,
  showPodBreakdown = false,
  className,
}: ClusterTelemetryCardsProps = {}) {
  const [timeSelection, setTimeSelection] = useState<TimeRangeSelection>({
    type: "preset",
    preset: "1h",
  })
  const [refreshInterval, setRefreshInterval] =
    useState<AutoRefreshInterval>(30_000)

  const userTimeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC"

  const {
    data: telemetry = generateClusterTelemetrySummary("1h"),
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery<ClusterTelemetrySummary>({
    queryKey: [
      "deploy",
      "telemetry",
      timeSelection,
      clusterCode,
      userTimeZone,
      appSlug,
    ],
    queryFn: async () => {
      const queryParams =
        timeSelection.type === "preset"
          ? {
              range: timeSelection.preset,
              cluster: clusterCode,
              tz: userTimeZone,
              ...(appSlug ? { appSlug } : {}),
            }
          : {
              from: String(timeSelection.from),
              to: String(timeSelection.to),
              cluster: clusterCode,
              tz: userTimeZone,
              ...(appSlug ? { appSlug } : {}),
            }
      const { data: payload } = await eden.api.deploy.telemetry.get({
        $query: queryParams,
      })
      if (!payload || !payload.ok || !payload.data) {
        throw new Error(payload?.message ?? "Unable to load cluster telemetry")
      }
      return payload.data
    },
    placeholderData: (previousData) =>
      previousData ?? generateClusterTelemetrySummary("1h"),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  const isLive = dataUpdatedAt > 0
  const lastUpdated =
    dataUpdatedAt > 0
      ? format24hTime(dataUpdatedAt, {
          showSeconds: true,
          timeZone: userTimeZone,
        })
      : null

  const formatPointLabel = (timestamp: string): string => {
    const num = Number(timestamp)
    if (!Number.isNaN(num) && Number.isFinite(num) && num > 0) {
      const unixSec = num > 1e11 ? Math.floor(num / 1000) : Math.floor(num)
      const durationSeconds =
        timeSelection.type === "preset"
          ? (PRESET_SECONDS[timeSelection.preset] ?? 3600)
          : Math.max(0, timeSelection.to - timeSelection.from)
      return formatTelemetryTick(unixSec, durationSeconds, userTimeZone)
    }
    const parsed = Date.parse(timestamp)
    if (
      !Number.isNaN(parsed) &&
      (timestamp.includes("T") || timestamp.includes("-"))
    ) {
      const unixSec = Math.floor(parsed / 1000)
      const durationSeconds =
        timeSelection.type === "preset"
          ? (PRESET_SECONDS[timeSelection.preset] ?? 3600)
          : Math.max(0, timeSelection.to - timeSelection.from)
      return formatTelemetryTick(unixSec, durationSeconds, userTimeZone)
    }
    return timestamp
  }
  const cpuDataPoints: SparklineDataPoint[] = telemetry.points.map((p) => ({
    label: formatPointLabel(p.timestamp),
    value: p.cpuUsageCores,
    limit: p.cpuLimitCores,
  }))

  // Map Memory data to sparkline points (in GB) so Limit line (4 GB) and scale match
  const memoryDataPoints: SparklineDataPoint[] = telemetry.points.map((p) => ({
    label: formatPointLabel(p.timestamp),
    value: Number((p.memoryUsageBytes / (1024 * 1024 * 1024)).toFixed(2)),
    limit: Number((p.memoryLimitBytes / (1024 * 1024 * 1024)).toFixed(1)),
  }))

  // Auto-scale Network units: B/s, KB/s, or MB/s
  const maxNetBytes = Math.max(
    ...telemetry.points.map((p) =>
      Math.max(p.networkRxBytesPerSec, p.networkTxBytesPerSec)
    ),
    1
  )
  const netUnit =
    maxNetBytes >= 1024 * 1024 ? "MB/s" : maxNetBytes >= 1024 ? "KB/s" : "B/s"
  const netDivisor =
    netUnit === "MB/s" ? 1024 * 1024 : netUnit === "KB/s" ? 1024 : 1

  const networkDataPoints: SparklineDataPoint[] = telemetry.points.map((p) => ({
    label: formatPointLabel(p.timestamp),
    value: Number(
      (p.networkRxBytesPerSec / netDivisor).toFixed(netUnit === "B/s" ? 0 : 1)
    ),
    secondaryValue: Number(
      (p.networkTxBytesPerSec / netDivisor).toFixed(netUnit === "B/s" ? 0 : 1)
    ),
  }))
  const isSingleCol = columns === 1
  const effectiveHeight = chartHeight ?? (isSingleCol ? 125 : 85)
  const gridClass = isSingleCol
    ? "grid gap-4 grid-cols-1"
    : "grid gap-4 md:grid-cols-3"

  const cpuPercent = (
    (telemetry.cpu.currentCores / telemetry.cpu.limitCores) *
    100
  ).toFixed(1)

  const memoryPercent = (
    (telemetry.memory.currentBytes / telemetry.memory.limitBytes) *
    100
  ).toFixed(1)

  return (
    <div className={cn("space-y-3", className)}>
      {isError && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-500"
          data-testid="telemetry-fallback-banner"
        >
          <span>
            Live Prometheus metrics unreachable. Displaying fallback telemetry.
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="font-medium underline hover:text-amber-400"
          >
            Retry
          </button>
        </div>
      )}
      {/* Cluster Context & Time Range Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {title ??
              (appSlug
                ? "Workload Resource Telemetry"
                : "Cluster Resource Telemetry")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <Globe size={13} className="text-emerald-500" />
            <span>Singapore</span>
            <span className="size-1 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-emerald-400/80">Primary</span>
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span>LIVE</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TimeRangeDropdown
            value={timeSelection}
            onChange={setTimeSelection}
            onRefresh={() => void refetch()}
            isFetching={isFetching}
            refreshInterval={refreshInterval}
            onRefreshIntervalChange={setRefreshInterval}
          />

          {lastUpdated && (
            <span className="hidden font-mono text-[11px] text-muted-foreground lg:inline">
              {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* 3 Telemetry Cards Grid */}
      <div className={gridClass}>
        {/* Card 1: CPU Utilization */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Cpu size={14} className="text-primary" />
                CPU Utilization
              </span>
              <span className="text-xs font-bold text-foreground">
                {cpuPercent}%
              </span>
            </div>
            <CardTitle className="text-lg font-bold tracking-tight">
              {formatCores(telemetry.cpu.currentCores)}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / {formatCores(telemetry.cpu.limitCores)} Limit
              </span>
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Peak: {formatCores(telemetry.cpu.peakCores)} &bull; Avg:{" "}
              {formatCores(telemetry.cpu.avgCores)}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ClusterTelemetrySparkline
              data={cpuDataPoints}
              unit="vCPU"
              color="#10b981"
              height={effectiveHeight}
              showArea={true}
              showLimitLine={true}
            />
          </CardContent>
        </Card>

        {/* Card 2: Memory Allocation */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <HardDrive size={14} className="text-primary" />
                Memory Utilization
              </span>
              <span className="text-xs font-bold text-foreground">
                {memoryPercent}%
              </span>
            </div>
            <CardTitle className="text-lg font-bold tracking-tight">
              {formatBytes(telemetry.memory.currentBytes)}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / {formatBytes(telemetry.memory.limitBytes)} Limit
              </span>
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Peak: {formatBytes(telemetry.memory.peakBytes)} &bull; Avg:{" "}
              {formatBytes(telemetry.memory.avgBytes)}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ClusterTelemetrySparkline
              data={memoryDataPoints}
              unit="GB"
              color="#10b981"
              height={effectiveHeight}
              showArea={true}
              showLimitLine={true}
            />
          </CardContent>
        </Card>

        {/* Card 3: Network I/O Bandwidth */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowsLeftRight size={14} className="text-sky-400" />
                Network I/O Throughput
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" /> Rx
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-sky-400">
                  <span className="size-1.5 rounded-full bg-sky-400" /> Tx
                </span>
              </div>
            </div>
            <CardTitle className="text-lg font-bold tracking-tight">
              <span className="text-emerald-400">
                ▲ {formatThroughput(telemetry.network.currentRxBytes)}
              </span>
              <span className="mx-1.5 text-sm text-muted-foreground">
                &bull;
              </span>
              <span className="text-sky-400">
                ▼ {formatThroughput(telemetry.network.currentTxBytes)}
              </span>
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Total In: {formatBytes(telemetry.network.totalRxBytes)} &bull;
              Total Out: {formatBytes(telemetry.network.totalTxBytes)}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ClusterTelemetrySparkline
              data={networkDataPoints}
              unit={netUnit}
              color="#10b981"
              secondaryColor="#38bdf8"
              height={effectiveHeight}
              showArea={false}
              showLimitLine={false}
            />
          </CardContent>
        </Card>
      </div>

      {/* Pod Quota & Health Table Breakdown */}
      {showPodBreakdown && telemetry.pods && telemetry.pods.length > 0 && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="space-y-1 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Pod Resource &amp; Quota Allocation
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Live per-pod compute consumption and restart count
                </CardDescription>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {telemetry.pods.length}{" "}
                {telemetry.pods.length === 1 ? "pod" : "pods"} active
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Pod</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">CPU Usage</th>
                    <th className="px-3.5 py-2.5">Memory Usage</th>
                    <th className="px-3.5 py-2.5 text-right">Restarts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {telemetry.pods.map((pod) => (
                    <tr key={pod.pod} className="hover:bg-muted/30">
                      <td className="px-3.5 py-3 font-mono text-xs font-semibold text-foreground">
                        {pod.pod}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          {pod.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                            <span>{pod.cpuUsageCores.toFixed(3)} cores</span>
                            <span className="text-muted-foreground">
                              {pod.cpuPercent}% of {pod.cpuLimitCores} Limit
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{
                                width: `${Math.min(100, pod.cpuPercent)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                            <span>{formatBytes(pod.memoryUsageBytes)}</span>
                            <span className="text-muted-foreground">
                              {pod.memoryPercent}% of{" "}
                              {formatBytes(pod.memoryLimitBytes)} Limit
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full transition-all",
                                pod.memoryPercent > 85
                                  ? "bg-destructive"
                                  : "bg-emerald-500"
                              )}
                              style={{
                                width: `${Math.min(100, pod.memoryPercent)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-xs">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                            pod.restarts > 0
                              ? "border border-amber-500/30 bg-amber-500/10 text-amber-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {pod.restarts}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
