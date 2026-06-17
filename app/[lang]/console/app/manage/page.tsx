"use client"

import { useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"
import { AppMonitor } from "@/modules/deploy/ui/operate/app-monitor"
import type {
  DeploymentStatusDTO,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"
import type { DeployLogScope } from "@/modules/deploy/deploy.types"

type AppsResponse = {
  ok: boolean
  data?: StackSummaryDTO[]
  message?: string
}

type AppOverviewResponse = {
  ok: boolean
  data?: {
    stack: StackSummaryDTO
    latestDeployment: DeploymentStatusDTO | null
  }
  message?: string
}

const APP_QUERY_KEY = "app"

const findDefaultSlug = (
  apps: StackSummaryDTO[],
  preferred: string | null
): string | null => {
  if (preferred && apps.some((a) => a.slug === preferred)) return preferred
  return apps[0]?.slug ?? null
}

export default function ManagePage() {
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
  const [overview, setOverview] = useState<{
    stack: StackSummaryDTO
    latestDeployment: DeploymentStatusDTO | null
  } | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [logScope, setLogScope] = useState<DeployLogScope>("all")
  const [appsRetry, setAppsRetry] = useState(0)

  // Fetch the app list once.
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setAppsLoading(true)
      setAppsError(null)

      try {
        const { data: payload } = await eden.api.deploy.apps.get()
        if (!payload || !payload.ok || !Array.isArray(payload.data)) {
          throw new Error(payload.message ?? "Unable to load applications.")
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

  // Sync selected app to the URL for shareable deep links.
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

  // Fetch overview for the selected app.
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
            payload.message ?? "Unable to load application state."
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

  return (
    <LifecyclePageShell
      title={messages.console.app.manage.heading}
      description={messages.console.app.manage.description}
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
              Deploy a private repository from the Deploy page to start
              monitoring real status, events, and logs here.
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
              <AppMonitor
                stack={overview.stack}
                deployment={overview.latestDeployment}
                logScope={logScope}
                onLogScopeChange={setLogScope}
              />
            ) : null}
          </>
        )}
      </div>
    </LifecyclePageShell>
  )
}
