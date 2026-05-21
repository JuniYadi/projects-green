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
  CheckCircle,
  Warning,
  ShieldWarning,
  ArrowClockwise,
  Question,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  icon: ReactNode
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-500">
            <CheckCircle size={14} className="animate-pulse" /> Healthy
          </span>
        )
      case "degraded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500">
            <Warning size={14} /> Degraded
          </span>
        )
      case "inaccessible":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500">
            <ShieldWarning size={14} /> Inaccessible
          </span>
        )
      case "deploying":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-500">
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
        <div className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-black/40 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
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
            <div className="inline-flex rounded-lg border border-white/[0.06] bg-black/50 p-1">
              {K8S_ENVIRONMENTS.map((env) => (
                <Button
                  key={env.id}
                  type="button"
                  onClick={() => setSelectedEnv(env.id)}
                  variant={selectedEnv === env.id ? "default" : "ghost"}
                  size="xs"
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedEnv === env.id
                      ? "shadow-sm"
                      : "text-muted-foreground hover:text-white"
                  }`}
                  aria-pressed={selectedEnv === env.id}
                >
                  {env.label}
                </Button>
              ))}
            </div>

            {/* FAQ & Troubleshooting Trigger */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTroubleshooterOpen(true)}
              className="gap-2 border-primary/40 bg-primary/5 text-xs text-primary hover:border-primary/80"
            >
              <Question size={16} />
              Operations FAQ
            </Button>

            {/* Simulation Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-dashed border-white/[0.1] bg-black/20 p-1 text-xs">
              <span className="px-2 text-muted-foreground">
                Simulate State:
              </span>
              <Select value={diagnosticMode} onValueChange={setDiagnosticMode}>
                <SelectTrigger className="h-7 min-w-[170px] bg-black/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="error_502">502 Bad Gateway</SelectItem>
                  <SelectItem value="ssl_expired">SSL Expired</SelectItem>
                  <SelectItem value="redirect_loop">Redirect Loop</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex scrollbar-none gap-1 overflow-x-auto border-b border-white/[0.08] pb-1 select-none">
          {TABS.map((item) => (
            <Button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              variant="ghost"
              size="sm"
              className={`flex items-center gap-2 rounded-none border-b-2 px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "border-primary bg-white/[0.02] text-white"
                  : "border-transparent text-muted-foreground hover:text-white"
              }`}
              aria-pressed={activeTab === item.id}
            >
              {item.icon}
              {item.label}
            </Button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <TabOverview diagnosticMode={diagnosticMode} replicas={replicas} />
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
