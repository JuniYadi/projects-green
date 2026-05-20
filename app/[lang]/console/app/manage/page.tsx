"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Globe,
  Key,
  Terminal as TerminalIcon,
  Cpu,
  Lightning,
  Pulse,
  HardDrive,
  CheckCircle,
  Warning,
  ShieldWarning,
  ArrowClockwise,
  Question,
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
import { OperateTroubleshooter } from "@/modules/deploy/ui/operate/operate-troubleshooter"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"

const TABS: Array<{
  id: OperateTabId
  label: string
  icon: React.ReactNode
}> = [
  { id: "overview", label: "Overview", icon: <Pulse size={16} /> },
  { id: "domains", label: "Domains & SSL", icon: <Globe size={16} /> },
  { id: "env", label: "Environment & Net", icon: <Lightning size={16} /> },
  { id: "mounts", label: "Storage & Mounts", icon: <Key size={16} /> },
  {
    id: "scaling",
    label: "Autoscaling & Tuning",
    icon: <Cpu size={16} />,
  },
  {
    id: "metrics",
    label: "Telemetry & Metrics",
    icon: <HardDrive size={16} />,
  },
  {
    id: "logs",
    label: "Opensearch Logs",
    icon: <TerminalIcon size={16} />,
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

  // Simulation controls
  const [diagnosticMode, setDiagnosticMode] = useState<string>("healthy")

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

  // Status badges
  const statusBadge = () => {
    switch (healthStatus) {
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-500 border border-green-500/20">
            <CheckCircle size={14} className="animate-pulse" /> Healthy
          </span>
        )
      case "degraded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500 border border-yellow-500/20">
            <Warning size={14} /> Degraded
          </span>
        )
      case "inaccessible":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500 border border-red-500/20">
            <ShieldWarning size={14} /> Inaccessible
          </span>
        )
      case "deploying":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-500 border border-blue-500/20">
            <ArrowClockwise size={14} className="animate-spin" /> Deploying
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
      {/* Top Banner Control Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-5 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white">
              laravel-shop
            </h2>
            {statusBadge()}
          </div>
          <p className="text-xs text-muted-foreground">
            Current Environment:{" "}
            <strong className="text-white capitalize">{selectedEnv}</strong>{" "}
            &bull; Region: us-east-1
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Switcher */}
          <div className="inline-flex rounded-lg bg-black/50 p-1 border border-white/[0.06]">
            {K8S_ENVIRONMENTS.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => setSelectedEnv(env.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedEnv === env.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {env.label}
              </button>
            ))}
          </div>

          {/* FAQ & Troubleshooting Trigger */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsTroubleshooterOpen(true)}
            className="gap-2 text-xs border-primary/40 hover:border-primary/80 text-primary bg-primary/5"
          >
            <Question size={16} />
            Operations FAQ
          </Button>

          {/* Simulation Toggle */}
          <div className="flex items-center gap-1 border border-dashed border-white/[0.1] rounded-lg p-1 bg-black/20 text-xs">
            <span className="text-muted-foreground px-2">
              Simulate State:
            </span>
            <select
              value={diagnosticMode}
              onChange={(e) => setDiagnosticMode(e.target.value)}
              className="bg-black/50 text-white rounded px-2 py-1 text-xs border border-white/[0.1] focus:outline-none"
            >
              <option value="healthy">Healthy</option>
              <option value="error_502">502 Bad Gateway</option>
              <option value="ssl_expired">SSL Expired</option>
              <option value="redirect_loop">Redirect Loop</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex overflow-x-auto gap-1 border-b border-white/[0.08] pb-1 select-none scrollbar-none">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === item.id
                ? "border-primary text-white bg-white/[0.02]"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === "overview" && (
          <TabOverview
            diagnosticMode={diagnosticMode}
            replicas={replicas}
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
      </div>

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
