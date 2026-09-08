"use client"

import { useState } from "react"
import {
  CheckCircle,
  Cpu,
  HardDrive,
  ShieldCheck,
  ShieldWarning,
  Warning,
  XCircle,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type PodStatus = "healthy" | "warning" | "crashed"

type PodInfo = {
  name: string
  status: PodStatus
  uptime: string
  cpu: number
  ram: number
  restarts: number
  node: string
}

// Dummy pod data — replace with real API data when available
const DUMMY_PODS: PodInfo[] = [
  {
    name: "web-7d9f8b-xk2qp",
    status: "healthy",
    uptime: "3d 14h",
    cpu: 42,
    ram: 61,
    restarts: 0,
    node: "node-us-east-1a",
  },
  {
    name: "web-7d9f8b-mn4rt",
    status: "healthy",
    uptime: "3d 14h",
    cpu: 38,
    ram: 54,
    restarts: 0,
    node: "node-us-east-1b",
  },
  {
    name: "web-7d9f8b-p9wzx",
    status: "warning",
    uptime: "1d 2h",
    cpu: 88,
    ram: 79,
    restarts: 2,
    node: "node-us-east-1a",
  },
  {
    name: "web-7d9f8b-q1lmv",
    status: "crashed",
    uptime: "—",
    cpu: 0,
    ram: 0,
    restarts: 7,
    node: "node-us-east-1c",
  },
]

const POD_STATUS_META: Record<
  PodStatus,
  {
    label: string
    icon: React.ElementType
    color: string
    bg: string
    border: string
    bar: string
  }
> = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    bar: "bg-emerald-400",
  },
  warning: {
    label: "Warning",
    icon: Warning,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    bar: "bg-amber-400",
  },
  crashed: {
    label: "Crashed",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    bar: "bg-red-500",
  },
}

export type TabScalingProps = {
  replicas: number
  setReplicas: React.Dispatch<React.SetStateAction<number>>
  maxAllowedReplicas?: number
  maxCpuQuota?: string
  maxMemoryQuota?: string
}

export function parseCpuToCores(cpuStr: string): number {
  if (cpuStr.endsWith("m")) {
    return parseFloat(cpuStr.slice(0, -1)) / 1000
  }
  return parseFloat(cpuStr)
}

export function parseMemoryToMiB(memStr: string): number {
  if (memStr.endsWith("Gi") || memStr.endsWith("GiB")) {
    return parseFloat(memStr) * 1024
  }
  if (memStr.endsWith("Mi") || memStr.endsWith("MiB")) {
    return parseFloat(memStr)
  }
  return parseFloat(memStr)
}

export function TabScaling({
  replicas,
  setReplicas,
  maxAllowedReplicas = 8,
  maxCpuQuota = "4000m",
  maxMemoryQuota = "4096Mi",
}: TabScalingProps) {
  const [cpuLimit, setCpuLimit] = useState("1000m")
  const [memRequest, setMemRequest] = useState("256Mi")
  const [memLimit, setMemLimit] = useState("512Mi")

  const [hpaEnabled, setHpaEnabled] = useState(false)
  const [hpaMinReplicas, setHpaMinReplicas] = useState(2)
  const [hpaMaxReplicas, setHpaMaxReplicas] = useState(8)
  const [hpaCpuTarget, setHpaCpuTarget] = useState(75)

  const [vpaEnabled, setVpaEnabled] = useState(false)
  const [vpaMode, setVpaMode] = useState<"Off" | "Initial" | "Auto">("Auto")

  // Options map
  const memRequestOptions = ["128Mi", "256Mi", "512Mi", "1024Mi"]
  const currentMemRequestIndex =
    memRequestOptions.indexOf(memRequest) !== -1
      ? memRequestOptions.indexOf(memRequest)
      : 1

  const memLimitOptions = ["256Mi", "512Mi", "1024Mi", "2048Mi", "4096Mi"]
  const currentMemLimitIndex =
    memLimitOptions.indexOf(memLimit) !== -1
      ? memLimitOptions.indexOf(memLimit)
      : 1

  const cpuLimitOptions = ["500m", "1000m", "2000m"]
  const currentCpuLimitIndex =
    cpuLimitOptions.indexOf(cpuLimit) !== -1
      ? cpuLimitOptions.indexOf(cpuLimit)
      : 1

  // Resource calculations
  const cpuLimitCores = parseCpuToCores(cpuLimit)
  const memLimitMiB = parseMemoryToMiB(memLimit)
  const maxCpuCores = parseCpuToCores(maxCpuQuota)
  const maxMemoryMiB = parseMemoryToMiB(maxMemoryQuota)

  const totalCores = replicas * cpuLimitCores
  const totalMemoryMiB = replicas * memLimitMiB

  const cpuPercent = Math.min(100, Math.round((totalCores / maxCpuCores) * 100))
  const memPercent = Math.min(
    100,
    Math.round((totalMemoryMiB / maxMemoryMiB) * 100)
  )

  const hpaQuotaCeiling = Math.max(
    1,
    Math.min(maxAllowedReplicas, Math.floor(maxCpuCores / cpuLimitCores))
  )

  const wouldExceedCpu = (replicas + 1) * cpuLimitCores > maxCpuCores
  const wouldExceedMemory = (replicas + 1) * memLimitMiB > maxMemoryMiB
  const isAtMaxReplicas = replicas >= maxAllowedReplicas
  const isQuotaCapReached =
    isAtMaxReplicas || wouldExceedCpu || wouldExceedMemory
  const isPlusDisabled = hpaEnabled || isQuotaCapReached

  const pods = DUMMY_PODS

  const podCounts = {
    total: pods.length,
    healthy: pods.filter((p) => p.status === "healthy").length,
    warning: pods.filter((p) => p.status === "warning").length,
    crashed: pods.filter((p) => p.status === "crashed").length,
  }
  return (
    <div className="flex flex-col gap-6">
      {/* Pod Status Overview */}
      <Card size="sm" className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                </span>
                Pod Status Overview
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs text-muted-foreground">
                Live view of all running pod instances and their health state
              </CardDescription>
            </div>
            {/* Summary badges */}
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
                {podCounts.total} Total
              </span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
                {podCounts.healthy} Healthy
              </span>
              {podCounts.warning > 0 && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-400">
                  {podCounts.warning} Warning
                </span>
              )}
              {podCounts.crashed > 0 && (
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-400">
                  {podCounts.crashed} Crashed
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Pod Name",
                    "Status",
                    "CPU",
                    "RAM",
                    "Uptime",
                    "Restarts",
                    "Node",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground/70 uppercase"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pods.map((pod, i) => {
                  const meta = POD_STATUS_META[pod.status]
                  const StatusIcon = meta.icon
                  return (
                    <tr
                      key={pod.name}
                      className={`border-b border-border transition-colors hover:bg-muted/30 ${
                        i === pods.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      {/* Pod name */}
                      <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-foreground">
                        {pod.name}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.border} ${meta.bg} ${meta.color}`}
                        >
                          <StatusIcon size={10} weight="fill" />
                          {meta.label}
                        </span>
                      </td>

                      {/* CPU */}
                      <td className="min-w-[100px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${meta.bar}`}
                              style={{ width: `${pod.cpu}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono text-[10px] font-semibold ${
                              pod.status === "crashed"
                                ? "text-muted-foreground/30"
                                : "text-foreground"
                            }`}
                          >
                            {pod.cpu}%
                          </span>
                        </div>
                      </td>

                      {/* RAM */}
                      <td className="min-w-[100px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${meta.bar}`}
                              style={{ width: `${pod.ram}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono text-[10px] font-semibold ${
                              pod.status === "crashed"
                                ? "text-muted-foreground/30"
                                : "text-foreground"
                            }`}
                          >
                            {pod.ram}%
                          </span>
                        </div>
                      </td>

                      {/* Uptime */}
                      <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                        {pod.uptime}
                      </td>

                      {/* Restarts */}
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            pod.restarts > 3
                              ? "text-red-400"
                              : pod.restarts > 0
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {pod.restarts}
                        </span>
                      </td>

                      {/* Node */}
                      <td className="px-4 py-3 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                        {pod.node}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resource Tuning + Autoscaling */}
      <div className="space-y-6">
        {/* Resource Limits */}
        <Card size="sm" className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Cpu size={18} className="text-primary" /> Resource Tuning
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Allocate CPU and RAM quotas to your container pods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-xs">
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
              {/* Memory Request Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <HardDrive size={13} className="text-muted-foreground" />{" "}
                    Memory Request (Min)
                  </span>
                  <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    {memRequest}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={memRequestOptions.length - 1}
                  value={currentMemRequestIndex}
                  onChange={(e) =>
                    setMemRequest(memRequestOptions[parseInt(e.target.value)])
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary transition-all hover:bg-muted/80"
                />
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                  <span>128Mi</span>
                  <span>256Mi</span>
                  <span>512Mi</span>
                  <span>1024Mi</span>
                </div>
              </div>

              {/* Memory Limit Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <HardDrive size={13} className="text-red-400" /> Memory
                    Limit (Max)
                  </span>
                  <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    {memLimit}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={memLimitOptions.length - 1}
                  value={currentMemLimitIndex}
                  onChange={(e) =>
                    setMemLimit(memLimitOptions[parseInt(e.target.value)])
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary transition-all hover:bg-muted/80"
                />
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                  <span>256Mi</span>
                  <span>512Mi</span>
                  <span>1024Mi</span>
                  <span>2048Mi</span>
                  <span>4096Mi</span>
                </div>
                <span className="block text-[10px] leading-tight text-muted-foreground/80">
                  Adjust Memory Limit to avoid Out-Of-Memory (OOM) status.
                </span>
              </div>

              {/* CPU Limit Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Cpu size={13} className="text-muted-foreground" /> CPU
                    Limit (Max)
                  </span>
                  <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    {cpuLimit === "500m"
                      ? "0.5 Cores"
                      : cpuLimit === "1000m"
                        ? "1.0 Cores"
                        : "2.0 Cores"}{" "}
                    ({cpuLimit})
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={cpuLimitOptions.length - 1}
                  value={currentCpuLimitIndex}
                  onChange={(e) => {
                    const nextCpu = cpuLimitOptions[parseInt(e.target.value)]
                    setCpuLimit(nextCpu)
                    const nextCores = parseCpuToCores(nextCpu)
                    const nextCeiling = Math.max(
                      1,
                      Math.min(
                        maxAllowedReplicas,
                        Math.floor(maxCpuCores / nextCores)
                      )
                    )
                    if (hpaMaxReplicas > nextCeiling) {
                      setHpaMaxReplicas(nextCeiling)
                    }
                  }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary transition-all hover:bg-muted/80"
                />
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                  <span>0.5 Cores</span>
                  <span>1.0 Cores</span>
                  <span>2.0 Cores</span>
                </div>
              </div>
            </div>

            {/* Total Resource Footprint */}
            <div className="space-y-3.5 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  Total Resource Footprint
                </span>
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                  {replicas} {replicas === 1 ? "replica" : "replicas"}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* CPU Footprint */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Cpu size={13} />
                      Total CPU:
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {totalCores.toFixed(1)} / {maxCpuCores.toFixed(1)} Cores
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        cpuPercent >= 100 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, cpuPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Memory Footprint */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <HardDrive size={13} />
                      Total Memory:
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {totalMemoryMiB} MiB / {maxMemoryMiB} MiB
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        memPercent >= 100 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(100, memPercent)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Replicas */}
            <div className="space-y-3.5 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  Manual Replicas
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Decrease replicas"
                    onClick={() => setReplicas(Math.max(1, replicas - 1))}
                    disabled={hpaEnabled || replicas <= 1}
                    className="h-7 w-7 rounded-lg border-border p-0 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-95"
                  >
                    -
                  </Button>
                  <span className="w-6 text-center font-mono text-sm font-bold text-foreground">
                    {replicas}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Increase replicas"
                    onClick={() => setReplicas(replicas + 1)}
                    disabled={isPlusDisabled}
                    className="h-7 w-7 rounded-lg border-border p-0 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-95"
                  >
                    +
                  </Button>
                </div>
              </div>
              {hpaEnabled && (
                <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[10px] text-amber-300">
                  <ShieldWarning size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Manual replicas are locked because Horizontal Pod Autoscaler
                    (HPA) is currently active.
                  </span>
                </div>
              )}
              {!hpaEnabled && isQuotaCapReached && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[10px] text-amber-400">
                  <Warning size={14} className="shrink-0" />
                  <span>Maximum resource quota reached for this plan.</span>
                </div>
              )}
            </div>

            <Button
              type="button"
              className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/95"
              onClick={() =>
                alert("Configurations updated! Initiating rolling restart...")
              }
            >
              Save Resource Settings
            </Button>
          </CardContent>
        </Card>

        {/* Autoscaling Policies */}
        <Card size="sm" className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Autoscaling Policies (HPA / VPA)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Automate horizontal scale-out and vertical limits optimizations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* HPA Card section */}
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 transition-all">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-sm font-bold text-foreground">
                    Horizontal Pod Autoscaler (HPA)
                  </span>
                  <span className="block text-xs leading-normal text-muted-foreground">
                    Dynamically scale replicas based on CPU/RAM thresholds
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Toggle Horizontal Pod Autoscaler"
                  onClick={() => setHpaEnabled(!hpaEnabled)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold transition-all duration-200 focus:outline-none ${
                    hpaEnabled
                      ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                      : "border border-border bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      hpaEnabled
                        ? "animate-pulse bg-emerald-400"
                        : "bg-neutral-500"
                    }`}
                  />
                  {hpaEnabled ? "Active" : "Disabled"}
                </button>
              </div>

              {hpaEnabled && (
                <div className="animate-fadeIn space-y-3.5 border-t border-border pt-3.5 text-xs">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-muted-foreground">
                        Min Replicas
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={hpaQuotaCeiling}
                        value={hpaMinReplicas}
                        onChange={(e) =>
                          setHpaMinReplicas(
                            Math.max(
                              1,
                              Math.min(Number(e.target.value), hpaMaxReplicas)
                            )
                          )
                        }
                        className="h-8 rounded-lg border-border bg-background text-xs font-semibold text-foreground focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-muted-foreground">
                        Max Replicas
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={hpaQuotaCeiling}
                        value={hpaMaxReplicas}
                        onChange={(e) =>
                          setHpaMaxReplicas(
                            Math.max(
                              1,
                              Math.min(Number(e.target.value), hpaQuotaCeiling)
                            )
                          )
                        }
                        className="h-8 rounded-lg border-border bg-background text-xs font-semibold text-foreground focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-muted-foreground">
                        CPU Target Utilization (%)
                      </label>
                      <Input
                        type="number"
                        value={hpaCpuTarget}
                        onChange={(e) =>
                          setHpaCpuTarget(Number(e.target.value))
                        }
                        className="h-8 rounded-lg border-border bg-background text-xs font-semibold text-foreground focus:border-primary/50"
                      />
                    </div>
                  </div>

                  {hpaMaxReplicas >= hpaQuotaCeiling && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[10px] text-amber-400">
                      <Warning size={14} className="shrink-0" />
                      <span>
                        HPA max replicas capped at {hpaQuotaCeiling} based on
                        CPU limits and plan quota.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* VPA Card section */}
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 transition-all">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-sm font-bold text-foreground">
                    Vertical Pod Autoscaler (VPA)
                  </span>
                  <span className="block text-xs leading-normal text-muted-foreground">
                    Let the Kubernetes engine tune memory and CPU parameters
                    based on historic usage
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Toggle Vertical Pod Autoscaler"
                  onClick={() => setVpaEnabled(!vpaEnabled)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold transition-all duration-200 focus:outline-none ${
                    vpaEnabled
                      ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                      : "border border-border bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      vpaEnabled
                        ? "animate-pulse bg-emerald-400"
                        : "bg-neutral-500"
                    }`}
                  />
                  {vpaEnabled ? "Active" : "Disabled"}
                </button>
              </div>

              {vpaEnabled && (
                <div className="animate-fadeIn space-y-3 border-t border-border pt-3.5 text-xs">
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-muted-foreground">
                      VPA Update Mode
                    </label>
                    <div className="flex gap-2">
                      {(["Off", "Initial", "Auto"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setVpaMode(mode)}
                          className={`rounded-lg border px-4 py-1.5 text-xs font-bold transition-all ${
                            vpaMode === mode
                              ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]"
                              : "border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] leading-normal text-blue-300">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                    <p>
                      <strong>Auto:</strong> Automatically updates pod sizes
                      (recreates pods if required). <strong>Initial:</strong>{" "}
                      Assigns optimal settings only on startup.{" "}
                      <strong>Off:</strong> Recommendation engine runs in
                      passive mode.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
