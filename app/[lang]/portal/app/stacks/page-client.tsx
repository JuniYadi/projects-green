"use client"

import { useEffect, useState } from "react"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import type { AdminStackDTO } from "@/modules/deploy/admin-stacks.service"
import {
  ArrowsClockwise,
  MagnifyingGlass,
  PauseCircle,
  PlayCircle,
  Trash,
} from "@phosphor-icons/react"

const STATUS_TONES: Record<string, string> = {
  RUNNING: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  FAILED: "border-rose-500/20 bg-rose-500/10 text-rose-500",
  BUILDING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  DEPLOYING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  QUEUED: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  STOPPED: "border-border bg-muted/40 text-muted-foreground",
  TERMINATED: "border-border bg-muted/40 text-muted-foreground",
}

const STATUS_LABELS = (
  messages: ReturnType<typeof getMessages>["console"]["app"]["adminStacks"]
): Record<string, string> => ({
  ALL: messages.statusAll,
  RUNNING: messages.statusRunning,
  BUILDING: messages.statusBuilding,
  DEPLOYING: messages.statusDeploying,
  QUEUED: messages.statusQueued,
  FAILED: messages.statusFailed,
  STOPPED: messages.statusStopped,
  TERMINATED: messages.statusTerminated,
})

const STATUS_FILTERS = [
  "ALL",
  "RUNNING",
  "BUILDING",
  "DEPLOYING",
  "QUEUED",
  "FAILED",
  "STOPPED",
  "TERMINATED",
] as const

export default function AdminStacksPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).console.app.adminStacks
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

  const [stacks, setStacks] = useState<AdminStackDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const [suspendTarget, setSuspendTarget] = useState<AdminStackDTO | null>(null)
  const [resumeTarget, setResumeTarget] = useState<AdminStackDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminStackDTO | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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

        const { data: res } = await eden.api.admin["app-hosting"].stacks.get({
          $query: query,
        })

        if (cancelled) return
        if (!res || !res.ok) {
          setError(messages.loadFailed)
          setStacks([])
          return
        }

        setStacks(res.data)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : messages.loadFailed)
        setStacks([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [messages.loadFailed, orgParam, queryParam, statusParam, reloadTick])

  const refresh = () => setReloadTick((v) => v + 1)

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
      pathname: "/portal/app/stacks",
      locale,
    })
    const target = sp.toString() ? `${base}?${sp.toString()}` : base
    router.push(target)
  }

  const handleSuspend = async () => {
    if (!suspendTarget) return
    setActionLoading(suspendTarget.id)
    try {
      const { data: res } = await eden.api.admin["app-hosting"].stacks[
        suspendTarget.id
      ].suspend.post({})
      if (!res || !res.ok) {
        throw new Error(messages.suspendFailed)
      }
      // Show warning toast if gitops push failed (runtime may not have scaled down)
      if (res.data && !res.data.gitopsPushed) {
        toast.warning(
          messages.suspendPartial.replace("{stack}", suspendTarget.slug)
        )
      } else {
        toast.success(
          messages.suspendSuccess.replace("{stack}", suspendTarget.slug)
        )
      }
      setReloadTick((v) => v + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : messages.suspendFailed)
    } finally {
      setActionLoading(null)
      setSuspendTarget(null)
    }
  }

  const handleResume = async () => {
    if (!resumeTarget) return
    setActionLoading(resumeTarget.id)
    try {
      const { data: res } = await eden.api.admin["app-hosting"].stacks[
        resumeTarget.id
      ].resume.post({})
      if (!res || !res.ok) {
        throw new Error(messages.resumeFailed)
      }
      if (res.data && !res.data.gitopsPushed) {
        toast.warning(
          messages.resumePartial.replace("{stack}", resumeTarget.slug)
        )
      } else {
        toast.success(
          messages.resumeSuccess.replace("{stack}", resumeTarget.slug)
        )
      }
      setReloadTick((v) => v + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : messages.resumeFailed)
    } finally {
      setActionLoading(null)
      setResumeTarget(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(deleteTarget.id)
    try {
      const { data: res } = await eden.api.admin["app-hosting"].stacks[
        deleteTarget.id
      ].delete({})
      if (!res || !res.ok) {
        throw new Error(messages.terminateFailed)
      }
      toast.success(
        messages.terminateScheduledPurge.replace("{stack}", deleteTarget.slug)
      )
      setReloadTick((v) => v + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : messages.terminateFailed)
    } finally {
      setActionLoading(null)
      setDeleteTarget(null)
    }
  }

  const nowMs = new Date().getTime()

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
        >
          <ArrowsClockwise
            size={14}
            className={`mr-1 ${loading ? "animate-spin" : ""}`}
          />
          {messages.refresh}
        </Button>
      </header>

      {/* Filters */}
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
              {STATUS_LABELS(messages)[status]}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.tableOrganization}</TableHead>
              <TableHead>{messages.tableStack}</TableHead>
              <TableHead>{messages.tableStatus}</TableHead>
              <TableHead>{messages.tableCluster}</TableHead>
              <TableHead>{messages.tableResources}</TableHead>
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
            ) : stacks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {messages.empty}
                </TableCell>
              </TableRow>
            ) : (
              stacks.map((stack) => (
                <TableRow key={stack.id}>
                  <TableCell className="text-xs">
                    {stack.organizationName ? (
                      <div>
                        <div
                          className="max-w-[160px] truncate font-medium text-foreground"
                          title={stack.organizationName}
                        >
                          {stack.organizationName}
                        </div>
                        <div
                          className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground"
                          title={stack.organizationId}
                        >
                          {stack.organizationId.length > 16
                            ? `${stack.organizationId.slice(0, 14)}…`
                            : stack.organizationId}
                        </div>
                      </div>
                    ) : (
                      <span
                        className="font-mono text-muted-foreground"
                        title={stack.organizationId}
                      >
                        {stack.organizationId.length > 16
                          ? `${stack.organizationId.slice(0, 14)}…`
                          : stack.organizationId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-foreground">
                      {stack.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px]">
                        {stack.slug}
                      </span>
                      {stack.framework && (
                        <span className="rounded bg-muted/40 px-1 text-[10px]">
                          {stack.framework}
                        </span>
                      )}
                    </div>
                    {(stack.customDomain || stack.subdomain) && (
                      <div className="mt-0.5 max-w-[200px] truncate font-mono text-[10px] text-muted-foreground">
                        {stack.customDomain ?? `${stack.subdomain}`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold uppercase ${STATUS_TONES[stack.status] ?? ""}`}
                    >
                      {stack.status}
                    </Badge>
                    {stack.suspended && (
                      <div className="mt-0.5 text-[10px] font-semibold text-amber-500">
                        {messages.suspendedLabel}
                      </div>
                    )}
                    {stack.status === "TERMINATED" &&
                      stack.scheduledPurgeAt && (
                        <div className="mt-0.5 text-[10px] font-semibold text-rose-400">
                          {messages.purgedLabel.replace(
                            "{days}",
                            String(
                              Math.max(
                                0,
                                Math.ceil(
                                  (new Date(stack.scheduledPurgeAt).getTime() -
                                    nowMs) /
                                    86400000
                                )
                              )
                            )
                          )}
                        </div>
                      )}
                    {stack.billingState && stack.billingState !== "ACTIVE" && (
                      <div className="mt-0.5 text-[10px] text-amber-500">
                        {stack.billingState}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {stack.clusterName ? (
                      <div>
                        <div className="font-medium text-foreground">
                          {stack.clusterName}
                        </div>
                        <div className="font-mono text-[10px]">
                          {stack.clusterCode}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {stack.cpu || stack.memory || stack.replicas ? (
                      <div className="space-y-0.5">
                        {stack.replicas !== null && (
                          <div>
                            <span className="font-mono">{stack.replicas}</span>
                            <span className="ml-1 text-[10px]">
                              {messages.replicas}
                            </span>
                          </div>
                        )}
                        {stack.cpu && (
                          <div className="font-mono text-[11px]">
                            {stack.cpu}m CPU
                          </div>
                        )}
                        {stack.memory && (
                          <div className="font-mono text-[11px]">
                            {stack.memory}Mi RAM
                          </div>
                        )}
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(stack.createdAt).toLocaleString(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {stack.status !== "TERMINATED" &&
                        (stack.suspended || stack.status === "STOPPED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === stack.id}
                            onClick={() => setResumeTarget(stack)}
                            className="h-7 gap-1 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                          >
                            <PlayCircle className="size-3.5" />
                            {messages.resume}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === stack.id}
                            onClick={() => setSuspendTarget(stack)}
                            className="h-7 gap-1 px-2 text-xs text-amber-600 hover:text-amber-700"
                          >
                            <PauseCircle className="size-3.5" />
                            {messages.suspend}
                          </Button>
                        ))}
                      {stack.status !== "TERMINATED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === stack.id}
                          onClick={() => setDeleteTarget(stack)}
                          className="h-7 gap-1 px-2 text-xs text-rose-600 hover:text-rose-700"
                        >
                          <Trash className="size-3.5" />
                          {messages.terminate}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Suspend Confirm Dialog */}
      <AlertDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.suspendTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.suspendDescription.replace(
                "{stack}",
                suspendTarget?.slug ?? ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {messages.suspendConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume Confirm Dialog */}
      <AlertDialog
        open={!!resumeTarget}
        onOpenChange={(open) => !open && setResumeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.resumeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.resumeDescription.replace(
                "{stack}",
                resumeTarget?.slug ?? ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResume}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {messages.resumeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Confirm Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.terminateTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.terminateDescription.replace(
                "{stack}",
                deleteTarget?.slug ?? ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {messages.terminateConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
