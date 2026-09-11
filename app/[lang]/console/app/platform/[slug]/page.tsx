"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  Cpu,
  Globe,
  HardDrive,
  Key,
  WarningOctagon,
  Wrench,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { eden } from "@/lib/eden"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DEPLOY_STATUS_LABELS,
  DEPLOY_STATUS_TONE as STATUS_TONE,
} from "@/modules/deploy/deploy.constants"
import type {
  DeploymentHistoryDTO,
  DeploymentStatusDTO,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"
import type {
  K8sEnvironmentId,
  EnvVar,
  VolumeMount,
  TenantDomainDTO,
  LogMessage,
} from "@/modules/deploy/operate.types"
import type { DeployLogScope } from "@/modules/deploy/deploy.types"
import {
  AppWorkspaceHeader,
  type WorkspaceTabKey,
} from "@/modules/deploy/ui/app-workspace-header"
import { AppOverviewTab } from "@/modules/deploy/ui/app-overview-tab"
import { TemplateUpdateBanner } from "@/modules/deploy/ui/template-update-banner"
import { AppMonitor } from "@/modules/deploy/ui/operate/app-monitor"
import { TabLogs } from "@/modules/deploy/ui/operate/tab-logs"
import { TabMetrics } from "@/modules/deploy/ui/operate/tab-metrics"
import { TabEnv } from "@/modules/deploy/ui/operate/tab-env"
import { TabTraffic } from "@/modules/deploy/ui/operate/tab-traffic"
import { TabDomains } from "@/modules/deploy/ui/operate/tab-domains"
import { TabScaling } from "@/modules/deploy/ui/operate/tab-scaling"
import { TabMounts } from "@/modules/deploy/ui/operate/tab-mounts"
import { TabBuild } from "@/app/[lang]/console/app/settings/_components/tab-build"
import { TabDanger } from "@/app/[lang]/console/app/settings/_components/tab-danger"

type HistoryMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type SettingsSubTab =
  "env" | "domains" | "scaling" | "mounts" | "build" | "danger"

export const VALID_SETTINGS_SUBTABS: readonly SettingsSubTab[] = [
  "env",
  "domains",
  "scaling",
  "mounts",
  "build",
  "danger",
] as const

export function resolveSettingsSubTab(
  rawSection: string | null | undefined
): SettingsSubTab {
  if (
    rawSection &&
    (VALID_SETTINGS_SUBTABS as readonly string[]).includes(rawSection)
  ) {
    return rawSection as SettingsSubTab
  }
  return "env"
}
const formatDuration = (durationMs: number | null): string => {
  if (durationMs === null) return "—"
  if (durationMs < 1000) return `${durationMs}ms`
  const seconds = durationMs / 1000
  if (seconds < 60) return `${Number(seconds.toFixed(1))}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}m ${remainder}s`
}

export default function PlatformInstanceWorkspacePage() {
  const params = useParams<{ lang?: string; slug?: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const locale = resolveLocaleOrDefault(params?.lang)
  const slug = params?.slug ?? ""
  const messages = getMessages(locale)
  const tDeployments = messages.console.app.deployments

  const rawTab = searchParams.get("tab") || "overview"
  const rawSection = searchParams.get("section")
  const activeWorkspaceTab: WorkspaceTabKey =
    rawTab === "env" || rawTab === "settings"
      ? "settings"
      : (rawTab as WorkspaceTabKey)

  const settingsSubTab: SettingsSubTab = resolveSettingsSubTab(rawSection)

  const handleSelectSubTab = (subTab: SettingsSubTab) => {
    router.replace(
      `/${locale}/console/app/platform/${slug}?tab=settings&section=${subTab}`,
      { scroll: false }
    )
  }

  const [apps, setApps] = useState<StackSummaryDTO[]>([])
  const [overview, setOverview] = useState<{
    stack: StackSummaryDTO
    latestDeployment: DeploymentStatusDTO | null
  } | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  // Deployments state
  const [history, setHistory] = useState<DeploymentHistoryDTO[]>([])
  const [historyMeta, setHistoryMeta] = useState<HistoryMeta | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(null)
  const [logScope, setLogScope] = useState<DeployLogScope>("all")
  const [syncing, setSyncing] = useState(false)

  // Logs state
  const [logs, setLogs] = useState<LogMessage[]>([])

  // Settings / Env state
  const [selectedEnv] = useState<K8sEnvironmentId>("prod")
  const [envVars, setEnvVars] = useState<Record<K8sEnvironmentId, EnvVar[]>>({
    dev: [],
    staging: [],
    prod: [],
  })
  const [domains] = useState<TenantDomainDTO[]>([])
  const [domainsLoading] = useState(false)
  const [domainsError] = useState<string | null>(null)
  const [replicas, setReplicas] = useState(1)
  const [mounts, setMounts] = useState<Record<K8sEnvironmentId, VolumeMount[]>>(
    {
      dev: [],
      staging: [],
      prod: [],
    }
  )
  // Load apps list for switcher
  useEffect(() => {
    let cancelled = false
    const loadApps = async () => {
      try {
        const { data: payload } = await eden.api.deploy.apps.get()
        if (payload?.ok && Array.isArray(payload.data) && !cancelled) {
          setApps(payload.data)
        }
      } catch {
        // non-blocking for apps list
      }
    }
    void loadApps()
    return () => {
      cancelled = true
    }
  }, [])

  // Load app overview
  useEffect(() => {
    if (!slug) return
    let cancelled = false

    const loadOverview = async () => {
      setOverviewLoading(true)
      setOverviewError(null)
      try {
        const { data: payload } = await eden.api.deploy.apps[slug].get()
        if (!payload || !payload.ok || !payload.data) {
          throw new Error(payload?.message ?? "Unable to load platform.")
        }
        if (!cancelled) setOverview(payload.data)
      } catch (err) {
        if (!cancelled) {
          setOverview(null)
          setOverviewError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setOverviewLoading(false)
      }
    }

    void loadOverview()
    return () => {
      cancelled = true
    }
  }, [slug])

  // Load deployment history if on deployments tab
  useEffect(() => {
    if (!slug || activeWorkspaceTab !== "deployments") return
    let cancelled = false

    const loadHistory = async () => {
      setHistoryLoading(true)
      try {
        const { data: payload } = await eden.api.deploy.apps[slug].history.get({
          $query: { page: historyPage, pageSize: 20 },
        })
        if (payload?.ok && Array.isArray(payload.data) && !cancelled) {
          setHistory(payload.data)
          if (payload.meta) setHistoryMeta(payload.meta)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load deployment history:", error)
        }
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }

    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [slug, activeWorkspaceTab, historyPage])

  const handleSync = async () => {
    if (!slug) return
    setSyncing(true)
    try {
      const { data: syncRes } = await eden.api.deploy.apps[slug].sync.post()
      if (syncRes?.ok) {
        const { data: payload } = await eden.api.deploy.apps[slug].get()
        if (payload?.ok && payload.data) {
          setOverview(payload.data)
        }
        toast.success(
          locale === "id"
            ? "Konfigurasi berhasil disinkronkan!"
            : "Configuration synced successfully!"
        )
      } else {
        toast.error("Sync failed.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  const selectedDeployment =
    history.find((d) => d.id === selectedDeploymentId) ?? null
  const selectedStatus: DeploymentStatusDTO | null = selectedDeployment
    ? {
        id: selectedDeployment.id,
        status: selectedDeployment.status,
        attempt: selectedDeployment.attempt,
        manifestPushed: false,
        argocdSynced: false,
        failureReason: selectedDeployment.failureReason,
        startedAt: selectedDeployment.startedAt,
        completedAt: selectedDeployment.completedAt,
      }
    : (overview?.latestDeployment ?? null)

  const domainCallbacks = {
    onAddDomain: async () => undefined,
    onDeleteDomain: async () => undefined,
    onVerifyDomain: async () => undefined,
    onUploadCertificate: async () => undefined,
    onUpdateAllowlist: async () => undefined,
    onAddAllowlistEntry: async () => undefined,
    onDeleteAllowlistEntry: async () => undefined,
    onRetry: async () => undefined,
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
      {overviewLoading ? (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Loading platform workspace for {slug}…
        </div>
      ) : overviewError ? (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
          role="alert"
        >
          <p className="font-semibold">Failed to load platform</p>
          <p className="mt-1 text-xs">{overviewError}</p>
        </div>
      ) : overview ? (
        <div className="space-y-6">
          {/* Unified Workspace Sticky Header */}
          <AppWorkspaceHeader
            apps={apps}
            selectedApp={overview.stack}
            activeTab={activeWorkspaceTab}
            locale={locale}
            onSync={handleSync}
            isSyncing={syncing}
          />

          {/* Template Update Banner */}
          {overview.stack.templateUpdate?.hasUpdate && (
            <TemplateUpdateBanner
              stack={overview.stack}
              locale={locale}
              onUpdated={async () => {
                const { data: payload } = await eden.api.deploy.apps[slug].get()
                if (payload?.ok && payload.data) {
                  setOverview(payload.data)
                }
              }}
            />
          )}

          {/* TAB 1: OVERVIEW */}
          {activeWorkspaceTab === "overview" && (
            <AppOverviewTab stack={overview.stack} locale={locale} />
          )}

          {/* TAB 2: DEPLOYMENTS */}
          {activeWorkspaceTab === "deployments" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    {tDeployments.historyTitle}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {historyMeta
                      ? `${historyMeta.total} ${locale === "id" ? "rilis tercatat" : "recorded releases"}`
                      : tDeployments.historyDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <p className="p-4 text-xs text-muted-foreground">
                      {tDeployments.loadingHistory}
                    </p>
                  ) : history.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      {tDeployments.noAttempts}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead>{tDeployments.table.status}</TableHead>
                            <TableHead>{tDeployments.table.attempt}</TableHead>
                            <TableHead>{tDeployments.table.duration}</TableHead>
                            <TableHead>{tDeployments.table.commit}</TableHead>
                            <TableHead>{tDeployments.table.failure}</TableHead>
                            <TableHead>{tDeployments.table.started}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((d) => (
                            <TableRow
                              key={d.id}
                              onClick={() => setSelectedDeploymentId(d.id)}
                              className="cursor-pointer hover:bg-muted/30"
                              data-state={
                                d.id === selectedDeploymentId
                                  ? "selected"
                                  : undefined
                              }
                            >
                              <TableCell>
                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                    STATUS_TONE[d.status] ?? STATUS_TONE.idle
                                  }`}
                                >
                                  {DEPLOY_STATUS_LABELS[d.status] ?? d.status}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                #{d.attempt}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDuration(d.durationMs)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {d.commitSha ? d.commitSha.slice(0, 7) : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {d.failureReason ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {d.startedAt
                                  ? new Date(d.startedAt).toLocaleString(locale)
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {(historyMeta?.totalPages ?? 0) > 1 && (
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {tDeployments.pageOf
                              .replace(
                                "{page}",
                                String(historyMeta?.page ?? historyPage)
                              )
                              .replace(
                                "{total}",
                                String(historyMeta?.totalPages ?? 1)
                              )}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={historyPage <= 1}
                              onClick={() =>
                                setHistoryPage((p) => Math.max(1, p - 1))
                              }
                            >
                              {tDeployments.previous}
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={
                                historyPage >= (historyMeta?.totalPages ?? 1)
                              }
                              onClick={() =>
                                setHistoryPage((p) =>
                                  Math.min(historyMeta?.totalPages ?? 1, p + 1)
                                )
                              }
                            >
                              {tDeployments.next}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <AppMonitor
                stack={overview.stack}
                deployment={selectedStatus}
                logScope={logScope}
                onLogScopeChange={setLogScope}
                liveDomain={
                  overview.stack.customDomain || overview.stack.subdomain || ""
                }
                locale={locale}
                hideSummaryHeader={true}
              />
            </div>
          )}

          {/* TAB 3: LOGS */}
          {activeWorkspaceTab === "logs" && (
            <TabLogs
              logs={logs}
              setLogs={setLogs}
              diagnosticMode="production"
              appSlug={slug}
            />
          )}

          {/* TAB 4: METRICS */}
          {activeWorkspaceTab === "metrics" && (
            <TabMetrics
              appSlug={slug}
              cpuLimit={overview.stack.resourcePlanId ? "0.5" : undefined}
              memLimit="512MB"
              locale={locale}
            />
          )}

          {/* TAB 5: TRAFFIC */}
          {activeWorkspaceTab === "traffic" && (
            <TabTraffic appSlug={slug} locale={locale} />
          )}

          {/* TAB 5: SETTINGS */}
          {activeWorkspaceTab === "settings" && (
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              {/* Left Column: Vertical Sub-Navigation */}
              <nav
                aria-label="Platform Settings"
                className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2 lg:col-span-3"
              >
                <div className="mb-1 px-3 py-1.5">
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Settings
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectSubTab("env")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                    settingsSubTab === "env"
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Key
                    size={16}
                    className={
                      settingsSubTab === "env"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="flex-1">Environment Variables</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSubTab("domains")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                    settingsSubTab === "domains"
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Globe
                    size={16}
                    className={
                      settingsSubTab === "domains"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="flex-1">Domains & SSL</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSubTab("scaling")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                    settingsSubTab === "scaling"
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Cpu
                    size={16}
                    className={
                      settingsSubTab === "scaling"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="flex-1">Scaling & Resources</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSubTab("mounts")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                    settingsSubTab === "mounts"
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <HardDrive
                    size={16}
                    className={
                      settingsSubTab === "mounts"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="flex-1">Storage Mounts</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSubTab("build")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                    settingsSubTab === "build"
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Wrench
                    size={16}
                    className={
                      settingsSubTab === "build"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="flex-1">Build & Deploy</span>
                </button>

                <div className="my-1.5 border-t border-border" />

                <button
                  type="button"
                  onClick={() => handleSelectSubTab("danger")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                    settingsSubTab === "danger"
                      ? "bg-destructive/15 font-semibold text-destructive"
                      : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  )}
                >
                  <WarningOctagon
                    size={16}
                    className={
                      settingsSubTab === "danger"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  />
                  <span className="flex-1">Danger Zone</span>
                </button>
              </nav>

              {/* Right Column: Settings Content */}
              <div className="min-w-0 lg:col-span-9">
                {settingsSubTab === "env" && (
                  <TabEnv
                    selectedEnv={selectedEnv}
                    envVars={envVars}
                    setEnvVars={setEnvVars}
                    stackId={overview.stack.id}
                  />
                )}
                {settingsSubTab === "domains" && (
                  <TabDomains
                    stackSlug={overview.stack.slug}
                    apiDomains={domains}
                    api={domainCallbacks}
                    domainsLoading={domainsLoading}
                    domainsError={domainsError}
                  />
                )}
                {settingsSubTab === "scaling" && (
                  <TabScaling replicas={replicas} setReplicas={setReplicas} />
                )}
                {settingsSubTab === "mounts" && (
                  <TabMounts
                    selectedEnv={selectedEnv}
                    mounts={mounts}
                    setMounts={setMounts}
                  />
                )}
                {settingsSubTab === "build" && <TabBuild />}
                {settingsSubTab === "danger" && (
                  <TabDanger stack={overview.stack} />
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
