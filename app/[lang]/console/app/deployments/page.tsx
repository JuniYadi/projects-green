"use client"

import { useEffect, useState } from "react"
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"

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
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import type {
  DeploymentHistoryDTO,
  DeploymentStatusDTO,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"
import type { DeployLogScope } from "@/modules/deploy/deploy.types"
import { AppMonitor } from "@/modules/deploy/ui/operate/app-monitor"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"

const APP_QUERY_KEY = "app"
const PAGE_SIZE = 20

const STATUS_TONE: Record<string, string> = {
  running: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  failed: "border-rose-500/20 bg-rose-500/5 text-rose-400",
  building: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  deploying: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  queued: "border-amber-500/20 bg-amber-500/5 text-amber-400",
  idle: "border-border bg-muted/30 text-muted-foreground",
}

type HistoryMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type DeploymentsCopy = {
  heading: string
  description: string
}

const findDefaultSlug = (
  apps: StackSummaryDTO[],
  preferred: string | null
): string | null => {
  if (preferred && apps.some((app) => app.slug === preferred)) return preferred
  return apps[0]?.slug ?? null
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

const formatTime = (value: string | null, locale: string): string => {
  if (!value) return "—"
  return new Date(value).toLocaleString(locale)
}

const toDeploymentStatus = (
  deployment: DeploymentHistoryDTO
): DeploymentStatusDTO => ({
  id: deployment.id,
  status: deployment.status,
  attempt: deployment.attempt,
  manifestPushed: false,
  argocdSynced: false,
  failureReason: deployment.failureReason,
  startedAt: deployment.startedAt,
  completedAt: deployment.completedAt,
})

export default function DeploymentsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const pageCopy = (
    messages.console.app as typeof messages.console.app & {
      deployments?: DeploymentsCopy
    }
  ).deployments ?? {
    heading: "Deployments",
    description: "Review deployment attempts and monitor their progress.",
  }
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [apps, setApps] = useState<StackSummaryDTO[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [appsError, setAppsError] = useState<string | null>(null)
  const [appsRetry, setAppsRetry] = useState(0)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() =>
    searchParams.get(APP_QUERY_KEY)
  )
  const [overview, setOverview] = useState<{
    stack: StackSummaryDTO
    latestDeployment: DeploymentStatusDTO | null
  } | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [overviewRetry, setOverviewRetry] = useState(0)
  const [history, setHistory] = useState<DeploymentHistoryDTO[]>([])
  const [historyMeta, setHistoryMeta] = useState<HistoryMeta | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyRetry, setHistoryRetry] = useState(0)
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(null)
  const [logScope, setLogScope] = useState<DeployLogScope>("all")
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

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
        setApps(payload.data)
        setSelectedSlug(findDefaultSlug(payload.data, selectedSlug))
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
    if (selectedSlug) next.set(APP_QUERY_KEY, selectedSlug)
    else next.delete(APP_QUERY_KEY)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, selectedSlug])

  useEffect(() => {
    queueMicrotask(() => {
      setHistoryPage(1)
      setSelectedDeploymentId(null)
      setHistory([])
      setHistoryMeta(null)
      setHistoryError(null)
      setRetryError(null)
    })
  }, [selectedSlug])

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
        if (!cancelled) setOverview(payload.data)
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
  }, [overviewRetry, selectedSlug])

  useEffect(() => {
    if (!selectedSlug) {
      queueMicrotask(() => {
        setHistory([])
        setHistoryMeta(null)
      })
      return
    }

    let cancelled = false
    const run = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const { data: payload } = await eden.api.deploy.apps[
          selectedSlug
        ].history.get({ $query: { page: historyPage, pageSize: PAGE_SIZE } })
        const historyData = payload?.data
        if (!payload || !payload.ok || !Array.isArray(historyData)) {
          throw new Error(
            payload?.message ?? "Unable to load deployment history."
          )
        }
        if (cancelled) return
        setHistory(historyData)
        setHistoryMeta(payload.meta ?? null)
        setSelectedDeploymentId((current) =>
          current && historyData.some((deployment) => deployment.id === current)
            ? current
            : (historyData[0]?.id ?? null)
        )
      } catch (cause) {
        if (cancelled) return
        setHistory([])
        setHistoryMeta(null)
        setHistoryError(
          cause instanceof Error
            ? cause.message
            : "Unable to load deployment history."
        )
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [historyPage, historyRetry, selectedSlug])

  const selectedDeployment = history.find(
    (deployment) => deployment.id === selectedDeploymentId
  )
  const selectedStatus = selectedDeployment
    ? toDeploymentStatus(selectedDeployment)
    : null

  const handleRetry = async () => {
    if (
      !overview ||
      !selectedDeployment ||
      selectedDeployment.status !== "failed"
    ) {
      return
    }
    setRetrying(true)
    setRetryError(null)
    try {
      const { data: payload } = await eden.api.deploy.trigger[
        overview.stack.id
      ].post({})
      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? "Unable to retry deployment.")
      }
      const deploymentId = payload.data?.deploymentId
      if (typeof deploymentId === "string")
        setSelectedDeploymentId(deploymentId)
      setOverviewRetry((value) => value + 1)
      setHistoryRetry((value) => value + 1)
    } catch (cause) {
      setRetryError(
        cause instanceof Error ? cause.message : "Unable to retry deployment."
      )
    } finally {
      setRetrying(false)
    }
  }

  const handleAppsRetry = () => setAppsRetry((value) => value + 1)
  const handleHistoryRetry = () => setHistoryRetry((value) => value + 1)
  const totalPages = historyMeta?.totalPages ?? 0
  const targetDomain = overview?.stack.customDomain || overview?.stack.subdomain

  return (
    <LifecyclePageShell
      title={pageCopy.heading}
      description={pageCopy.description}
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
              {apps.map((app) => (
                <Button
                  key={app.id}
                  type="button"
                  variant={app.slug === selectedSlug ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSlug(app.slug)}
                  aria-pressed={app.slug === selectedSlug}
                >
                  {app.name}
                </Button>
              ))}
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
                  onClick={() => setOverviewRetry((value) => value + 1)}
                >
                  {messages.console.app.manage.retry}
                </Button>
              </div>
            ) : overview ? (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-5 py-3 text-sm">
                  <span className="font-semibold">{overview.stack.name}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[overview.stack.status] ?? STATUS_TONE.idle}`}
                  >
                    {DEPLOY_STATUS_LABELS[overview.stack.status] ??
                      overview.stack.status}
                  </span>
                  <span className="text-muted-foreground">
                    {overview.stack.framework ?? "Unknown"} &bull;{" "}
                    {overview.stack.branchName}
                  </span>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Deployment history</CardTitle>
                    <CardDescription>
                      {historyMeta
                        ? `${historyMeta.total} deployment${historyMeta.total === 1 ? "" : "s"}`
                        : "Previous deployment attempts"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Loading deployment history…
                      </p>
                    ) : historyError ? (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                        role="alert"
                      >
                        <span>{historyError}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleHistoryRetry}
                        >
                          {messages.console.app.manage.retry}
                        </Button>
                      </div>
                    ) : history.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No deployment attempts yet.
                      </p>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Attempt</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Commit</TableHead>
                                <TableHead>Failure</TableHead>
                                <TableHead>Started</TableHead>
                                <TableHead>Completed</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {history.map((deployment) => (
                                <TableRow
                                  key={deployment.id}
                                  data-state={
                                    deployment.id === selectedDeploymentId
                                      ? "selected"
                                      : undefined
                                  }
                                  tabIndex={0}
                                  onClick={() =>
                                    setSelectedDeploymentId(deployment.id)
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault()
                                      setSelectedDeploymentId(deployment.id)
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  <TableCell>
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[deployment.status] ?? STATUS_TONE.idle}`}
                                    >
                                      {DEPLOY_STATUS_LABELS[
                                        deployment.status
                                      ] ?? deployment.status}
                                    </span>
                                  </TableCell>
                                  <TableCell>#{deployment.attempt}</TableCell>
                                  <TableCell>
                                    {formatDuration(deployment.durationMs)}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {deployment.commitSha
                                      ? deployment.commitSha.slice(0, 7)
                                      : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {deployment.failureReason ?? "—"}
                                  </TableCell>
                                  <TableCell>
                                    {formatTime(deployment.startedAt, locale)}
                                  </TableCell>
                                  <TableCell>
                                    {formatTime(deployment.completedAt, locale)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {totalPages > 1 ? (
                          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>
                              Page {historyMeta?.page ?? historyPage} of{" "}
                              {totalPages}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={historyPage <= 1}
                                onClick={() =>
                                  setHistoryPage((page) =>
                                    Math.max(1, page - 1)
                                  )
                                }
                              >
                                Previous
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={historyPage >= totalPages}
                                onClick={() =>
                                  setHistoryPage((page) =>
                                    Math.min(totalPages, page + 1)
                                  )
                                }
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>

                {retryError ? (
                  <div
                    className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                    role="alert"
                  >
                    {retryError}
                  </div>
                ) : null}

                <AppMonitor
                  stack={overview.stack}
                  deployment={selectedStatus}
                  logScope={logScope}
                  onLogScopeChange={setLogScope}
                  liveDomain={targetDomain ?? undefined}
                  onRetry={
                    selectedDeployment?.status === "failed" && !retrying
                      ? handleRetry
                      : undefined
                  }
                />
              </>
            ) : null}
          </>
        )}
      </div>
    </LifecyclePageShell>
  )
}
