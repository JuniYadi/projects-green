"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  RocketLaunch,
  ListMagnifyingGlass,
  ChartLine,
  GearSix,
  Storefront,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DEPLOY_STATUS_LABELS,
  DEPLOY_STATUS_TONE as STATUS_TONE,
} from "@/modules/deploy/deploy.constants"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

type StatusFilter = "ALL" | "RUNNING" | "QUEUED" | "FAILED"

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

export default function PlatformsFleetPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)

  const [apps, setApps] = useState<StackSummaryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: payload } = await eden.api.deploy.apps.get()
        if (!payload || !payload.ok || !Array.isArray(payload.data)) {
          throw new Error(payload?.message ?? "Unable to load platforms.")
        }

        if (cancelled) return
        setApps(payload.data)
      } catch (cause) {
        if (cancelled) return
        setApps([])
        setError(
          cause instanceof Error ? cause.message : "Unable to load platforms."
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

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      // Filter by status
      if (statusFilter === "RUNNING" && app.status !== "running") return false
      if (
        statusFilter === "QUEUED" &&
        app.status !== "queued" &&
        app.status !== "building" &&
        app.status !== "deploying"
      )
        return false
      if (statusFilter === "FAILED" && app.status !== "failed") return false

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesName = app.name.toLowerCase().includes(q)
        const matchesSlug = app.slug.toLowerCase().includes(q)
        const matchesBranch = app.branchName.toLowerCase().includes(q)
        const matchesFramework = app.framework?.toLowerCase().includes(q)
        return (
          matchesName ||
          matchesSlug ||
          matchesBranch ||
          Boolean(matchesFramework)
        )
      }

      return true
    })
  }, [apps, statusFilter, searchQuery])

  const runningCount = apps.filter((a) => a.status === "running").length
  const queuedCount = apps.filter(
    (a) =>
      a.status === "queued" ||
      a.status === "building" ||
      a.status === "deploying"
  ).length
  const failedCount = apps.filter((a) => a.status === "failed").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Platforms Fleet
          </h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and manage all your deployed platform instances.
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={statusFilter === "ALL" ? "default" : "outline"}
            size="xs"
            onClick={() => setStatusFilter("ALL")}
            className="h-7 text-xs"
          >
            All ({apps.length})
          </Button>
          <Button
            variant={statusFilter === "RUNNING" ? "default" : "outline"}
            size="xs"
            onClick={() => setStatusFilter("RUNNING")}
            className="h-7 text-xs"
          >
            Running ({runningCount})
          </Button>
          <Button
            variant={statusFilter === "QUEUED" ? "default" : "outline"}
            size="xs"
            onClick={() => setStatusFilter("QUEUED")}
            className="h-7 text-xs"
          >
            Deploying / Queued ({queuedCount})
          </Button>
          <Button
            variant={statusFilter === "FAILED" ? "default" : "outline"}
            size="xs"
            onClick={() => setStatusFilter("FAILED")}
            className="h-7 text-xs"
          >
            Failed ({failedCount})
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <MagnifyingGlass
            size={14}
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search platforms..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Loading platforms fleet…
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
            Retry
          </Button>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
          <RocketLaunch size={40} className="text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              No platforms found
            </p>
            <p className="text-xs text-muted-foreground">
              Deploy your first application from Git or the Marketplace to get
              started.
            </p>
          </div>
          <Button asChild size="sm">
            <Link
              href={localizePathname({
                pathname: "/console/app/deploy",
                locale,
              })}
            >
              Deploy Application
            </Link>
          </Button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          No platforms match your filter criteria.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Framework</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Last Deployed</th>
                  <th className="px-4 py-3 font-medium">Current deployment</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => {
                  const overviewHref = `/${locale}/console/app/platform/${app.slug}?tab=overview`
                  const logsHref = `/${locale}/console/app/platform/${app.slug}?tab=logs`
                  const metricsHref = `/${locale}/console/app/platform/${app.slug}?tab=metrics`
                  const deploymentsHref = `/${locale}/console/app/platform/${app.slug}?tab=deployments`
                  const settingsHref = `/${locale}/console/app/platform/${app.slug}?tab=env`

                  return (
                    <tr
                      key={app.id}
                      className="border-b border-border transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={overviewHref}
                          className="font-medium text-foreground hover:underline"
                        >
                          {app.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            STATUS_TONE[app.status] ?? STATUS_TONE.idle
                          }`}
                        >
                          {DEPLOY_STATUS_LABELS[app.status] ?? app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {app.framework ?? app.templateId ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {app.branchName}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {app.lastDeployedAt
                          ? new Date(app.lastDeployedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {app.currentStepLabel
                          ? `${app.currentStepLabel} — ${
                              app.currentStepStartedAt
                                ? formatRelativeTime(
                                    app.currentStepStartedAt,
                                    locale
                                  )
                                : "—"
                            }`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button asChild variant="outline" size="xs">
                            <Link href={deploymentsHref}>
                              <ListMagnifyingGlass size={13} className="mr-1" />
                              Deployments
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="xs">
                            <Link href={logsHref}>
                              <ListMagnifyingGlass size={13} className="mr-1" />
                              Logs
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="xs">
                            <Link href={metricsHref}>
                              <ChartLine size={13} className="mr-1" />
                              Metrics
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="xs">
                            <Link href={settingsHref}>
                              <GearSix size={13} className="mr-1" />
                              Settings
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
