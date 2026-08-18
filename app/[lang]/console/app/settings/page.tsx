"use client"

import { useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import {
  useParams,
  useRouter,
  usePathname,
  useSearchParams,
} from "next/navigation"

import { Button } from "@/components/ui/button"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"
import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import { TabDomains } from "@/modules/deploy/ui/operate/tab-domains"
import { TabEnv } from "@/modules/deploy/ui/operate/tab-env"
import { TabScaling } from "@/modules/deploy/ui/operate/tab-scaling"
import { TabMounts } from "@/modules/deploy/ui/operate/tab-mounts"
import { TabGeneral } from "./_components/tab-general"
import { TabBuild } from "./_components/tab-build"
import { TabDanger } from "./_components/tab-danger"
import type {
  DeploymentStatusDTO,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"
import type {
  DomainAllowlistMode,
  EnvVar,
  K8sEnvironmentId,
  TenantDomainDTO,
  VolumeMount,
} from "@/modules/deploy/operate.types"

const APP_QUERY_KEY = "app"
const TAB_QUERY_KEY = "tab"

type SettingsTab =
  | "general"
  | "domains"
  | "env"
  | "scaling"
  | "mounts"
  | "build"
  | "danger"

type DomainApiResponse<T = unknown> = {
  ok?: boolean
  data?: T
  message?: string
}

type DomainApiClient = {
  get: () => Promise<{ data?: DomainApiResponse<unknown> }>
  post: (options?: unknown) => Promise<{ data?: DomainApiResponse<unknown> }>
  delete: (options?: unknown) => Promise<{ data?: DomainApiResponse<unknown> }>
  put: (options?: unknown) => Promise<{ data?: DomainApiResponse<unknown> }>
}

type DomainRouteClient = DomainApiClient & {
  [id: string]: DomainApiClient | DomainRouteClient
  verify: DomainApiClient
  certificate: DomainApiClient
  allowlist: DomainApiClient & {
    entries: DomainApiClient & { [id: string]: DomainApiClient }
  }
}

type AppDomainClient = DomainApiClient & {
  domains: DomainRouteClient
}

const getDomainClient = (slug: string): AppDomainClient =>
  (eden.api.deploy.apps as unknown as Record<string, AppDomainClient>)[slug]

const readDomainRecords = (
  payload: DomainApiResponse<unknown>
): TenantDomainDTO[] => {
  const data = payload.data
  if (Array.isArray(data)) return data as TenantDomainDTO[]
  if (
    data &&
    typeof data === "object" &&
    "domains" in data &&
    Array.isArray(data.domains)
  ) {
    return data.domains as TenantDomainDTO[]
  }
  return []
}

const unwrapDomainMutation = (
  payload: DomainApiResponse<unknown> | undefined
) => {
  if (!payload?.ok)
    throw new Error(payload?.message ?? "Unable to update domain settings.")
}

const TAB_LABELS: Record<SettingsTab, string> = {
  general: "General",
  domains: "Domains",
  env: "Environment",
  scaling: "Scaling",
  mounts: "Mounts",
  build: "Build",
  danger: "Danger Zone",
}

const STATUS_TONE: Record<string, string> = {
  running: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  failed: "border-rose-500/20 bg-rose-500/5 text-rose-400",
  building: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  deploying: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  queued: "border-amber-500/20 bg-amber-500/5 text-amber-400",
  idle: "border-border bg-muted/30 text-muted-foreground",
}

const findDefaultSlug = (
  apps: StackSummaryDTO[],
  preferred: string | null
): string | null => {
  if (preferred && apps.some((a) => a.slug === preferred)) return preferred
  return apps[0]?.slug ?? null
}

function resolveTab(raw: string | null): SettingsTab {
  const validTabs: SettingsTab[] = [
    "general",
    "domains",
    "env",
    "scaling",
    "mounts",
    "build",
    "danger",
  ]
  if (raw && validTabs.includes(raw as SettingsTab)) {
    return raw as SettingsTab
  }
  return "general"
}

export default function SettingsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [apps, setApps] = useState<StackSummaryDTO[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [appsError, setAppsError] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() =>
    searchParams.get(APP_QUERY_KEY)
  )
  const [appsRetry, setAppsRetry] = useState(0)

  const [overview, setOverview] = useState<{
    stack: StackSummaryDTO
    latestDeployment: DeploymentStatusDTO | null
  } | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    resolveTab(searchParams.get(TAB_QUERY_KEY))
  )

  // Tab state records for environment/mount/scaling
  const [selectedEnv] = useState<K8sEnvironmentId>("prod")
  const [apiDomains, setApiDomains] = useState<TenantDomainDTO[]>([])
  const [domainsLoading, setDomainsLoading] = useState(false)
  const [domainsError, setDomainsError] = useState<string | null>(null)
  const [envVars, setEnvVars] = useState<Record<K8sEnvironmentId, EnvVar[]>>({
    dev: [],
    staging: [],
    prod: [],
  })
  const [mounts, setMounts] = useState<Record<K8sEnvironmentId, VolumeMount[]>>(
    {
      dev: [],
      staging: [],
      prod: [],
    }
  )
  const [replicas, setReplicas] = useState(1)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setAppsLoading(true)
      setAppsError(null)

      try {
        const { data: payload } = await eden.api.deploy.apps.get()
        if (!payload || !payload.ok || !Array.isArray(payload.data)) {
          throw new Error(payload?.message ?? "Unable to load applications.")
        }

        if (cancelled) return

        const defaultSlug = findDefaultSlug(payload.data, selectedSlug)
        setApps(payload.data)
        setSelectedSlug(defaultSlug)
      } catch (cause) {
        if (cancelled) return
        setApps([])
        setAppsError(
          cause instanceof Error
            ? cause.message
            : "Unable to load applications."
        )
      } finally {
        if (!cancelled) setAppsLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appsRetry])

  useEffect(() => {
    const currentApp = searchParams.get(APP_QUERY_KEY)
    const currentTab = searchParams.get(TAB_QUERY_KEY)
    if (currentApp === selectedSlug && currentTab === activeTab) return

    const next = new URLSearchParams(searchParams.toString())
    if (selectedSlug) next.set(APP_QUERY_KEY, selectedSlug)
    else next.delete(APP_QUERY_KEY)
    if (activeTab !== "general") next.set(TAB_QUERY_KEY, activeTab)
    else next.delete(TAB_QUERY_KEY)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [selectedSlug, activeTab, pathname, router, searchParams])

  const refreshDomains = async (slug: string) => {
    setDomainsLoading(true)
    setDomainsError(null)
    try {
      const { data: payload } = await getDomainClient(slug).domains.get()
      if (!payload?.ok)
        throw new Error(payload?.message ?? "Unable to load domains.")
      setApiDomains(readDomainRecords(payload))
    } catch (cause) {
      setApiDomains([])
      const message =
        cause instanceof Error ? cause.message : "Unable to load domains."
      setDomainsError(message)
      throw cause
    } finally {
      setDomainsLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedSlug) {
      queueMicrotask(() => {
        setOverview(null)
        setApiDomains([])
        setDomainsError(null)
      })
      return
    }

    let cancelled = false
    const run = async () => {
      setOverviewLoading(true)
      setOverviewError(null)
      try {
        const { data: payload } = await eden.api.deploy.apps[selectedSlug].get()
        if (!payload || !payload.ok || !payload.data) {
          throw new Error(
            payload?.message ?? "Unable to load application state."
          )
        }
        if (cancelled) return
        setOverview(payload.data)
        try {
          await refreshDomains(selectedSlug)
        } catch {
          // The domains tab renders its own retryable error while overview remains usable.
        }
      } catch (cause) {
        if (cancelled) return
        setOverview(null)
        setOverviewError(
          cause instanceof Error
            ? cause.message
            : "Unable to load application state."
        )
      } finally {
        if (!cancelled) setOverviewLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedSlug])

  const handleAppsRetry = () => {
    setAppsRetry((v) => v + 1)
  }

  const refreshAfterDomainMutation = async (
    action: () => Promise<{ data?: DomainApiResponse<unknown> }>
  ) => {
    if (!selectedSlug) throw new Error("Select an application first.")
    const { data: payload } = await action()
    unwrapDomainMutation(payload)
    await refreshDomains(selectedSlug)
  }

  const domainApi = selectedSlug
    ? {
        onAddDomain: (hostname: string) =>
          refreshAfterDomainMutation(() =>
            getDomainClient(selectedSlug).domains.post({
              hostname,
              kind: "CUSTOM",
            })
          ),
        onDeleteDomain: (domainId: string) =>
          refreshAfterDomainMutation(() =>
            (
              getDomainClient(selectedSlug).domains as unknown as Record<
                string,
                DomainRouteClient
              >
            )[domainId].delete()
          ),
        onVerifyDomain: (domainId: string) =>
          refreshAfterDomainMutation(() =>
            (
              getDomainClient(selectedSlug).domains as unknown as Record<
                string,
                DomainRouteClient
              >
            )[domainId].verify.post({})
          ),
        onUploadCertificate: (
          domainId: string,
          input: {
            certificatePem: string
            privateKeyPem: string
            chainPem: string
          }
        ) =>
          refreshAfterDomainMutation(() =>
            (
              getDomainClient(selectedSlug).domains as unknown as Record<
                string,
                DomainRouteClient
              >
            )[domainId].certificate.put({
              certificate: input.certificatePem,
              privateKey: input.privateKeyPem,
              chain: input.chainPem || undefined,
            })
          ),
        onUpdateAllowlist: (domainId: string, mode: DomainAllowlistMode) =>
          refreshAfterDomainMutation(() =>
            (
              getDomainClient(selectedSlug).domains as unknown as Record<
                string,
                DomainRouteClient
              >
            )[domainId].allowlist.put({ mode })
          ),
        onAddAllowlistEntry: (
          domainId: string,
          input: { cidr: string; label?: string }
        ) =>
          refreshAfterDomainMutation(() =>
            (
              getDomainClient(selectedSlug).domains as unknown as Record<
                string,
                DomainRouteClient
              >
            )[domainId].allowlist.entries.post({
              cidr: input.cidr,
              description: input.label,
            })
          ),
        onDeleteAllowlistEntry: (domainId: string, entryId: string) =>
          refreshAfterDomainMutation(() =>
            (
              getDomainClient(selectedSlug).domains as unknown as Record<
                string,
                DomainRouteClient
              >
            )[domainId].allowlist.entries[entryId].delete()
          ),
        onRetry: () => refreshDomains(selectedSlug),
      }
    : null
  const renderTabContent = () => {
    if (!overview) return null

    switch (activeTab) {
      case "general":
        return (
          <TabGeneral
            stack={overview.stack}
            lastDeployedAt={overview.stack.lastDeployedAt}
          />
        )
      case "domains":
        return (
          <TabDomains
            stackSlug={overview.stack.slug}
            apiDomains={apiDomains}
            api={domainApi ?? undefined}
            domainsLoading={domainsLoading}
            domainsError={domainsError}
          />
        )
      case "env":
        return (
          <TabEnv
            selectedEnv={selectedEnv}
            envVars={envVars}
            setEnvVars={setEnvVars}
            stackId={overview.stack.id}
          />
        )
      case "scaling":
        return <TabScaling replicas={replicas} setReplicas={setReplicas} />
      case "mounts":
        return (
          <TabMounts
            selectedEnv={selectedEnv}
            mounts={mounts}
            setMounts={setMounts}
          />
        )
      case "build":
        return <TabBuild />
      case "danger":
        return <TabDanger stack={overview.stack} />
      default:
        return (
          <TabGeneral
            stack={overview.stack}
            lastDeployedAt={overview.stack.lastDeployedAt}
          />
        )
    }
  }

  return (
    <LifecyclePageShell
      title={messages.console.app.settings.heading}
      description={messages.console.app.settings.description}
    >
      <div className="space-y-6">
        {appsLoading ? (
          <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            {messages.console.app.manage.loadingApps}
          </div>
        ) : appsError ? (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            <span>{appsError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAppsRetry}
            >
              {messages.console.app.manage.retry}
            </Button>
          </div>
        ) : apps.length === 0 ? (
          <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {messages.console.app.manage.noApps}
            </p>
            <p className="text-xs text-muted-foreground">
              {messages.console.app.manage.noAppsDescription}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
              {apps.map((app) => {
                const isActive = app.slug === selectedSlug
                return (
                  <Button
                    key={app.id}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSlug(app.slug)}
                    aria-pressed={isActive}
                  >
                    {app.name}
                  </Button>
                )
              })}
            </div>

            {overviewLoading ? (
              <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                {messages.console.app.manage.loadingAppState}
              </div>
            ) : overviewError ? (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                role="alert"
              >
                <span>{overviewError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  {messages.console.app.manage.retry}
                </Button>
              </div>
            ) : overview ? (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-5 py-3 text-sm">
                  <span className="font-semibold">{overview.stack.name}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      STATUS_TONE[overview.stack.status] ?? STATUS_TONE.idle
                    }`}
                  >
                    {DEPLOY_STATUS_LABELS[overview.stack.status] ??
                      overview.stack.status}
                  </span>
                  <span className="text-muted-foreground">
                    {overview.stack.framework ?? "Unknown"} &bull;{" "}
                    {overview.stack.branchName}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
                  {(Object.entries(TAB_LABELS) as [SettingsTab, string][]).map(
                    ([tab, label]) => (
                      <Button
                        key={tab}
                        type="button"
                        variant={activeTab === tab ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveTab(tab)}
                      >
                        {label}
                      </Button>
                    )
                  )}
                </div>

                {renderTabContent()}
              </>
            ) : selectedSlug ? (
              <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                {messages.console.app.manage.loadingAppState}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                Select an application to view its settings.
              </div>
            )}
          </>
        )}
      </div>
    </LifecyclePageShell>
  )
}
