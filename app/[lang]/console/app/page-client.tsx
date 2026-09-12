"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  RocketLaunch,
  Storefront,
  ArrowRight,
  ArrowSquareOut,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { ClusterTelemetryCards } from "@/modules/deploy/ui/cluster-telemetry-cards"
import {
  DEPLOY_STATUS_LABELS,
  DEPLOY_STATUS_TONE as STATUS_TONE,
} from "@/modules/deploy/deploy.constants"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"
const formatRelativeTime = (timestamp: string, locale: string) => {
  const elapsedMs = new Date(timestamp).getTime() - Date.now()
  const absoluteMs = Math.abs(elapsedMs)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
    ["second", 1_000],
  ]
  const [unit, unitMs] =
    units.find(([, value]) => absoluteMs >= value) ?? units[units.length - 1]
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(elapsedMs / unitMs),
    unit
  )
}
export default function ApplicationsPage() {
  const params = useParams<{ lang?: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const selectedSlug = searchParams.get("app")
  const [apps, setApps] = useState<StackSummaryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: payload } = await eden.api.deploy.apps.get()
        if (!payload || !payload.ok || !Array.isArray(payload.data)) {
          throw new Error(payload?.message ?? "Unable to load applications.")
        }

        if (cancelled) return
        setApps(payload.data)
      } catch (cause) {
        if (cancelled) return
        setApps([])
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load applications."
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [retry])

  const handleRetry = () => setRetry((v) => v + 1)

  useEffect(() => {
    if (selectedSlug) {
      router.replace(
        `/${locale}/console/app/platform/${selectedSlug}?tab=overview`
      )
    }
  }, [locale, router, selectedSlug])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {messages.console.app.overview.heading}
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.console.app.overview.description}
          </p>
        </header>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
          >
            <Link
              href={localizePathname({
                pathname: "/console/app/marketplace",
                locale,
              })}
            >
              <Storefront size={14} />
              <span>Marketplace</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
            <Link
              href={localizePathname({
                pathname: "/console/app/deploy",
                locale,
              })}
            >
              <RocketLaunch size={14} />
              <span>Deploy New App</span>
            </Link>
          </Button>
        </div>
      </div>
      {/* 3 Primary Time-Series Telemetry Charts (CPU, Memory, Network I/O) */}
      {!loading && !error && <ClusterTelemetryCards />}

      {!loading && !error && apps.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Total Platforms
            </span>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {apps.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Active & Live
            </span>
            <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-500">
              {apps.filter((a) => a.status === "running").length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Deploying / Queued
            </span>
            <p className="mt-1 text-2xl font-bold tracking-tight text-sky-500">
              {
                apps.filter(
                  (a) =>
                    a.status === "building" ||
                    a.status === "queued" ||
                    a.status === "deploying"
                ).length
              }
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Needs Attention
            </span>
            <p className="mt-1 text-2xl font-bold tracking-tight text-rose-500">
              {apps.filter((a) => a.status === "failed").length}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          {messages.console.app.manage.loadingApps}
        </div>
      ) : error ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
          >
            {messages.console.app.manage.retry}
          </Button>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
          <RocketLaunch size={40} className="text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {messages.console.app.manage.noApps}
            </p>
            <p className="text-xs text-muted-foreground">
              Deploy your first application to get started.
            </p>
          </div>
          <Button asChild size="sm">
            <Link
              href={localizePathname({
                pathname: "/console/app/deploy",
                locale,
              })}
            >
              {messages.console.app.overview.deploy}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Active Platforms ({apps.length})
            </h2>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link
                href={localizePathname({
                  pathname: "/console/app/platforms",
                  locale,
                })}
              >
                <span>View all platforms</span>
                <ArrowRight size={14} />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.slice(0, 6).map((app) => {
              const overviewHref = `/${locale}/console/app/platform/${app.slug}?tab=overview`
              const deploymentsHref = `/${locale}/console/app/platform/${app.slug}?tab=deployments`
              const settingsHref = `/${locale}/console/app/platform/${app.slug}?tab=env`
              const liveDomain = app.customDomain || app.subdomain

              return (
                <div
                  key={app.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:shadow-xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={overviewHref}
                          className="truncate font-semibold text-foreground hover:underline"
                        >
                          {app.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {app.framework ??
                            app.templateId ??
                            "Custom Container"}{" "}
                          &bull; branch {app.branchName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_TONE[app.status] ?? STATUS_TONE.idle
                        }`}
                      >
                        {DEPLOY_STATUS_LABELS[app.status] ?? app.status}
                      </span>
                    </div>

                    {liveDomain && (
                      <a
                        href={`https://${liveDomain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 truncate text-xs text-primary hover:underline"
                      >
                        <span>{liveDomain}</span>
                        <ArrowSquareOut size={12} />
                      </a>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                    <span className="text-muted-foreground">
                      {app.lastDeployedAt
                        ? formatRelativeTime(app.lastDeployedAt, locale)
                        : "Never deployed"}
                    </span>
                    <div className="flex gap-1.5">
                      <Button asChild variant="outline" size="xs">
                        <Link href={deploymentsHref}>Deployments</Link>
                      </Button>
                      <Button asChild variant="outline" size="xs">
                        <Link href={settingsHref}>Env</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
