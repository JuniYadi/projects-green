"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowsClockwise } from "@phosphor-icons/react"
import { toast } from "sonner"
import { eden } from "@/lib/eden"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
import { AppMonitor } from "@/modules/deploy/ui/operate/app-monitor"
import { TabLogs } from "@/modules/deploy/ui/operate/tab-logs"
import { TabMetrics } from "@/modules/deploy/ui/operate/tab-metrics"
import { TabEnv } from "@/modules/deploy/ui/operate/tab-env"
import { TabDomains } from "@/modules/deploy/ui/operate/tab-domains"
import { TabScaling } from "@/modules/deploy/ui/operate/tab-scaling"
import { TabMounts } from "@/modules/deploy/ui/operate/tab-mounts"
import { TabGeneral } from "@/app/[lang]/console/app/settings/_components/tab-general"
import { TabBuild } from "@/app/[lang]/console/app/settings/_components/tab-build"
import { TabDanger } from "@/app/[lang]/console/app/settings/_components/tab-danger"
import { INITIAL_LOGS } from "@/modules/deploy/operate.mock"

type HistoryMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type AppClient = {
  deployments?: {
    get: (opts: { query: { page: number; pageSize: number } }) => Promise<{
      data?: {
        ok?: boolean
        data?: DeploymentHistoryDTO[]
        meta?: HistoryMeta
      }
    }>
  }
  sync?: {
    post: () => Promise<{ data?: unknown }>
  }
}

type SettingsSubTab =
  "env" | "domains" | "scaling" | "mounts" | "build" | "general" | "danger"

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
  const searchParams = useSearchParams()

  const locale = resolveLocaleOrDefault(params?.lang)
  const slug = params?.slug ?? ""

  const rawTab = searchParams.get("tab") || "overview"
  const activeWorkspaceTab: WorkspaceTabKey =
    rawTab === "env" || rawTab === "settings"
      ? "settings"
      : (rawTab as WorkspaceTabKey)

  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>(
    rawTab === "settings" ? "general" : "env"
  )

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
  const [logs, setLogs] = useState<LogMessage[]>(INITIAL_LOGS)

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
        const client = (
          eden.api.deploy.apps as unknown as Record<string, AppClient>
        )[slug]
        if (client?.deployments) {
          const { data: payload } = await client.deployments.get({
            query: { page: historyPage, pageSize: 20 },
          })
          if (payload?.ok && Array.isArray(payload.data) && !cancelled) {
            setHistory(payload.data)
            if (payload.meta) setHistoryMeta(payload.meta)
          }
        }
      } catch {
        // history fetch error
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
      const client = (
        eden.api.deploy.apps as unknown as Record<string, AppClient>
      )[slug]
      if (client?.sync) {
        await client.sync.post()
        toast.success("Configuration synced successfully!")
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

          {/* TAB 1: OVERVIEW */}
          {activeWorkspaceTab === "overview" && (
            <AppOverviewTab stack={overview.stack} locale={locale} />
          )}

          {/* TAB 2: DEPLOYMENTS */}
          {activeWorkspaceTab === "deployments" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Deployment History
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {historyMeta
                        ? `${historyMeta.total} recorded releases`
                        : "Past deployments and releases"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <ArrowsClockwise
                      size={14}
                      className={syncing ? "animate-spin" : ""}
                    />
                    <span>{syncing ? "Syncing..." : "Sync Config"}</span>
                  </Button>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <p className="p-4 text-xs text-muted-foreground">
                      Loading history...
                    </p>
                  ) : history.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No deployments recorded yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead>Status</TableHead>
                            <TableHead>Attempt</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Commit</TableHead>
                            <TableHead>Failure Reason</TableHead>
                            <TableHead>Started</TableHead>
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
                            Page {historyMeta?.page ?? historyPage} of{" "}
                            {historyMeta?.totalPages}
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
                              Previous
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
                              Next
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
            />
          )}

          {/* TAB 4: METRICS */}
          {activeWorkspaceTab === "metrics" && (
            <TabMetrics
              cpuLimit={overview.stack.resourcePlanId ? "0.5" : undefined}
              memLimit="512MB"
            />
          )}

          {/* TAB 5: SETTINGS & ENV */}
          {activeWorkspaceTab === "settings" && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
                {(
                  [
                    ["env", "Environment Variables"],
                    ["domains", "Domains & SSL"],
                    ["scaling", "Scaling & Resources"],
                    ["mounts", "Storage Mounts"],
                    ["build", "Build & Deploy"],
                    ["general", "General Info"],
                    ["danger", "Danger Zone"],
                  ] as const
                ).map(([subTab, label]) => (
                  <Button
                    key={subTab}
                    type="button"
                    variant={settingsSubTab === subTab ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSettingsSubTab(subTab)}
                    className="h-8 text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>

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
              {settingsSubTab === "general" && (
                <TabGeneral
                  stack={overview.stack}
                  lastDeployedAt={overview.stack.lastDeployedAt}
                />
              )}
              {settingsSubTab === "danger" && (
                <TabDanger stack={overview.stack} />
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
