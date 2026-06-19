"use client"

import { useEffect, useState } from "react"
import {
  Cpu,
  HardDrive,
  Pulse,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TabMetricsProps = {
  cpuLimit?: string
  memLimit?: string
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
        // clamp around cpuUsageValue * 1000 (340)
        const next = Math.max(280, Math.min(420, Math.round(last + delta)))
        return [...prev.slice(1), next]
      })

      setRamHistory((prev) => {
        const last = prev[prev.length - 1]
        const delta = (Math.random() - 0.5) * 8
        // clamp around memoryUsageValue / mib (468)
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
    <div className="grid gap-6 md:grid-cols-3">
      {/* Real-time telemetry */}
      <Card
        size="sm"
        className="col-span-2 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-white">
            Live Resource Monitoring
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Track CPU, RAM, and Network HTTP traffic in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CPU Telemetry Card */}
          <div className="space-y-3.5 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-white">
                <Cpu size={16} className="text-emerald-400" /> CPU Allocation
              </span>
              <span className="font-mono text-xs font-semibold text-white/95">
                {cpuUsage} / {cpuLimit}{" "}
                <span className="text-emerald-400">({cpuPercent}%)</span>
              </span>
            </div>

            {/* Sparkline chart */}
            <div className="relative h-[70px] w-full overflow-hidden rounded-lg border border-white/[0.04] bg-neutral-950/50 p-1">
              <svg
                className="h-full w-full"
                viewBox="0 0 400 70"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
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
          <div className="space-y-3.5 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-white">
                <HardDrive size={16} className="text-red-400" /> RAM Allocation
              </span>
              <span className="font-mono text-xs font-semibold text-white/95">
                {memoryUsage} / {memLimit}{" "}
                <span className="text-red-400">({memoryPercent}%)</span>
              </span>
            </div>

            {/* Sparkline chart */}
            <div className="relative h-[70px] w-full overflow-hidden rounded-lg border border-white/[0.04] bg-neutral-950/50 p-1">
              <svg
                className="h-full w-full"
                viewBox="0 0 400 70"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
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
          <div className="space-y-3.5 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-white">
                <Pulse size={16} className="text-purple-400" /> Network Ingress
              </span>
              <span className="font-mono text-xs font-semibold text-white/95">
                {networkHistory[networkHistory.length - 1]} rps{" "}
                <span className="text-purple-400">(Normal)</span>
              </span>
            </div>

            {/* Sparkline chart */}
            <div className="relative h-[70px] w-full overflow-hidden rounded-lg border border-white/[0.04] bg-neutral-950/50 p-1">
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
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
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
        className="col-span-1 h-fit border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md"
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <Warning size={18} className="text-amber-500" /> Resource Advisory
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Analytics recommendations based on historic metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs leading-relaxed">
          <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-red-300">
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
              <Warning size={14} /> ⚠️ Low RAM Headroom
            </span>
            <p className="pt-0.5 text-xs leading-relaxed text-red-200/90">
              Your app is utilizing{" "}
              <strong>{memoryPercent}% of allocated RAM</strong> (
              {formatMemoryValue(memoryUsageValue)} of{" "}
              {formatMemoryValue(memoryLimitValue)}). Under load, pods will
              suffer OOMKilled restarts.
            </p>
            <p className="rounded-lg border border-red-500/10 bg-black/60 p-3 font-mono text-[10px] leading-relaxed font-semibold text-white">
              Recommendation: Scale Memory Limit to 1024MiB (1GiB) in the Tuning
              tab.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-300">
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
              <CheckCircle size={14} /> CPU Headroom Adequate
            </span>
            <p className="pt-0.5 text-xs leading-relaxed text-emerald-200/90">
              CPU usage is steady at {cpuPercent}% (
              {formatCoreValue(cpuUsageValue)} of{" "}
              {formatCoreValue(cpuLimitValue)} cores). Limit provides adequate
              buffer.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
