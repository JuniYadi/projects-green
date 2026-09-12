"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import type { AdminDeploymentsMessages } from "@/lib/i18n/messages/types"
import type { AdminDeploymentDTO } from "@/modules/deploy/admin-deployments.service"
import {
  ArrowsClockwise,
  MagnifyingGlass,
  ArrowSquareOut,
} from "@phosphor-icons/react"

const STATUS_TONES: Record<string, string> = {
  RUNNING: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  FAILED: "border-rose-500/20 bg-rose-500/10 text-rose-500",
  BUILDING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  DEPLOYING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  QUEUED: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  STOPPED: "border-border bg-muted/40 text-muted-foreground",
}

const STATUS_FILTERS = [
  "ALL",
  "RUNNING",
  "BUILDING",
  "DEPLOYING",
  "QUEUED",
  "FAILED",
  "STOPPED",
] as const

const statusMessageKey: Record<
  (typeof STATUS_FILTERS)[number],
  keyof AdminDeploymentsMessages["statuses"]
> = {
  ALL: "all",
  RUNNING: "running",
  BUILDING: "building",
  DEPLOYING: "deploying",
  QUEUED: "queued",
  FAILED: "failed",
  STOPPED: "stopped",
}

const activeStatuses = new Set(["QUEUED", "BUILDING", "DEPLOYING", "RUNNING"])

export function formatDeploymentDuration(
  deployment: Pick<AdminDeploymentDTO, "status" | "durationMs">,
  messages: AdminDeploymentsMessages
): string {
  if (deployment.durationMs === null) {
    return activeStatuses.has(deployment.status)
      ? messages.inProgress
      : messages.notAvailable
  }
  if (deployment.durationMs === 0) return "0s"
  const totalSeconds = Math.round(deployment.durationMs / 1000)
  const day = 24 * 60 * 60
  if (totalSeconds >= day) {
    const days = Math.floor(totalSeconds / day)
    const hours = Math.floor((totalSeconds % day) / (60 * 60))
    return `${days}d ${hours}h`
  }
  const hours = Math.floor(totalSeconds / (60 * 60))
  if (hours > 0) {
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
    return `${hours}h ${minutes}m`
  }
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}m ${totalSeconds % 60}s`
}

export default function AdminDeploymentsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).console.app.adminDeployments
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawOrg = searchParams.get("organizationId") ?? ""
  const rawQuery = searchParams.get("query") ?? ""
  const rawStatus = searchParams.get("status") ?? "ALL"

  const orgParam =
    rawOrg === "undefined" || rawOrg === "null" ? "" : rawOrg.trim()
  const queryParam =
    rawQuery === "undefined" || rawQuery === "null" ? "" : rawQuery.trim()
  const statusParam =
    !rawStatus || rawStatus === "undefined" || rawStatus === "null"
      ? "ALL"
      : rawStatus.trim()

  const [orgInput, setOrgInput] = useState(orgParam)
  const [queryInput, setQueryInput] = useState(queryParam)
  const [activeStatus, setActiveStatus] = useState(statusParam)

  const [deployments, setDeployments] = useState<AdminDeploymentDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDeployment, setSelectedDeployment] =
    useState<AdminDeploymentDTO | null>(null)
  const [syncingStackId, setSyncingStackId] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const query: {
          organizationId?: string
          query?: string
          status?: string
        } = {}
        if (orgParam) query.organizationId = orgParam
        if (queryParam) query.query = queryParam
        if (statusParam !== "ALL") query.status = statusParam

        const { data: res } = await eden.api.admin.deployments.get({
          $query: query,
        })

        if (cancelled) return
        if (!res || !res.ok) {
          setError(messages.loadFailed)
          setDeployments([])
          return
        }

        setDeployments(res.data)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : messages.loadFailed)
        setDeployments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [messages.loadFailed, orgParam, queryParam, statusParam, reloadTick])

  const refresh = () => {
    setReloadTick((value) => value + 1)
  }

  const handleSyncDeployment = async (d: AdminDeploymentDTO, force = false) => {
    setSyncingStackId(d.stackId)
    try {
      const { data: payload } = await eden.api.deploy.trigger[d.stackId].post({
        force,
      })
      if (!payload || !payload.ok) {
        if (
          !force &&
          (payload?.error === "STACK_DEPLOY_IN_PROGRESS" ||
            payload?.message?.includes("already in progress"))
        ) {
          const confirmForce = window.confirm(
            messages.syncConflict.replace("{stack}", d.stackSlug)
          )
          if (confirmForce) {
            await handleSyncDeployment(d, true)
            return
          }
        }
        throw new Error(payload?.message ?? messages.syncFailed)
      }
      toast.success(messages.syncSuccess.replace("{stack}", d.stackSlug))
      setReloadTick((v) => v + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : messages.syncFailed)
    } finally {
      setSyncingStackId(null)
    }
  }

  const applyFilters = (
    newOrg: string,
    newQuery: string,
    newStatus: string
  ) => {
    const sp = new URLSearchParams()
    const org = newOrg.trim()
    const q = newQuery.trim()
    if (org && org !== "undefined" && org !== "null") {
      sp.set("organizationId", org)
    }
    if (q && q !== "undefined" && q !== "null") {
      sp.set("query", q)
    }
    if (
      newStatus &&
      newStatus !== "ALL" &&
      newStatus !== "undefined" &&
      newStatus !== "null"
    ) {
      sp.set("status", newStatus.trim())
    }

    const base = localizePathname({
      pathname: "/portal/app/deployments",
      locale,
    })
    const target = sp.toString() ? `${base}?${sp.toString()}` : base
    router.push(target)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{messages.heading}</h1>
          <p className="text-sm text-muted-foreground">
            {messages.description}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          data-testid="refresh-btn"
        >
          <ArrowsClockwise
            size={14}
            className={`mr-1 ${loading ? "animate-spin" : ""}`}
          />
          {messages.refresh}
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-[180px] flex-1">
          <label
            htmlFor="filter-org"
            className="text-xs font-medium text-muted-foreground"
          >
            {messages.organizationId}
          </label>
          <Input
            id="filter-org"
            name="organizationId"
            placeholder={messages.organizationPlaceholder}
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                applyFilters(orgInput, queryInput, activeStatus)
            }}
            className="mt-1 h-9"
          />
        </div>
        <div className="min-w-[240px] flex-[2]">
          <label
            htmlFor="filter-query"
            className="text-xs font-medium text-muted-foreground"
          >
            {messages.search}
          </label>
          <div className="relative mt-1">
            <Input
              id="filter-query"
              name="query"
              placeholder={messages.searchPlaceholder}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  applyFilters(orgInput, queryInput, activeStatus)
              }}
              className="h-9 pr-8"
            />
            <MagnifyingGlass
              size={14}
              className="absolute top-2.5 right-2.5 text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => applyFilters(orgInput, queryInput, activeStatus)}
            className="h-9 px-4"
          >
            {messages.apply}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOrgInput("")
              setQueryInput("")
              setActiveStatus("ALL")
              applyFilters("", "", "ALL")
            }}
            className="h-9"
          >
            {messages.reset}
          </Button>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <span className="mr-2 text-xs text-muted-foreground">
            {messages.status}:
          </span>
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={activeStatus === status ? "secondary" : "ghost"}
              className="h-7 rounded-full px-2.5 text-xs"
              onClick={() => {
                setActiveStatus(status)
                applyFilters(orgInput, queryInput, status)
              }}
            >
              {messages.statuses[statusMessageKey[status]]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.tableOrganization}</TableHead>
              <TableHead>{messages.tableAppStack}</TableHead>
              <TableHead>{messages.tableStatus}</TableHead>
              <TableHead>{messages.tableCommit}</TableHead>
              <TableHead>{messages.tableDuration}</TableHead>
              <TableHead>{messages.tableCreated}</TableHead>
              <TableHead className="text-right">
                {messages.tableAction}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {messages.loading}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-rose-500"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : deployments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {messages.empty}
                </TableCell>
              </TableRow>
            ) : (
              deployments.map((deployment) => {
                const shortId =
                  deployment.id.length > 14
                    ? `${deployment.id.slice(0, 14)}…`
                    : deployment.id
                const statusKey =
                  statusMessageKey[
                    deployment.status as (typeof STATUS_FILTERS)[number]
                  ]
                return (
                  <TableRow
                    key={deployment.id}
                    data-testid={`deployment-row-${deployment.id}`}
                  >
                    <TableCell className="font-mono text-xs">
                      <span title={deployment.organizationId}>
                        {deployment.organizationId.length > 16
                          ? `${deployment.organizationId.slice(0, 14)}…`
                          : deployment.organizationId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {deployment.stackName}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {deployment.stackSlug}
                      </div>
                      <button
                        type="button"
                        title={deployment.id}
                        aria-label={`${messages.deploymentId}: ${deployment.id}`}
                        onClick={() => setSelectedDeployment(deployment)}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {shortId}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase ${STATUS_TONES[deployment.status] ?? ""}`}
                      >
                        {statusKey
                          ? messages.statuses[statusKey]
                          : deployment.status}
                      </Badge>
                      {deployment.status === "FAILED" &&
                        deployment.failureReason && (
                          <div
                            className="max-w-[180px] truncate text-xs text-rose-500"
                            title={deployment.failureReason}
                          >
                            {deployment.failureReason}
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {deployment.branchName}{" "}
                        {deployment.commitSha
                          ? `(${deployment.commitSha.slice(0, 7)})`
                          : ""}
                      </div>
                      {deployment.commitMessage && (
                        <div
                          className="max-w-[180px] truncate text-muted-foreground"
                          title={deployment.commitMessage}
                        >
                          {deployment.commitMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDeploymentDuration(deployment, messages)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(deployment.createdAt).toLocaleString(locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={syncingStackId === deployment.stackId}
                          onClick={() => handleSyncDeployment(deployment)}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <ArrowsClockwise
                            className={`size-3.5 ${syncingStackId === deployment.stackId ? "animate-spin" : ""}`}
                          />
                          {messages.sync}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDeployment(deployment)}
                          className="h-7 px-2 text-xs"
                        >
                          {messages.details}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={!!selectedDeployment}
        onOpenChange={(open) => !open && setSelectedDeployment(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{messages.deploymentDetails}</SheetTitle>
            <SheetDescription>{messages.detailsDescription}</SheetDescription>
          </SheetHeader>
          {selectedDeployment && (
            <div className="space-y-4 pt-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">
                  {messages.deploymentId}
                </span>
                <p className="font-mono text-xs font-semibold">
                  {selectedDeployment.id}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  {messages.organization}
                </span>
                <p className="font-mono text-xs">
                  {selectedDeployment.organizationId}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  {messages.stack}
                </span>
                <p className="font-medium">
                  {selectedDeployment.stackName} ({selectedDeployment.stackSlug}
                  )
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">
                  {messages.tableStatus}
                </span>
                <div>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] ${STATUS_TONES[selectedDeployment.status] ?? ""}`}
                  >
                    {statusMessageKey[
                      selectedDeployment.status as (typeof STATUS_FILTERS)[number]
                    ]
                      ? messages.statuses[
                          statusMessageKey[
                            selectedDeployment.status as (typeof STATUS_FILTERS)[number]
                          ]
                        ]
                      : selectedDeployment.status}
                  </Badge>
                </div>
              </div>
              {selectedDeployment.failureReason && (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-400">
                  <span className="mb-1 block font-semibold">
                    {messages.failureReason}:
                  </span>
                  {selectedDeployment.failureReason}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">
                    {messages.trigger}
                  </span>
                  <p className="font-medium">
                    {selectedDeployment.triggerType}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {messages.eventsCount}
                  </span>
                  <p className="font-medium">
                    {selectedDeployment.eventsCount}
                  </p>
                </div>
              </div>
              <div className="flex justify-between border-t border-border pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={localizePathname({
                      pathname: `/console/app/deployments`,
                      locale,
                    })}
                    target="_blank"
                  >
                    <ArrowSquareOut size={14} className="mr-1" />
                    {messages.openConsole}
                  </Link>
                </Button>
              </div>
              <div className="border-t border-border pt-4">
                <Button
                  className="w-full gap-2"
                  disabled={syncingStackId === selectedDeployment.stackId}
                  onClick={() => handleSyncDeployment(selectedDeployment)}
                >
                  <ArrowsClockwise
                    className={`size-4 ${syncingStackId === selectedDeployment.stackId ? "animate-spin" : ""}`}
                  />
                  {syncingStackId === selectedDeployment.stackId
                    ? messages.syncing
                    : messages.syncConfig}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  )
}
