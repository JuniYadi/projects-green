"use client"

import { useEffect, useState } from "react"
import {
  ArrowsLeftRight,
  CheckCircle,
  Cpu,
  HardDrive,
  Pulse,
  Timer,
  Warning,
} from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d"

type TabMetricsProps = {
  cpuLimit?: string
  memLimit?: string
}

type RangeMetrics = {
  latency: {
    p50: string
    p95: string
    p99: string
  }
  http: {
    totalRequests: string
    status2xx: { count: string; percent: string }
    status4xx: { count: string; percent: string }
    status5xx: { count: string; percent: string }
  }
}

const TIME_RANGE_OPTIONS: {
  value: TimeRange
  label: string
  badge?: string
}[] = [
  { value: "1h", label: "1h", badge: "Live" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
]

const METRICS_BY_RANGE: Record<TimeRange, RangeMetrics> = {
  "1h": {
    latency: { p50: "42ms", p95: "128ms", p99: "210ms" },
    http: {
      totalRequests: "142.8k requests",
      status2xx: { count: "140.8k", percent: "98.6%" },
      status4xx: { count: "1.6k", percent: "1.1%" },
      status5xx: { count: "428", percent: "0.3%" },
    },
  },
  "6h": {
    latency: { p50: "45ms", p95: "135ms", p99: "225ms" },
    http: {
      totalRequests: "842.1k requests",
      status2xx: { count: "829.5k", percent: "98.5%" },
      status4xx: { count: "10.1k", percent: "1.2%" },
      status5xx: { count: "2.5k", percent: "0.3%" },
    },
  },
  "24h": {
    latency: { p50: "48ms", p95: "142ms", p99: "240ms" },
    http: {
      totalRequests: "3.24M requests",
      status2xx: { count: "3.19M", percent: "98.4%" },
      status4xx: { count: "42.1k", percent: "1.3%" },
      status5xx: { count: "9.7k", percent: "0.3%" },
    },
  },
  "7d": {
    latency: { p50: "52ms", p95: "158ms", p99: "275ms" },
    http: {
      totalRequests: "21.8M requests",
      status2xx: { count: "21.4M", percent: "98.2%" },
      status4xx: { count: "327k", percent: "1.5%" },
      status5xx: { count: "65.4k", percent: "0.3%" },
    },
  },
  "30d": {
    latency: { p50: "55ms", p95: "165ms", p99: "290ms" },
    http: {
      totalRequests: "89.4M requests",
      status2xx: { count: "87.6M", percent: "98.0%" },
      status4xx: { count: "1.52M", percent: "1.7%" },
      status5xx: { count: "268k", percent: "0.3%" },
    },
  },
}

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

const parseCpuToCores = (value: string) => {
  const normalized = value.trim().toLowerCase()
  const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(numeric)) {
    return 0
  }
  return normalized.endsWith("m") ? numeric / 1000 : numeric
}

const parseMemoryToBytes = (value: string) => {
  const normalized = value.trim().toLowerCase()
  const match = normalized.match(/^([0-9]*\.?[0-9]+)\s*([a-z]+)?$/)
  if (!match) {
    return 0
  }

  const numeric = Number.parseFloat(match[1])
  if (!Number.isFinite(numeric)) {
    return 0
  }

  const unit = (match[2] ?? "b").replace(/b$/, "")
  const factors: Record<string, number> = {
    "": 1,
    k: 1_000,
    m: 1_000_000,
    g: 1_000_000_000,
    t: 1_000_000_000_000,
    ki: 1024,
    mi: 1024 ** 2,
    gi: 1024 ** 3,
    ti: 1024 ** 4,
  }

  const factor = factors[unit]
  if (!factor) {
    return 0
  }

  return numeric * factor
}

const formatCoreValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0"
  }
  return value >= 1 ? value.toFixed(1) : value.toFixed(2)
}

const formatMemoryValue = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MiB"
  }

  const gib = 1024 ** 3
  const mib = 1024 ** 2
  if (bytes >= gib) {
    return `${(bytes / gib).toFixed(2)} GiB`
  }

  return `${(bytes / mib).toFixed(0)} MiB`
}

export function TabMetrics({
  cpuLimit = "1000m",
  memLimit = "512Mi",
}: TabMetricsProps) {
  const [timeRange, setTimeRange] = useState<
    "1h" | "6h" | "24h" | "7d" | "30d"
  >("1h")
  const currentMetrics = METRICS_BY_RANGE[timeRange]

  const cpuUsage = "340m"
  const memoryUsage = "468MiB"

  const cpuUsageValue = parseCpuToCores(cpuUsage)
  const cpuLimitValue = parseCpuToCores(cpuLimit)
  const memoryUsageValue = parseMemoryToBytes(memoryUsage)
  const memoryLimitValue = parseMemoryToBytes(memLimit)

  const cpuPercent =
    cpuLimitValue > 0 ? clampPercent((cpuUsageValue / cpuLimitValue) * 100) : 0
  const memoryPercent =
    memoryLimitValue > 0
      ? clampPercent((memoryUsageValue / memoryLimitValue) * 100)
      : 0

  // Real-time telemetry sliding values (15 points)
  const [cpuHistory, setCpuHistory] = useState<number[]>([
    320, 340, 310, 350, 330, 360, 340, 330, 350, 340, 335, 345, 340, 338, 340,
  ])
  const [ramHistory, setRamHistory] = useState<number[]>([
    450, 455, 460, 458, 462, 465, 468, 467, 468, 466, 469, 468, 470, 468, 468,
  ])
  const [networkHistory, setNetworkHistory] = useState<number[]>([
    210, 230, 245, 220, 215, 250, 240, 235, 242, 240, 244, 238, 245, 241, 242,
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuHistory((prev) => {
        const last = prev[prev.length - 1]
        const delta = (Math.random() - 0.5) * 30
        const next = Math.max(280, Math.min(420, Math.round(last + delta)))
        return [...prev.slice(1), next]
      })

      setRamHistory((prev) => {
        const last = prev[prev.length - 1]
        const delta = (Math.random() - 0.5) * 8
        const next = Math.max(450, Math.min(485, Math.round(last + delta)))
        return [...prev.slice(1), next]
      })

      setNetworkHistory((prev) => {
        const last = prev[prev.length - 1]
        const delta = (Math.random() - 0.5) * 25
        const next = Math.max(180, Math.min(310, Math.round(last + delta)))
        return [...prev.slice(1), next]
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const generateSvgPath = (
    points: number[],
    width: number,
    height: number,
    min: number,
    max: number
  ) => {
    if (points.length === 0) return ""
    const xStep = width / (points.length - 1)
    const range = max - min || 1
    return points
      .map((val, i) => {
        const x = i * xStep
        const y = height - ((val - min) / range) * height
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(" ")
  }

  const generateAreaPath = (
    points: number[],
    width: number,
    height: number,
    min: number,
    max: number
  ) => {
    if (points.length === 0) return ""
    const path = generateSvgPath(points, width, height, min, max)
    return `${path} L ${width} ${height} L 0 ${height} Z`
  }

  return (
    <div className="space-y-6">
      {/* Metrics Header Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Live Telemetry & Observability
          </h3>
          <p className="text-xs text-muted-foreground">
            Track real-time resources, latency percentiles, and traffic
            distribution
          </p>
        </div>
        <div
          className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-1"
          role="tablist"
          aria-label="Time range"
        >
          {TIME_RANGE_OPTIONS.map((option) => {
            const isActive = timeRange === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTimeRange(option.value)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span>{option.label}</span>
                {option.badge ? (
                  <span
                    className={cn(
                      "rounded px-1 text-[10px] leading-tight font-semibold",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    ({option.badge})
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Real-time telemetry */}
        <Card
          size="sm"
          className="col-span-2 border-border bg-card shadow-xl backdrop-blur-md"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Live Resource Monitoring
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Track CPU, RAM, and Network HTTP traffic in real-time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* CPU Telemetry Card */}
            <div className="space-y-3.5 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Cpu size={16} className="text-emerald-400" /> CPU Allocation
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {cpuUsage} / {cpuLimit}{" "}
                  <span className="text-emerald-400">({cpuPercent}%)</span>
                </span>
              </div>

              {/* Sparkline chart */}
              <div className="relative h-[70px] w-full overflow-hidden rounded-lg border border-border bg-muted/10 p-1">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 400 70"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="cpuGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#10b981"
                        stopOpacity="0.25"
                      />
                      <stop
                        offset="100%"
                        stopColor="#10b981"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d={generateAreaPath(cpuHistory, 400, 70, 0, 1000)}
                    fill="url(#cpuGradient)"
                  />
                  <path
                    d={generateSvgPath(cpuHistory, 400, 70, 0, 1000)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="flex justify-between pt-0.5 text-[10px] font-medium text-muted-foreground">
                <span>0% request</span>
                <span>Limit: {cpuLimit}</span>
              </div>
            </div>

            {/* RAM Telemetry Card */}
            <div className="space-y-3.5 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <HardDrive size={16} className="text-red-400" /> RAM
                  Allocation
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {memoryUsage} / {memLimit}{" "}
                  <span className="text-red-400">({memoryPercent}%)</span>
                </span>
              </div>

              {/* Sparkline chart */}
              <div className="relative h-[70px] w-full overflow-hidden rounded-lg border border-border bg-muted/10 p-1">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 400 70"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="ramGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#f43f5e"
                        stopOpacity="0.25"
                      />
                      <stop
                        offset="100%"
                        stopColor="#f43f5e"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d={generateAreaPath(ramHistory, 400, 70, 0, 1024)}
                    fill="url(#ramGradient)"
                  />
                  <path
                    d={generateSvgPath(ramHistory, 400, 70, 0, 1024)}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="flex justify-between pt-0.5 text-[10px] font-medium text-muted-foreground">
                <span>0 MB request</span>
                <span>Limit: {memLimit}</span>
              </div>
            </div>

            {/* Network Ingress Telemetry Card */}
            <div className="space-y-3.5 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Pulse size={16} className="text-purple-400" /> Network
                  Ingress
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {networkHistory[networkHistory.length - 1]} rps{" "}
                  <span className="text-purple-400">(Normal)</span>
                </span>
              </div>

              {/* Sparkline chart */}
              <div className="relative h-[70px] w-full overflow-hidden rounded-lg border border-border bg-muted/10 p-1">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 400 70"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="networkGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#c084fc"
                        stopOpacity="0.25"
                      />
                      <stop
                        offset="100%"
                        stopColor="#c084fc"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d={generateAreaPath(networkHistory, 400, 70, 0, 500)}
                    fill="url(#networkGradient)"
                  />
                  <path
                    d={generateSvgPath(networkHistory, 400, 70, 0, 500)}
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="flex justify-between pt-0.5 text-[10px] font-medium text-muted-foreground">
                <span>0 rps</span>
                <span>Max Capacity: 1000 rps</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations / warnings */}
        <Card
          size="sm"
          className="col-span-1 h-fit border-border bg-card shadow-xl backdrop-blur-md"
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Warning size={18} className="text-amber-500" /> Resource Advisory
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Analytics recommendations based on historic metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs leading-relaxed">
            <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-destructive uppercase">
                <Warning size={14} /> Low RAM Headroom
              </span>
              <p className="pt-0.5 text-xs leading-relaxed text-foreground">
                Your app is utilizing{" "}
                <strong>{memoryPercent}% of allocated RAM</strong> (
                {formatMemoryValue(memoryUsageValue)} of{" "}
                {formatMemoryValue(memoryLimitValue)}). Under load, pods will
                suffer OOMKilled restarts.
              </p>
              <p className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed font-semibold text-foreground">
                Recommendation: Scale Memory Limit to 1024MiB (1GiB) in the
                Tuning tab.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                <CheckCircle size={14} /> CPU Headroom Adequate
              </span>
              <p className="pt-0.5 text-xs leading-relaxed text-foreground">
                CPU usage is steady at {cpuPercent}% (
                {formatCoreValue(cpuUsageValue)} of{" "}
                {formatCoreValue(cpuLimitValue)} cores). Limit provides adequate
                buffer.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deep-dive Observability Cards: Latency & Traffic Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Latency Percentiles Card */}
        <Card
          size="sm"
          className="border-border bg-card shadow-xl backdrop-blur-md"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Timer size={18} className="text-primary" /> Latency Percentiles
              </CardTitle>
              <span className="font-mono text-xs text-muted-foreground">
                Window: {timeRange}
              </span>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              End-to-end response latency distribution across percentiles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {/* p50 Median */}
              <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    p50 Median
                  </span>
                  <span className="inline-flex rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Fast
                  </span>
                </div>
                <p className="font-mono text-xl font-bold text-foreground">
                  {currentMetrics.latency.p50}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  50% of requests faster
                </p>
              </div>

              {/* p95 Threshold */}
              <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    p95 Threshold
                  </span>
                  <span className="inline-flex rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Expected
                  </span>
                </div>
                <p className="font-mono text-xl font-bold text-foreground">
                  {currentMetrics.latency.p95}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  95% within SLO target
                </p>
              </div>

              {/* p99 Tail Latency */}
              <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    p99 Tail Latency
                  </span>
                  <span className="inline-flex rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    Tail
                  </span>
                </div>
                <p className="font-mono text-xl font-bold text-foreground">
                  {currentMetrics.latency.p99}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  1% slowest outlier
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/10 p-3 text-[11px] text-muted-foreground">
              Response times measured at edge gateway before reverse-proxy
              ingress.
            </div>
          </CardContent>
        </Card>

        {/* HTTP Status & Error Rate Distribution Card */}
        <Card
          size="sm"
          className="border-border bg-card shadow-xl backdrop-blur-md"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <ArrowsLeftRight size={18} className="text-primary" /> HTTP
                Status & Error Rate
              </CardTitle>
              <span className="font-mono text-xs font-semibold text-foreground">
                {currentMetrics.http.totalRequests}
              </span>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Traffic volume, client errors, and server fault breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Requests</span>
                <span className="font-mono font-semibold text-foreground">
                  {currentMetrics.http.totalRequests}
                </span>
              </div>

              {/* Status breakdown bar */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: currentMetrics.http.status2xx.percent }}
                  title={`2xx: ${currentMetrics.http.status2xx.percent}`}
                />
                <div
                  className="bg-amber-500 transition-all duration-300"
                  style={{ width: currentMetrics.http.status4xx.percent }}
                  title={`4xx: ${currentMetrics.http.status4xx.percent}`}
                />
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: currentMetrics.http.status5xx.percent }}
                  title={`5xx: ${currentMetrics.http.status5xx.percent}`}
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* 2xx Successful */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  2xx Successful ({currentMetrics.http.status2xx.percent})
                </span>
                <span className="font-mono text-muted-foreground">
                  {currentMetrics.http.status2xx.count} reqs
                </span>
              </div>

              {/* 4xx Client Errors */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  4xx Client Errors ({currentMetrics.http.status4xx.percent})
                </span>
                <span className="font-mono text-muted-foreground">
                  {currentMetrics.http.status4xx.count} reqs
                </span>
              </div>

              {/* 5xx Server Errors */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  5xx Server Errors ({currentMetrics.http.status5xx.percent})
                </span>
                <span className="font-mono text-muted-foreground">
                  {currentMetrics.http.status5xx.count} reqs
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
