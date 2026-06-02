"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Globe,
  Key,
  Terminal as TerminalIcon,
  Cpu,
  Lightning,
  Pulse,
  HardDrive,
  ArrowClockwise,
  Question,
  Gear,
  Calendar,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"


import type {
  K8sEnvironmentId,
  AppStatusType,
  CustomDomain,
  EnvVar,
  VolumeMount,
  LogMessage,
} from "@/modules/deploy/operate.types"
import {
  type OperateTabId,
  OPERATE_TAB_QUERY_KEY,
  OPERATE_ENV_QUERY_KEY,
  parseTabQueryValue,
  parseEnvQueryValue,
} from "@/modules/deploy/operate.constants"
import {
  K8S_ENVIRONMENTS,
  INITIAL_DOMAINS,
  INITIAL_ENV_VARS,
  INITIAL_MOUNTS,
  INITIAL_LOGS,
} from "@/modules/deploy/operate.mock"

import { TabOverview } from "@/modules/deploy/ui/operate/tab-overview"
import { TabDomains } from "@/modules/deploy/ui/operate/tab-domains"
import { TabEnv } from "@/modules/deploy/ui/operate/tab-env"
import { TabMounts } from "@/modules/deploy/ui/operate/tab-mounts"
import { TabScaling } from "@/modules/deploy/ui/operate/tab-scaling"
import { TabMetrics } from "@/modules/deploy/ui/operate/tab-metrics"
import { TabLogs } from "@/modules/deploy/ui/operate/tab-logs"
import { TabEvents } from "@/modules/deploy/ui/operate/tab-events"
import { OperateTroubleshooter } from "@/modules/deploy/ui/operate/operate-troubleshooter"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"

const TABS: Array<{
  id: OperateTabId
  label: string
  icon: ReactNode
}> = [
  { id: "overview", label: "Overview", icon: <Pulse size={16} /> },
  { id: "domains", label: "Domains & SSL", icon: <Globe size={16} /> },
  { id: "env", label: "Environment", icon: <Lightning size={16} /> },
  { id: "mounts", label: "Storages", icon: <Key size={16} /> },
  {
    id: "scaling",
    label: "Pods & Scaling",
    icon: <Cpu size={16} />,
  },
  {
    id: "metrics",
    label: "Metrics",
    icon: <HardDrive size={16} />,
  },
  {
    id: "logs",
    label: "Logs",
    icon: <TerminalIcon size={16} />,
  },
  {
    id: "events",
    label: "Events",
    icon: <Calendar size={16} />,
  },
]

export default function ManagePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<OperateTabId>(() =>
    parseTabQueryValue(searchParams.get(OPERATE_TAB_QUERY_KEY))
  )
  const [selectedEnv, setSelectedEnv] = useState<K8sEnvironmentId>(() =>
    parseEnvQueryValue(searchParams.get(OPERATE_ENV_QUERY_KEY))
  )

  // Troubleshooter drawer
  const [isTroubleshooterOpen, setIsTroubleshooterOpen] = useState(false)

  // DevTools Simulation Panel Open State
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false)

  // Simulation controls
  const [diagnosticMode, setDiagnosticMode] = useState<string>("healthy")
  const [cloudflareEnabled, setCloudflareEnabled] = useState<boolean>(true)
  const [dbConnected, setDbConnected] = useState<boolean>(true)

  // Data state
  const [domains, setDomains] =
    useState<Record<K8sEnvironmentId, CustomDomain[]>>(INITIAL_DOMAINS)
  const [envVars, setEnvVars] =
    useState<Record<K8sEnvironmentId, EnvVar[]>>(INITIAL_ENV_VARS)
  const [mounts, setMounts] =
    useState<Record<K8sEnvironmentId, VolumeMount[]>>(INITIAL_MOUNTS)
  const [logs, setLogs] = useState<LogMessage[]>(INITIAL_LOGS)

  // Scaling state (shared with overview for replica count display)
  const [replicas, setReplicas] = useState(2)

  // Derive health status from diagnosticMode
  const healthStatus = ((): AppStatusType => {
    if (diagnosticMode === "healthy") return "healthy"
    if (diagnosticMode === "error_502") return "degraded"
    if (diagnosticMode === "ssl_expired") return "inaccessible"
    return "degraded"
  })()

  // Sync state -> URL
  useEffect(() => {
    const currentTab = searchParams.get(OPERATE_TAB_QUERY_KEY)
    const currentEnv = searchParams.get(OPERATE_ENV_QUERY_KEY)

    if (currentTab === activeTab && currentEnv === selectedEnv) return

    const next = new URLSearchParams(searchParams.toString())
    next.set(OPERATE_TAB_QUERY_KEY, activeTab)
    next.set(OPERATE_ENV_QUERY_KEY, selectedEnv)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [activeTab, selectedEnv, pathname, router, searchParams])

  // ESC key listener for DevTools drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDevToolsOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Status badges
  const statusBadge = () => {
    switch (healthStatus) {
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            </span>
            Healthy
          </span>
        )
      case "degraded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-0.5 text-xs font-semibold text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            </span>
            Degraded
          </span>
        )
      case "inaccessible":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 px-2.5 py-0.5 text-xs font-semibold text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            </span>
            Inaccessible
          </span>
        )
      case "deploying":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 px-2.5 py-0.5 text-xs font-semibold text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.1)]">
            <ArrowClockwise size={12} className="animate-spin text-sky-400" />
            Deploying
          </span>
        )
    }
  }

  return (
    <LifecyclePageShell
      title="Manage Application"
      description="Control runtime configuration, scaling, and diagnostics."
    >
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-[#0A0A0C]/65 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-white">
                laravel-shop
              </h2>
              {statusBadge()}
            </div>
            <p className="text-xs text-muted-foreground">
              Region: <span className="text-white font-medium">us-east-1</span> &bull; Cluster ID: <span className="text-white font-medium">k8s-useast1-prod</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Environment Switcher */}
            <div className="inline-flex rounded-xl border border-white/[0.08] bg-neutral-900/60 p-1 backdrop-blur-md">
              {K8S_ENVIRONMENTS.map((env) => (
                <Button
                  key={env.id}
                  type="button"
                  onClick={() => setSelectedEnv(env.id)}
                  variant="ghost"
                  size="xs"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    selectedEnv === env.id
                      ? "bg-primary text-white shadow-md shadow-primary/10"
                      : "text-muted-foreground hover:text-white"
                  }`}
                  aria-pressed={selectedEnv === env.id}
                >
                  {env.label}
                </Button>
              ))}
            </div>

            {/* Operations FAQ Link */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTroubleshooterOpen(true)}
              className="h-8 gap-2 border-primary/20 bg-primary/5 px-3 text-xs text-primary hover:bg-primary/10 hover:border-primary/40 transition-all rounded-xl"
            >
              <Question size={15} />
              Operations FAQ
            </Button>
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.08] pb-1 select-none scrollbar-none">
          {TABS.map((item) => {
            const isActive = activeTab === item.id
            return (
              <Button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                variant="ghost"
                size="sm"
                className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white/[0.04] text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white/[0.02] hover:text-white"
                }`}
                aria-pressed={isActive}
              >
                <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                  {item.icon}
                </span>
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-t-full" />
                )}
              </Button>
            )
          })}
        </div>

        {/* Tab Panels */}
        <div className="space-y-4 min-h-[400px]">
          {activeTab === "overview" && (
            <TabOverview
              diagnosticMode={diagnosticMode}
              replicas={replicas}
              cloudflareEnabled={cloudflareEnabled}
              dbConnected={dbConnected}
              setCloudflareEnabled={setCloudflareEnabled}
              setDbConnected={setDbConnected}
              domains={domains[selectedEnv]}
            />
          )}

          {activeTab === "domains" && (
            <TabDomains
              selectedEnv={selectedEnv}
              domains={domains}
              setDomains={setDomains}
            />
          )}

          {activeTab === "env" && (
            <TabEnv
              selectedEnv={selectedEnv}
              envVars={envVars}
              setEnvVars={setEnvVars}
            />
          )}

          {activeTab === "mounts" && (
            <TabMounts
              selectedEnv={selectedEnv}
              mounts={mounts}
              setMounts={setMounts}
            />
          )}

          {activeTab === "scaling" && (
            <TabScaling replicas={replicas} setReplicas={setReplicas} />
          )}

          {activeTab === "metrics" && (
            <TabMetrics cpuLimit="1000m" memLimit="512Mi" />
          )}

          {activeTab === "logs" && (
            <TabLogs
              logs={logs}
              setLogs={setLogs}
              diagnosticMode={diagnosticMode}
            />
          )}

          {activeTab === "events" && <TabEvents />}
        </div>

        {/* Floating DevTools Simulator Toggle */}
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            type="button"
            onClick={() => setIsDevToolsOpen(true)}
            className="h-11 w-11 rounded-full bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-white hover:bg-primary/95 transition-all hover:scale-105"
            title="Open Developer Simulation Tools"
          >
            <Gear size={22} className="animate-spin-slow" />
          </Button>
        </div>

        {/* DevTools Simulator Drawer */}
        {isDevToolsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs transition-all">
            <div 
              className="absolute inset-0" 
              onClick={() => setIsDevToolsOpen(false)} 
            />
            <div className="relative h-full w-85 bg-neutral-950 border-l border-white/[0.08] p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2.5">
                    <Gear size={20} className="text-primary animate-spin-slow" />
                    <h3 className="font-bold text-white text-sm">Resilience Simulator</h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsDevToolsOpen(false)}
                    className="text-muted-foreground hover:text-white"
                  >
                    Close
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Inject failures and review site performance. Bad states trigger status logs and recommendations dynamically inside other tabs.
                  </p>
                  
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Simulated Environment Health
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: "healthy", label: "Healthy (HTTP 200 OK)", color: "border-emerald-500/20 hover:border-emerald-500/50" },
                        { value: "error_502", label: "502 Bad Gateway", color: "border-amber-500/20 hover:border-amber-500/50" },
                        { value: "ssl_expired", label: "SSL Expired (Inaccessible)", color: "border-rose-500/20 hover:border-rose-500/50" },
                        { value: "redirect_loop", label: "Redirect Loop (Flexible SSL)", color: "border-amber-500/20 hover:border-amber-500/50" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDiagnosticMode(opt.value)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                            diagnosticMode === opt.value
                              ? "bg-primary/10 border-primary text-white"
                              : `bg-white/[0.01] ${opt.color} text-muted-foreground hover:bg-white/[0.03] hover:text-white`
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Cloudflare Proxying
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCloudflareEnabled(true)}
                        className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          cloudflareEnabled
                            ? "bg-primary/10 border-primary text-white"
                            : "bg-white/[0.01] border-white/5 text-muted-foreground hover:text-white"
                        }`}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setCloudflareEnabled(false)}
                        className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          !cloudflareEnabled
                            ? "bg-primary/10 border-primary text-white"
                            : "bg-white/[0.01] border-white/5 text-muted-foreground hover:text-white"
                        }`}
                      >
                        Bypassed
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Database Connection
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDbConnected(true)}
                        className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          dbConnected
                            ? "bg-primary/10 border-primary text-white"
                            : "bg-white/[0.01] border-white/5 text-muted-foreground hover:text-white"
                        }`}
                      >
                        Connected
                      </button>
                      <button
                        type="button"
                        onClick={() => setDbConnected(false)}
                        className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          !dbConnected
                            ? "bg-primary/10 border-primary text-white"
                            : "bg-white/[0.01] border-white/5 text-muted-foreground hover:text-white"
                        }`}
                      >
                        Offline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-white/[0.08] pt-4 text-center">
                <span className="text-[10px] text-muted-foreground">
                  Press ESC or click outside to dismiss.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooter Drawer */}
        <OperateTroubleshooter
          isOpen={isTroubleshooterOpen}
          onClose={() => setIsTroubleshooterOpen(false)}
          onDeepLink={(tab) => {
            setActiveTab(tab)
            setIsTroubleshooterOpen(false)
          }}
        />
      </div>
    </LifecyclePageShell>
  )
}
