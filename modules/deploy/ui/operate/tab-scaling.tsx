"use client"

import { useState } from "react"
import { Cpu, HardDrive, ShieldCheck, ShieldWarning } from "@phosphor-icons/react"

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

  // Options map
  const memRequestOptions = ["128Mi", "256Mi", "512Mi", "1024Mi"]
  const currentMemRequestIndex = memRequestOptions.indexOf(memRequest) !== -1 ? memRequestOptions.indexOf(memRequest) : 1

  const memLimitOptions = ["256Mi", "512Mi", "1024Mi", "2048Mi", "4096Mi"]
  const currentMemLimitIndex = memLimitOptions.indexOf(memLimit) !== -1 ? memLimitOptions.indexOf(memLimit) : 1

  const cpuLimitOptions = ["500m", "1000m", "2000m"]
  const currentCpuLimitIndex = cpuLimitOptions.indexOf(cpuLimit) !== -1 ? cpuLimitOptions.indexOf(cpuLimit) : 1

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Resource Limits */}
      <Card size="sm" className="col-span-1 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Cpu size={18} className="text-primary" /> Resource Tuning
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Allocate CPU and RAM quotas to your container pods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-xs">
          <div className="space-y-4 rounded-xl bg-black/40 border border-white/[0.06] p-4">
            
            {/* Memory Request Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/90 font-semibold flex items-center gap-1.5">
                  <HardDrive size={13} className="text-muted-foreground" /> Memory Request (Min)
                </span>
                <span className="font-mono text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  {memRequest}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={memRequestOptions.length - 1}
                value={currentMemRequestIndex}
                onChange={(e) => setMemRequest(memRequestOptions[parseInt(e.target.value)])}
                className="w-full h-1 rounded-lg bg-neutral-800 accent-primary appearance-none cursor-pointer transition-all hover:bg-neutral-700"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>128Mi</span>
                <span>256Mi</span>
                <span>512Mi</span>
                <span>1024Mi</span>
              </div>
            </div>

            {/* Memory Limit Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/90 font-semibold flex items-center gap-1.5">
                  <HardDrive size={13} className="text-red-400" /> Memory Limit (Max)
                </span>
                <span className="font-mono text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  {memLimit}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={memLimitOptions.length - 1}
                value={currentMemLimitIndex}
                onChange={(e) => setMemLimit(memLimitOptions[parseInt(e.target.value)])}
                className="w-full h-1 rounded-lg bg-neutral-800 accent-primary appearance-none cursor-pointer transition-all hover:bg-neutral-700"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>256Mi</span>
                <span>512Mi</span>
                <span>1024Mi</span>
                <span>2048Mi</span>
                <span>4096Mi</span>
              </div>
              <span className="text-[10px] text-muted-foreground/80 block leading-tight">
                Adjust Memory Limit to avoid Out-Of-Memory (OOM) status.
              </span>
            </div>

            {/* CPU Limit Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/90 font-semibold flex items-center gap-1.5">
                  <Cpu size={13} className="text-muted-foreground" /> CPU Limit (Max)
                </span>
                <span className="font-mono text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  {cpuLimit === "500m" ? "0.5 Cores" : cpuLimit === "1000m" ? "1.0 Cores" : "2.0 Cores"} ({cpuLimit})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={cpuLimitOptions.length - 1}
                value={currentCpuLimitIndex}
                onChange={(e) => setCpuLimit(cpuLimitOptions[parseInt(e.target.value)])}
                className="w-full h-1 rounded-lg bg-neutral-800 accent-primary appearance-none cursor-pointer transition-all hover:bg-neutral-700"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>0.5 Cores</span>
                <span>1.0 Cores</span>
                <span>2.0 Cores</span>
              </div>
            </div>

          </div>

          {/* Manual Replicas */}
          <div className="space-y-3.5 border border-white/[0.06] bg-black/20 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Manual Replicas</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReplicas(Math.max(1, replicas - 1))}
                  disabled={hpaEnabled}
                  className="h-7 w-7 p-0 text-white border-white/10 hover:bg-white/5 active:scale-95 transition-all text-sm font-semibold rounded-lg"
                >
                  -
                </Button>
                <span className="font-mono font-bold text-white w-6 text-center text-sm">
                  {replicas}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReplicas(replicas + 1)}
                  disabled={hpaEnabled}
                  className="h-7 w-7 p-0 text-white border-white/10 hover:bg-white/5 active:scale-95 transition-all text-sm font-semibold rounded-lg"
                >
                  +
                </Button>
              </div>
            </div>
            {hpaEnabled && (
              <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[10px] text-amber-300">
                <ShieldWarning size={14} className="shrink-0 mt-0.5" />
                <span>Manual replicas are locked because Horizontal Pod Autoscaler (HPA) is currently active.</span>
              </div>
            )}
          </div>

          <Button
            type="button"
            className="w-full h-9 text-xs font-semibold bg-primary hover:bg-primary/95 text-white rounded-lg transition-all"
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

      {/* Autoscaling Policies */}
      <Card size="sm" className="col-span-2 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-white">
            Autoscaling Policies (HPA / VPA)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Automate horizontal scale-out and vertical limits optimizations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* HPA Card section */}
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4 space-y-4 transition-all">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-white text-sm block">
                  Horizontal Pod Autoscaler (HPA)
                </span>
                <span className="text-xs text-muted-foreground leading-normal block">
                  Dynamically scale replicas based on CPU/RAM thresholds
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHpaEnabled(!hpaEnabled)}
                className={`relative inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-200 focus:outline-none ${
                  hpaEnabled 
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                    : "bg-neutral-800 text-muted-foreground border border-white/5"
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    hpaEnabled ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"
                  }`}
                />
                {hpaEnabled ? "Active" : "Disabled"}
              </button>
            </div>

            {hpaEnabled && (
              <div className="grid gap-4 sm:grid-cols-3 text-xs border-t border-white/[0.06] pt-3.5 animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold block">
                    Min Replicas
                  </label>
                  <Input
                    type="number"
                    value={hpaMinReplicas}
                    onChange={(e) =>
                      setHpaMinReplicas(Number(e.target.value))
                    }
                    className="h-8 bg-black/40 border-white/[0.08] text-xs font-semibold focus:border-primary/50 text-white rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold block">
                    Max Replicas
                  </label>
                  <Input
                    type="number"
                    value={hpaMaxReplicas}
                    onChange={(e) =>
                      setHpaMaxReplicas(Number(e.target.value))
                    }
                    className="h-8 bg-black/40 border-white/[0.08] text-xs font-semibold focus:border-primary/50 text-white rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold block">
                    CPU Target Utilization (%)
                  </label>
                  <Input
                    type="number"
                    value={hpaCpuTarget}
                    onChange={(e) =>
                      setHpaCpuTarget(Number(e.target.value))
                    }
                    className="h-8 bg-black/40 border-white/[0.08] text-xs font-semibold focus:border-primary/50 text-white rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* VPA Card section */}
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4 space-y-4 transition-all">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-white text-sm block">
                  Vertical Pod Autoscaler (VPA)
                </span>
                <span className="text-xs text-muted-foreground leading-normal block">
                  Let the Kubernetes engine tune memory and CPU parameters based on historic usage
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVpaEnabled(!vpaEnabled)}
                className={`relative inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-200 focus:outline-none ${
                  vpaEnabled 
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                    : "bg-neutral-800 text-muted-foreground border border-white/5"
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    vpaEnabled ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"
                  }`}
                />
                {vpaEnabled ? "Active" : "Disabled"}
              </button>
            </div>
 
            {vpaEnabled && (
              <div className="space-y-3 text-xs border-t border-white/[0.06] pt-3.5 animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold block">
                    VPA Update Mode
                  </label>
                  <div className="flex gap-2">
                    {(["Off", "Initial", "Auto"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setVpaMode(mode)}
                        className={`rounded-lg px-4 py-1.5 text-xs font-bold border transition-all ${
                          vpaMode === mode
                            ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]"
                            : "border-white/[0.08] text-muted-foreground hover:text-white hover:bg-white/[0.02]"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] text-blue-300 leading-normal">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  <p>
                    <strong>Auto:</strong> Automatically updates pod sizes (recreates pods if required).{" "}
                    <strong>Initial:</strong> Assigns optimal settings only on startup.{" "}
                    <strong>Off:</strong> Recommendation engine runs in passive mode.
                  </p>
                </div>
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
