"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Cpu,
  HardDrive,
  ArrowsLeftRight,
  Globe,
  Clock,
  ArrowsClockwise,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

type TimeRangeOption = "1h" | "6h" | "24h" | "7d"
export function ClusterTelemetryCards() {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("1h")

  const {
    data: telemetry = generateClusterTelemetrySummary(timeRange),
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery<ClusterTelemetrySummary>({
    queryKey: ["deploy", "telemetry", timeRange, "sgp"],
    queryFn: async () => {
      const { data: payload } = await eden.api.deploy.telemetry.get({
        $query: { range: timeRange, cluster: "sgp" },
      })
      if (!payload || !payload.ok || !payload.data) {
        throw new Error(payload?.message ?? "Unable to load cluster telemetry")
      }
      return payload.data
    },
    placeholderData: (previousData) =>
      previousData?.timeRange === timeRange
        ? previousData
        : generateClusterTelemetrySummary(timeRange),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  })

  const isLive = dataUpdatedAt > 0
  const lastUpdated =
    dataUpdatedAt > 0
      ? new Date(dataUpdatedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null

  const handleRefresh = () => {
    void refetch()
  }
  const cpuDataPoints: SparklineDataPoint[] = telemetry.points.map((p) => ({
    label: p.timestamp,
    value: p.cpuUsageCores,
    limit: p.cpuLimitCores,
  }))

  // Map Memory data to sparkline points (in GB)
  const memoryDataPoints: SparklineDataPoint[] = telemetry.points.map((p) => ({
    label: p.timestamp,
    value: Number((p.memoryUsageBytes / (1024 * 1024 * 1024)).toFixed(2)),
    limit: Number((p.memoryLimitBytes / (1024 * 1024 * 1024)).toFixed(2)),
  }))

  // Map Network data to dual-line sparkline points (in MB/s)
  const networkDataPoints: SparklineDataPoint[] = telemetry.points.map((p) => ({
    label: p.timestamp,
    value: Number((p.networkRxBytesPerSec / (1024 * 1024)).toFixed(2)),
    secondaryValue: Number((p.networkTxBytesPerSec / (1024 * 1024)).toFixed(2)),
  }))

  const cpuPercent = (
    (telemetry.cpu.currentCores / telemetry.cpu.limitCores) *
    100
  ).toFixed(1)

  const memoryPercent = (
    (telemetry.memory.currentBytes / telemetry.memory.limitBytes) *
    100
  ).toFixed(1)

  return (
    <div className="space-y-3">
      {/* Cluster Context & Time Range Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Cluster Resource Telemetry
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <Globe size={13} className="text-emerald-500" />
            <span>{telemetry.region}</span>
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
          <div className="flex items-center gap-1">
            <Clock size={13} className="mr-1 text-muted-foreground" />
            <span className="mr-1 text-xs text-muted-foreground">Range:</span>
            {(["1h", "6h", "24h", "7d"] as const).map((r) => (
              <Button
                key={r}
                variant={timeRange === r ? "default" : "outline"}
                size="xs"
                onClick={() => setTimeRange(r)}
                className="h-6 px-2 text-[11px]"
              >
                {r}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="xs"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-6 gap-1 px-2 text-[11px]"
            title="Refresh cluster telemetry"
          >
            <ArrowsClockwise
              size={12}
              className={
                isFetching
                  ? "animate-spin text-primary"
                  : "text-muted-foreground"
              }
            />
            <span>Refresh</span>
          </Button>

          {lastUpdated && (
            <span className="hidden text-[11px] text-muted-foreground lg:inline">
              {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* 3 Telemetry Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
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
              height={85}
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
              height={85}
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
              unit="MB/s"
              color="#10b981"
              secondaryColor="#38bdf8"
              height={85}
              showArea={false}
              showLimitLine={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
