"use client"

import { Cpu, HardDrive, Pulse, Warning } from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TabMetricsProps = {
  cpuLimit: string
  memLimit: string
}

export function TabMetrics({
  cpuLimit = "1000m",
  memLimit = "512Mi",
}: TabMetricsProps) {
  const cpuUsage = "340m"
  const memoryUsage = "468MiB"
  const cpuUsageValue = Number.parseFloat(cpuUsage.replace(/[^0-9.]/g, ""))
  const cpuLimitValue = Number.parseFloat(cpuLimit.replace(/[^0-9.]/g, ""))
  const memoryUsageValue = Number.parseFloat(
    memoryUsage.replace(/[^0-9.]/g, "")
  )
  const memoryLimitValue = Number.parseFloat(memLimit.replace(/[^0-9.]/g, ""))
  const cpuPercent =
    Number.isFinite(cpuUsageValue) &&
    Number.isFinite(cpuLimitValue) &&
    cpuLimitValue > 0
      ? Math.round((cpuUsageValue / cpuLimitValue) * 100)
      : 0
  const memoryPercent =
    Number.isFinite(memoryUsageValue) &&
    Number.isFinite(memoryLimitValue) &&
    memoryLimitValue > 0
      ? Math.round((memoryUsageValue / memoryLimitValue) * 100)
      : 0

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Real-time telemetry */}
      <Card className="col-span-2 border-white/[0.06] bg-black/25">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">
            Live Resource Monitoring
          </CardTitle>
          <CardDescription>
            Track CPU, RAM, and Network HTTP traffic in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CPU usage bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-white">
                <Cpu size={14} className="text-primary" /> CPU Allocation
              </span>
              <span className="font-mono text-muted-foreground">
                {cpuUsage} / {cpuLimit} ({cpuPercent}%)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-white/[0.08] bg-neutral-900 p-0.5">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: `${cpuPercent}%` }}
              />
            </div>
          </div>

          {/* RAM usage bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-white">
                <HardDrive size={14} className="text-primary" /> RAM Allocation
              </span>
              <span className="font-mono text-muted-foreground">
                {memoryUsage} / {memLimit} ({memoryPercent}%)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-white/[0.08] bg-neutral-900 p-0.5">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-1000"
                style={{ width: `${memoryPercent}%` }}
              />
            </div>
          </div>

          {/* Traffic usage bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-white">
                <Pulse size={14} className="text-primary" /> Network Ingress
                Requests
              </span>
              <span className="font-mono text-muted-foreground">
                242 requests/sec (Normal)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-white/[0.08] bg-neutral-900 p-0.5">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-1000"
                style={{ width: "65%" }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations / warnings (Q7 Answer) */}
      <Card className="border-white/[0.06] bg-black/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base font-bold text-white">
            <Warning size={18} className="text-yellow-500" /> Resource Advisory
          </CardTitle>
          <CardDescription>
            Analytics recommendations based on historic metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs leading-relaxed">
          <div className="space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-red-300">
            <span className="block font-bold tracking-wider uppercase">
              ⚠️ Low RAM Headroom
            </span>
            <p>
              Your app is utilizing <strong>91% of allocated RAM</strong>{" "}
              (468MiB of 512MiB). This triggers warning signals. Under load,
              pods will suffer OOMKilled restarts.
            </p>
            <p className="rounded border border-white/5 bg-black/40 p-2 font-mono text-[10px] font-semibold text-white">
              Recommendation: Scale your Memory Limit to 1024MiB (1GiB) in the
              &apos;Autoscaling &amp; Tuning&apos; tab.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-green-300">
            <span className="block font-bold tracking-wider uppercase">
              ✓ CPU Headroom Adequate
            </span>
            <p>
              CPU usage is steady at 34% (340m cores). The allocated 1.0 core
              limit provides plenty of buffer for routing requests.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
