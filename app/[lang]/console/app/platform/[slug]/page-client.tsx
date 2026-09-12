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
  DomainAllowlistMode,
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
import { TabTerminal } from "@/modules/deploy/ui/operate/tab-terminal"
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
type SettingsApiPayload<T = unknown> = {
  ok?: boolean
  data?: T
  message?: string
}

type SettingsMethod = (
  options?: unknown
) => Promise<{ data?: SettingsApiPayload<unknown> }>

type SettingsRouteClient = {
  get: SettingsMethod
  patch: SettingsMethod
  delete: SettingsMethod
  post: SettingsMethod
  put: SettingsMethod
}

type DomainActionClient = SettingsRouteClient & {
  verify: SettingsRouteClient
  certificate: SettingsRouteClient
  allowlist: SettingsRouteClient & {
    entries: MountRouteClient
  }
}

type DomainRouteClient = SettingsRouteClient & {
  [key: string]: DomainActionClient
}

type MountRouteClient = SettingsRouteClient & {
  [key: string]: SettingsRouteClient
}

type AppSettingsClient = SettingsRouteClient & {
  settings: {
    get: SettingsMethod
    env: SettingsRouteClient
    mounts: MountRouteClient
  }
  domains: DomainRouteClient
}

const getAppClient = (slug: string): AppSettingsClient =>
  (eden.api.deploy.apps as unknown as Record<string, AppSettingsClient>)[slug]

const emptyEnvVars = (): Record<K8sEnvironmentId, EnvVar[]> => ({
  dev: [],
  staging: [],
  prod: [],
})

const emptyMounts = (): Record<K8sEnvironmentId, VolumeMount[]> => ({
  dev: [],
  staging: [],
  prod: [],
})

const asEnvironmentRecord = <T,>(
  value: unknown,
  fallback: Record<K8sEnvironmentId, T[]>
): Record<K8sEnvironmentId, T[]> => {
  if (!value || typeof value !== "object") return fallback
  const source = value as Record<string, unknown>
  return {
    dev: Array.isArray(source.dev) ? (source.dev as T[]) : [],
    staging: Array.isArray(source.staging) ? (source.staging as T[]) : [],
    prod: Array.isArray(source.prod) ? (source.prod as T[]) : [],
  }
}

const readSettingsData = (payload: SettingsApiPayload<unknown>) => {
  const data = payload.data
  if (!data || typeof data !== "object") {
    return { envVars: emptyEnvVars(), mounts: emptyMounts() }
  }
  const settings = data as { envVars?: unknown; mounts?: unknown }
  const rawEnvVars = Array.isArray(settings.envVars)
    ? { ...emptyEnvVars(), prod: settings.envVars }
    : asEnvironmentRecord<unknown>(settings.envVars, emptyEnvVars())
  const normalizeEnvVar = (raw: unknown): EnvVar => {
    const item = raw && typeof raw === "object" ? raw : {}
    const value = item as Record<string, unknown>
    const type =
      value.type === "plain" ||
      value.type === "secret" ||
      value.type === "secret_ref" ||
      value.type === "secret_shared_ref"
        ? value.type
        : undefined
    const source =
      value.source === "vault" || value.source === "managed_service"
        ? value.source
        : undefined
    const secret =
      value.masked === true ||
      value.isStoredSecret === true ||
      type === "secret" ||
      type === "secret_ref" ||
      type === "secret_shared_ref"
    return {
      id: String(value.id ?? value.key ?? "env-var"),
      key: String(value.key ?? ""),
      value: typeof value.value === "string" ? value.value : "",
      isSecret: secret,
      updatedAt: String(value.lastUpdatedAt ?? value.updatedAt ?? ""),
      ...(type ? { type } : {}),
      scope:
        value.scope === "all" ||
        value.scope === "build" ||
        value.scope === "runtime"
          ? value.scope
          : "runtime",
      masked: secret,
      ...(source ? { source } : {}),
      ...(typeof value.serviceCredentialId === "string"
        ? { serviceCredentialId: value.serviceCredentialId }
        : {}),
      ...(typeof value.vaultPath === "string"
        ? { vaultPath: value.vaultPath }
        : {}),
      ...(typeof value.vaultKey === "string"
        ? { vaultKey: value.vaultKey }
        : {}),
      ...(typeof value.referenceLabel === "string"
        ? { referenceLabel: value.referenceLabel }
        : {}),
    }
  }
  const envVars = Object.fromEntries(
    (Object.keys(rawEnvVars) as K8sEnvironmentId[]).map((environmentId) => [
      environmentId,
      rawEnvVars[environmentId].map(normalizeEnvVar),
    ])
  ) as Record<K8sEnvironmentId, EnvVar[]>
  const rawMounts = asEnvironmentRecord<Record<string, unknown>>(
    settings.mounts,
    emptyMounts()
  )
  const mounts = Object.fromEntries(
    (Object.keys(rawMounts) as K8sEnvironmentId[]).map((environmentId) => [
      environmentId,
      rawMounts[environmentId].map((raw) => ({
        id: String(raw.id ?? `mount-${environmentId}`),
        name: String(raw.name ?? "mount"),
        mountPath: String(raw.mountPath ?? "/data"),
        sourceType:
          raw.type === "configmap" ||
          raw.type === "pvc" ||
          raw.type === "emptyDir"
            ? raw.type
            : "secret",
        fileMode: String(raw.defaultMode ?? "0400"),
        readOnly: raw.readOnly !== false,
        contentSummary: String(raw.contentSummary ?? "[REDACTED]"),
      })),
    ])
  ) as Record<K8sEnvironmentId, VolumeMount[]>
  return { envVars, mounts }
}
const toPersistedMount = (mount: VolumeMount) => ({
  id: mount.id,
  type: mount.sourceType,
  name: mount.name,
  mountPath: mount.mountPath,
  readOnly: mount.readOnly,
  ...(mount.fileMode
    ? { defaultMode: Number.parseInt(mount.fileMode, 8) }
    : {}),
  ...(mount.content !== undefined ? { content: mount.content } : {}),
})
const toPersistedEnvVar = (row: EnvVar) => ({
  id: row.id,
  key: row.key,
  value: row.value,
  type: row.type,
  scope: row.scope,
  masked: row.masked,
  isStoredSecret: row.isStoredSecret,
  ...(row.source ? { source: row.source } : {}),
  ...(row.serviceCredentialId
    ? { serviceCredentialId: row.serviceCredentialId }
    : {}),
  ...(row.vaultPath ? { vaultPath: row.vaultPath } : {}),
  ...(row.vaultKey ? { vaultKey: row.vaultKey } : {}),
  ...(row.referenceLabel ? { referenceLabel: row.referenceLabel } : {}),
})

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
  const selectedEnv: K8sEnvironmentId = "prod"
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
  const [envVars, setEnvVars] =
    useState<Record<K8sEnvironmentId, EnvVar[]>>(emptyEnvVars)
  const [domains, setDomains] = useState<TenantDomainDTO[]>([])
  const [domainsLoading, setDomainsLoading] = useState(false)
  const [domainsError, setDomainsError] = useState<string | null>(null)
  const [replicas, setReplicas] = useState(1)
  const [mounts, setMounts] =
    useState<Record<K8sEnvironmentId, VolumeMount[]>>(emptyMounts)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
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
  useEffect(() => {
    if (!slug || !overview) return
    let cancelled = false

    const loadSettings = async () => {
      setSettingsLoading(true)
      setSettingsError(null)
      setDomainsLoading(true)
      setDomainsError(null)
      try {
        const [{ data: settingsPayload }, { data: domainsPayload }] =
          await Promise.all([
            getAppClient(slug).settings.get(),
            getAppClient(slug).domains.get(),
          ])
        if (!settingsPayload?.ok) {
          throw new Error(
            settingsPayload?.message ?? "Unable to load application settings."
          )
        }
        if (!domainsPayload?.ok) {
          throw new Error(domainsPayload?.message ?? "Unable to load domains.")
        }
        if (cancelled) return
        const settings = readSettingsData(settingsPayload)
        setEnvVars(settings.envVars)
        setMounts(settings.mounts)
        const domainData = domainsPayload.data
        setDomains(
          Array.isArray(domainData)
            ? (domainData as TenantDomainDTO[])
            : domainData &&
                typeof domainData === "object" &&
                Array.isArray((domainData as { domains?: unknown }).domains)
              ? (domainData as { domains: TenantDomainDTO[] }).domains
              : []
        )
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setSettingsError(message)
          setDomainsError(message)
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false)
          setDomainsLoading(false)
        }
      }
    }

    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [slug, overview])

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

  const refreshSettings = async () => {
    const { data: payload } = await getAppClient(slug).settings.get()
    if (!payload?.ok) {
      throw new Error(
        payload?.message ?? "Unable to load application settings."
      )
    }
    const settings = readSettingsData(payload)
    setEnvVars(settings.envVars)
    setMounts(settings.mounts)
    setSettingsError(null)
  }

  const persistEnvVars = async (rows: EnvVar[]) => {
    const { data: payload } = await getAppClient(slug).settings.env.patch({
      environmentId: selectedEnv,
      variables: rows.map(toPersistedEnvVar),
    })
    if (!payload?.ok) {
      throw new Error(
        payload?.message ?? "Unable to save environment variables."
      )
    }
    await refreshSettings()
  }

  const persistMountAdd = async (
    environmentId: K8sEnvironmentId,
    mount: VolumeMount
  ) => {
    const { data: payload } = await getAppClient(slug).settings.mounts.patch({
      environmentId,
      mounts: [
        ...mounts[environmentId].map(toPersistedMount),
        toPersistedMount(mount),
      ],
    })
    if (!payload?.ok) {
      throw new Error(payload?.message ?? "Unable to save mounts.")
    }
    await refreshSettings()
  }

  const persistMountDelete = async (
    environmentId: K8sEnvironmentId,
    mountId: string
  ) => {
    const { data: payload } = await getAppClient(slug).settings.mounts[
      mountId
    ].delete({
      $query: { environmentId },
    })
    if (!payload?.ok) {
      throw new Error(payload?.message ?? "Unable to delete mount.")
    }
    await refreshSettings()
  }

  const refreshDomains = async () => {
    const { data: payload } = await getAppClient(slug).domains.get()
    if (!payload?.ok) {
      throw new Error(payload?.message ?? "Unable to load domains.")
    }
    const data = payload.data
    setDomains(
      Array.isArray(data)
        ? (data as TenantDomainDTO[])
        : data &&
            typeof data === "object" &&
            Array.isArray((data as { domains?: unknown }).domains)
          ? (data as { domains: TenantDomainDTO[] }).domains
          : []
    )
    setDomainsError(null)
  }

  const refreshAfterDomainMutation = async (
    action: () => Promise<{ data?: SettingsApiPayload<unknown> }>
  ) => {
    const { data: payload } = await action()
    if (!payload?.ok) {
      throw new Error(payload?.message ?? "Unable to update domain settings.")
    }
    await refreshDomains()
  }

  const domainCallbacks = {
    onAddDomain: (hostname: string) =>
      refreshAfterDomainMutation(() =>
        getAppClient(slug).domains.post({ hostname, kind: "CUSTOM" })
      ),
    onDeleteDomain: (domainId: string) =>
      refreshAfterDomainMutation(() =>
        getAppClient(slug).domains[domainId].delete()
      ),
    onVerifyDomain: (domainId: string) =>
      refreshAfterDomainMutation(() =>
        getAppClient(slug).domains[domainId].verify.post({})
      ),
    onUploadCertificate: (
      domainId: string,
      input: { certificatePem: string; privateKeyPem: string; chainPem: string }
    ) =>
      refreshAfterDomainMutation(() =>
        getAppClient(slug).domains[domainId].certificate.put({
          certificate: input.certificatePem,
          privateKey: input.privateKeyPem,
          chain: input.chainPem || undefined,
        })
      ),
    onUpdateAllowlist: (domainId: string, mode: DomainAllowlistMode) =>
      refreshAfterDomainMutation(() =>
        getAppClient(slug).domains[domainId].allowlist.put({ mode })
      ),
    onAddAllowlistEntry: (
      domainId: string,
      input: { cidr: string; label?: string }
    ) =>
      refreshAfterDomainMutation(() =>
        getAppClient(slug).domains[domainId].allowlist.entries.post({
          cidr: input.cidr,
          description: input.label,
        })
      ),
    onDeleteAllowlistEntry: (domainId: string, entryId: string) =>
      refreshAfterDomainMutation(() =>
        getAppClient(slug).domains[domainId].allowlist.entries[entryId].delete()
      ),
    onRetry: refreshDomains,
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

          {/* TAB: TERMINAL */}
          {activeWorkspaceTab === "terminal" && (
            <TabTerminal
              stackId={overview.stack.id}
              slug={overview.stack.slug}
              locale={locale}
            />
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
                  <span className="flex-1">
                    {messages.console.app.settings.tabs.domains}
                  </span>
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
                {settingsLoading ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    Loading application settings…
                  </div>
                ) : settingsError ? (
                  <div
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
                    role="alert"
                  >
                    <p className="font-semibold">
                      Failed to load application settings
                    </p>
                    <p className="mt-1 text-xs">{settingsError}</p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => void refreshSettings()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <>
                    {settingsSubTab === "env" && (
                      <TabEnv
                        selectedEnv={selectedEnv}
                        envVars={envVars}
                        setEnvVars={setEnvVars}
                        onPersist={async (rows) => {
                          try {
                            await persistEnvVars(rows)
                          } catch (error) {
                            const message =
                              error instanceof Error
                                ? error.message
                                : String(error)
                            setSettingsError(message)
                            toast.error(message)
                          }
                        }}
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
                        messages={messages.console.app.settings.domainsPanel}
                      />
                    )}
                    {settingsSubTab === "scaling" && (
                      <TabScaling
                        replicas={replicas}
                        setReplicas={setReplicas}
                      />
                    )}
                    {settingsSubTab === "mounts" && (
                      <TabMounts
                        selectedEnv={selectedEnv}
                        mounts={mounts}
                        setMounts={setMounts}
                        onAddMount={persistMountAdd}
                        onDeleteMount={persistMountDelete}
                      />
                    )}
                    {settingsSubTab === "build" && <TabBuild />}
                    {settingsSubTab === "danger" && (
                      <TabDanger stack={overview.stack} />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
