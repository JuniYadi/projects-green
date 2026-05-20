"use client"

import { useState } from "react"
import { Cpu } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type TabScalingProps = {
  replicas: number
  setReplicas: React.Dispatch<React.SetStateAction<number>>
}

export function TabScaling({ replicas, setReplicas }: TabScalingProps) {
  const [cpuLimit, setCpuLimit] = useState("1000m")
  const [memRequest, setMemRequest] = useState("256Mi")
  const [memLimit, setMemLimit] = useState("512Mi")

  const [hpaEnabled, setHpaEnabled] = useState(false)
  const [hpaMinReplicas, setHpaMinReplicas] = useState(2)
  const [hpaMaxReplicas, setHpaMaxReplicas] = useState(8)
  const [hpaCpuTarget, setHpaCpuTarget] = useState(75)

  const [vpaEnabled, setVpaEnabled] = useState(false)
  const [vpaMode, setVpaMode] = useState<"Off" | "Initial" | "Auto">("Auto")

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Resource Limits (Q12 Answer) */}
      <Card className="border-white/[0.06] bg-black/25 col-span-1">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
            <Cpu size={18} className="text-primary" /> Resource Tuning
          </CardTitle>
          <CardDescription>
            Allocate CPU and RAM quotas to your container pods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="space-y-3 rounded-lg bg-black/40 border border-white/[0.06] p-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white font-medium">
                  Memory Request (Min)
                </span>
                <span className="font-mono text-primary font-bold">
                  {memRequest}
                </span>
              </div>
              <select
                value={memRequest}
                onChange={(e) => setMemRequest(e.target.value)}
                className="w-full bg-black/50 text-white rounded border border-white/[0.1] px-2 py-1.5 text-xs focus:outline-none"
              >
                <option value="128Mi">128 MiB (Standard)</option>
                <option value="256Mi">256 MiB</option>
                <option value="512Mi">512 MiB</option>
                <option value="1024Mi">1024 MiB (1 GiB)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white font-medium">
                  Memory Limit (Max) (Q12)
                </span>
                <span className="font-mono text-primary font-bold">
                  {memLimit}
                </span>
              </div>
              <select
                value={memLimit}
                onChange={(e) => setMemLimit(e.target.value)}
                className="w-full bg-black/50 text-white rounded border border-white/[0.1] px-2 py-1.5 text-xs focus:outline-none"
              >
                <option value="256Mi">256 MiB</option>
                <option value="512Mi">512 MiB (Standard)</option>
                <option value="1024Mi">1024 MiB (1 GiB)</option>
                <option value="2048Mi">
                  2048 MiB (2 GiB) - Higher Traffic
                </option>
                <option value="4096Mi">4096 MiB (4 GiB)</option>
              </select>
              <span className="text-[10px] text-muted-foreground block leading-tight">
                Adjust Memory Limit to avoid Out-Of-Memory (OOM) status.
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white font-medium">CPU Limit (Max)</span>
                <span className="font-mono text-primary font-bold">
                  {cpuLimit}
                </span>
              </div>
              <select
                value={cpuLimit}
                onChange={(e) => setCpuLimit(e.target.value)}
                className="w-full bg-black/50 text-white rounded border border-white/[0.1] px-2 py-1.5 text-xs focus:outline-none"
              >
                <option value="500m">0.5 Cores (500m)</option>
                <option value="1000m">1.0 Cores (1000m)</option>
                <option value="2000m">2.0 Cores (2000m)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">Manual Replicas</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReplicas(Math.max(1, replicas - 1))}
                  disabled={hpaEnabled}
                  className="h-6 w-6 p-0 text-white border-white/10"
                >
                  -
                </Button>
                <span className="font-mono font-bold text-white w-6 text-center">
                  {replicas}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReplicas(replicas + 1)}
                  disabled={hpaEnabled}
                  className="h-6 w-6 p-0 text-white border-white/10"
                >
                  +
                </Button>
              </div>
            </div>
            {hpaEnabled && (
              <span className="text-[9px] text-yellow-400 block leading-tight">
                ⚠️ Manual replicas are locked because HPA is active.
              </span>
            )}
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() =>
              alert(
                "Configurations updated! Initiating rolling restart..."
              )
            }
          >
            Save Resource Settings
          </Button>
        </CardContent>
      </Card>

      {/* Autoscaling Policies (Q13 Answer) */}
      <Card className="col-span-2 border-white/[0.06] bg-black/25">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">
            Autoscaling Policies (HPA / VPA)
          </CardTitle>
          <CardDescription>
            Automate horizontal scale-out and vertical limits optimizations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* HPA Card section */}
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="space-y-0.5">
                <span className="font-bold text-white text-sm block">
                  Horizontal Pod Autoscaler (HPA)
                </span>
                <span className="text-xs text-muted-foreground block">
                  Dynamically scale replicas based on CPU/RAM thresholds
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHpaEnabled(!hpaEnabled)}
                className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                  hpaEnabled
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-white/10 text-muted-foreground border border-white/10"
                }`}
              >
                {hpaEnabled ? "Active" : "Disabled"}
              </button>
            </div>

            {hpaEnabled && (
              <div className="grid gap-4 sm:grid-cols-3 text-xs">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground block">
                    Min Replicas
                  </label>
                  <Input
                    type="number"
                    value={hpaMinReplicas}
                    onChange={(e) =>
                      setHpaMinReplicas(Number(e.target.value))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground block">
                    Max Replicas
                  </label>
                  <Input
                    type="number"
                    value={hpaMaxReplicas}
                    onChange={(e) =>
                      setHpaMaxReplicas(Number(e.target.value))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground block">
                    CPU Target Utilization (%)
                  </label>
                  <Input
                    type="number"
                    value={hpaCpuTarget}
                    onChange={(e) =>
                      setHpaCpuTarget(Number(e.target.value))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* VPA Card section */}
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="space-y-0.5">
                <span className="font-bold text-white text-sm block">
                  Vertical Pod Autoscaler (VPA)
                </span>
                <span className="text-xs text-muted-foreground block">
                  Let the Kubernetes engine tune memory and CPU parameters based
                  on historic usage
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVpaEnabled(!vpaEnabled)}
                className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                  vpaEnabled
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-white/10 text-muted-foreground border border-white/10"
                }`}
              >
                {vpaEnabled ? "Active" : "Disabled"}
              </button>
            </div>

            {vpaEnabled && (
              <div className="space-y-2 text-xs">
                <label className="text-muted-foreground block">
                  VPA Update Mode
                </label>
                <div className="flex gap-2">
                  {(["Off", "Initial", "Auto"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setVpaMode(mode)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                        vpaMode === mode
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/[0.08] text-muted-foreground hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  <strong>Auto:</strong> Automatically updates pod sizes (forces
                  pod recreate if needed).{" "}
                  <strong className="text-white">Initial:</strong> Sets
                  optimized requests at pod launch.{" "}
                  <strong className="text-white">Off:</strong> Recommendations
                  only.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
