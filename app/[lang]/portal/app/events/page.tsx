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
import { TabEvents } from "@/modules/deploy/ui/operate/tab-events"
import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import type {
  DeploymentStatusDTO,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"

const APP_QUERY_KEY = "app"

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

export default function PortalEventsPage() {
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
    const current = searchParams.get(APP_QUERY_KEY)
    if (current === selectedSlug) return

    const next = new URLSearchParams(searchParams.toString())
    if (selectedSlug) {
      next.set(APP_QUERY_KEY, selectedSlug)
    } else {
      next.delete(APP_QUERY_KEY)
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [selectedSlug, pathname, router, searchParams])

  useEffect(() => {
    if (!selectedSlug) {
      queueMicrotask(() => setOverview(null))
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

  const selectedApp = apps.find((a) => a.slug === selectedSlug)

  return (
    <LifecyclePageShell
      title={messages.console.app.events.heading}
      description={messages.console.app.events.description}
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
                <TabEvents />
              </>
            ) : selectedApp ? (
              <TabEvents />
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                Select an application to view its deploy events.
              </div>
            )}
          </>
        )}
      </div>
    </LifecyclePageShell>
  )
}
