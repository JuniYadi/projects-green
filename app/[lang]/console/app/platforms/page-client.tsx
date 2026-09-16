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
  ArrowSquareOut,
  DotsThreeVertical,
  Globe,
  GlobeHemisphereWest,
  GitBranch,
  Cube,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { CountryFlag } from "@/components/ui/country-flag"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const formatDate = (dateStr: string | null, locale: string) => {
  if (!dateStr) return "Never"
  try {
    return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

const getAppType = (app: StackSummaryDTO) => {
  if (app.framework && !app.framework.startsWith("c")) {
    return { label: app.framework, isTemplate: false }
  }
  if (app.templateName && !app.templateName.startsWith("c")) {
    return { label: app.templateName, isTemplate: true }
  }
  if (
    app.templateId &&
    !app.templateId.startsWith("c") &&
    app.templateId.length < 25
  ) {
    return { label: app.templateId, isTemplate: true }
  }
  if (app.sourceType === "TEMPLATE") {
    return { label: "Template App", isTemplate: true }
  }
  return { label: "Custom App", isTemplate: false }
}

const getDeploymentStatusText = (app: StackSummaryDTO, locale: string) => {
  if (app.status === "running") {
    if (
      app.currentStepLabel &&
      !app.currentStepLabel.toLowerCase().includes("deploying") &&
      !app.currentStepLabel.toLowerCase().includes("queued") &&
      !app.currentStepLabel.toLowerCase().includes("building")
    ) {
      return `${app.currentStepLabel}${
        app.currentStepStartedAt
          ? ` — ${formatRelativeTime(app.currentStepStartedAt, locale)}`
          : ""
      }`
    }
    return app.lastDeployedAt
      ? `Live — ${formatRelativeTime(app.lastDeployedAt, locale)}`
      : "Application live"
  }
  if (app.currentStepLabel) {
    return `${app.currentStepLabel}${
      app.currentStepStartedAt
        ? ` — ${formatRelativeTime(app.currentStepStartedAt, locale)}`
        : ""
    }`
  }
  return "—"
}

export default function PlatformsFleetPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessagesForMaybeLocale(locale).console.app.platforms

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
        const matchesTemplate = app.templateName?.toLowerCase().includes(q)
        const matchesSubdomain = app.subdomain?.toLowerCase().includes(q)
        const matchesCustomDomain = app.customDomain?.toLowerCase().includes(q)
        const matchesCluster = Boolean(
          app.cluster?.name.toLowerCase().includes(q) ||
          app.cluster?.code.toLowerCase().includes(q) ||
          app.cluster?.regionName?.toLowerCase().includes(q)
        )
        const matchesDockerVersion = Boolean(
          app.dockerVersion?.toLowerCase().includes(q)
        )
        return (
          matchesName ||
          matchesSlug ||
          matchesBranch ||
          Boolean(matchesFramework) ||
          Boolean(matchesTemplate) ||
          Boolean(matchesSubdomain) ||
          Boolean(matchesCustomDomain) ||
          matchesCluster ||
          matchesDockerVersion
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
            {messages.heading}
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.description}
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
              <span>{messages.marketplaceLink}</span>
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
              <span>{messages.deployNewApp}</span>
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
            {messages.allTab}
            {apps.length})
          </Button>
          <Button
            variant={statusFilter === "RUNNING" ? "default" : "outline"}
            size="xs"
            onClick={() => setStatusFilter("RUNNING")}
            className="h-7 text-xs"
          >
            {messages.runningTab}
            {runningCount})
          </Button>
          <Button
            variant={statusFilter === "QUEUED" ? "default" : "outline"}
            size="xs"
            onClick={() => setStatusFilter("QUEUED")}
            className="h-7 text-xs"
          >
            {messages.queuedTab}
            {queuedCount})
          </Button>
          <Button
            variant={statusFilter === "FAILED" ? "default" : "outline"}
            size="xs"
            onClick={() => setStatusFilter("FAILED")}
            className="h-7 text-xs"
          >
            {messages.failedTab}
            {failedCount})
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
            placeholder={messages.searchPlaceholder}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {messages.loadingFleet}
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
            {messages.retry}
          </Button>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
          <RocketLaunch size={40} className="text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {messages.emptyTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {messages.emptyHint}
            </p>
          </div>
          <Button asChild size="sm">
            <Link
              href={localizePathname({
                pathname: "/console/app/deploy",
                locale,
              })}
            >
              {messages.deployApplication}
            </Link>
          </Button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          {messages.noMatchFilter}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">
                    {messages.colPlatform}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {messages.colStatus}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {messages.colRegion}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {messages.colFramework}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {messages.colSource}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {messages.colLastDeployed}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {messages.colActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => {
                  const overviewHref = `/${locale}/console/app/platform/${app.slug}?tab=overview`
                  const logsHref = `/${locale}/console/app/platform/${app.slug}?tab=logs`
                  const metricsHref = `/${locale}/console/app/platform/${app.slug}?tab=metrics`
                  const deploymentsHref = `/${locale}/console/app/platform/${app.slug}?tab=deployments`
                  const settingsHref = `/${locale}/console/app/platform/${app.slug}?tab=env`

                  const targetDomain = app.customDomain || app.subdomain
                  const typeInfo = getAppType(app)
                  const deploymentStatusText = getDeploymentStatusText(
                    app,
                    locale
                  )

                  return (
                    <tr
                      key={app.id}
                      className="border-b border-border transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <Link
                            href={overviewHref}
                            className="font-medium text-foreground hover:underline"
                          >
                            {app.name}
                          </Link>
                          {targetDomain ? (
                            <div>
                              <a
                                href={`https://${targetDomain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Globe size={12} className="shrink-0" />
                                <span className="max-w-[200px] truncate">
                                  {targetDomain}
                                </span>
                                <ArrowSquareOut
                                  size={11}
                                  className="shrink-0 text-muted-foreground"
                                />
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              STATUS_TONE[app.status] ?? STATUS_TONE.idle
                            }`}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {DEPLOY_STATUS_LABELS[app.status] ?? app.status}
                          </span>
                          {app.status !== "running" && app.currentStepLabel ? (
                            <div className="text-[11px] text-muted-foreground">
                              {deploymentStatusText}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <CountryFlag
                            country={app.cluster?.countryCode}
                            className="rounded-2xs h-3.5 w-5 shrink-0 object-cover shadow-2xs"
                            fallback={
                              <GlobeHemisphereWest
                                size={14}
                                className="shrink-0 text-muted-foreground"
                              />
                            }
                          />
                          <span className="font-medium text-foreground">
                            {app.cluster?.regionName ||
                              app.cluster?.name ||
                              "Global"}
                          </span>
                          {app.cluster?.code ? (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({app.cluster.code})
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Cube
                            size={13}
                            className="shrink-0 text-muted-foreground"
                          />
                          <span className="font-medium text-foreground">
                            {typeInfo.label}
                          </span>
                          {typeInfo.isTemplate ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {messages.templateBadge}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {app.sourceType === "TEMPLATE" ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground"
                            title={`Docker / Template: ${
                              app.dockerVersion ?? "latest"
                            }`}
                          >
                            <Cube
                              size={12}
                              className="shrink-0 text-muted-foreground"
                            />
                            <span>
                              {app.dockerVersion
                                ? `v${app.dockerVersion.replace(/^v/, "")}`
                                : "latest"}
                            </span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground"
                            title={`Git Branch: ${app.branchName}`}
                          >
                            <GitBranch
                              size={12}
                              className="shrink-0 text-muted-foreground"
                            />
                            <span>{app.branchName}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(app.lastDeployedAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Contextual Primary CTA */}
                          {app.status === "running" && targetDomain ? (
                            <Button
                              asChild
                              size="xs"
                              className="h-7 gap-1 px-2.5 text-xs font-medium"
                            >
                              <a
                                href={`https://${targetDomain}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ArrowSquareOut
                                  size={13}
                                  className="shrink-0"
                                />
                                <span>
                                  {locale === "id" ? "Buka Web" : "Open App"}
                                </span>
                              </a>
                            </Button>
                          ) : app.status === "failed" ||
                            app.status === "building" ||
                            app.status === "deploying" ||
                            app.status === "queued" ? (
                            <Button
                              asChild
                              variant={
                                app.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                              }
                              size="xs"
                              className="h-7 gap-1 px-2.5 text-xs font-medium"
                            >
                              <Link href={logsHref}>
                                <ListMagnifyingGlass
                                  size={13}
                                  className="shrink-0"
                                />
                                <span>
                                  {locale === "id" ? "Cek Logs" : "View Logs"}
                                </span>
                              </Link>
                            </Button>
                          ) : null}

                          {/* Secondary Action: Manage */}
                          <Button
                            asChild
                            variant="outline"
                            size="xs"
                            className="h-7 px-2.5 text-xs font-medium"
                          >
                            <Link href={overviewHref}>
                              {locale === "id" ? "Kelola" : "Manage"}
                            </Link>
                          </Button>

                          {/* Dropdown Menu for Secondary Options */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="xs"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                aria-label={`Actions for ${app.name}`}
                              >
                                <DotsThreeVertical size={14} weight="bold" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {targetDomain && app.status === "running" ? (
                                <>
                                  <DropdownMenuItem asChild>
                                    <a
                                      href={`https://${targetDomain}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex cursor-pointer items-center gap-2"
                                    >
                                      <ArrowSquareOut size={14} />
                                      <span>
                                        {locale === "id"
                                          ? "Buka di Tab Baru"
                                          : "Open in New Tab"}
                                      </span>
                                    </a>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              ) : null}
                              <DropdownMenuItem asChild>
                                <Link
                                  href={deploymentsHref}
                                  className="flex cursor-pointer items-center gap-2"
                                >
                                  <RocketLaunch size={14} />
                                  <span>{messages.deploymentsAction}</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={logsHref}
                                  className="flex cursor-pointer items-center gap-2"
                                >
                                  <ListMagnifyingGlass size={14} />
                                  <span>{messages.logsAction}</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={metricsHref}
                                  className="flex cursor-pointer items-center gap-2"
                                >
                                  <ChartLine size={14} />
                                  <span>{messages.metricsAction}</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link
                                  href={settingsHref}
                                  className="flex cursor-pointer items-center gap-2"
                                >
                                  <GearSix size={14} />
                                  <span>{messages.settingsAction}</span>
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
