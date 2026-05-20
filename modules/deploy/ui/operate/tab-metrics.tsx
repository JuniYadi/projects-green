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
            <div className="flex justify-between items-center text-xs">
              <span className="text-white font-medium flex items-center gap-1.5">
                <Cpu size={14} className="text-primary" /> CPU Allocation
              </span>
              <span className="font-mono text-muted-foreground">
                340m / {cpuLimit} (34%)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-neutral-900 border border-white/[0.08] p-0.5">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: "34%" }}
              />
            </div>
          </div>

          {/* RAM usage bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white font-medium flex items-center gap-1.5">
                <HardDrive size={14} className="text-primary" /> RAM Allocation
              </span>
              <span className="font-mono text-muted-foreground">
                468MiB / {memLimit} (91%)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-neutral-900 border border-white/[0.08] p-0.5">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-1000"
                style={{ width: "91%" }}
              />
            </div>
          </div>

          {/* Traffic usage bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white font-medium flex items-center gap-1.5">
                <Pulse size={14} className="text-primary" /> Network Ingress
                Requests
              </span>
              <span className="font-mono text-muted-foreground">
                242 requests/sec (Normal)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-neutral-900 border border-white/[0.08] p-0.5">
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
          <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
            <Warning size={18} className="text-yellow-500" /> Resource Advisory
          </CardTitle>
          <CardDescription>
            Analytics recommendations based on historic metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs leading-relaxed">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-red-300 space-y-2">
            <span className="font-bold uppercase tracking-wider block">
              ⚠️ Low RAM Headroom
            </span>
            <p>
              Your app is utilizing <strong>91% of allocated RAM</strong>{" "}
              (468MiB of 512MiB). This triggers warning signals. Under load,
              pods will suffer OOMKilled restarts.
            </p>
            <p className="font-semibold text-white bg-black/40 p-2 rounded border border-white/5 font-mono text-[10px]">
              Recommendation: Scale your Memory Limit to 1024MiB (1GiB) in the
              &apos;Autoscaling &amp; Tuning&apos; tab.
            </p>
          </div>

          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-green-300 space-y-2">
            <span className="font-bold uppercase tracking-wider block">
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
