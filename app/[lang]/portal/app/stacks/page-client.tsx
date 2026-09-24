"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { usePersistedColumnVisibility } from "@/hooks/use-persisted-column-visibility"
import type { AdminStackDTO } from "@/modules/deploy/admin-stacks.service"
import {
  ArrowsClockwise,
  CaretDown,
  Globe,
  MagnifyingGlass,
  PauseCircle,
  Play,
  PlayCircle,
  SlidersHorizontal,
  Trash,
} from "@phosphor-icons/react"

const STATUS_TONES: Record<string, string> = {
  IDLE: "border-border bg-muted/40 text-muted-foreground",
  RUNNING: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  FAILED: "border-rose-500/20 bg-rose-500/10 text-rose-500",
  BUILDING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  DEPLOYING: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  QUEUED: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  STOPPED: "border-border bg-muted/40 text-muted-foreground",
  TERMINATED: "border-rose-500/20 bg-rose-500/10 text-rose-400",
}

const STATUS_LABELS = (
  messages: ReturnType<typeof getMessages>["console"]["app"]["adminStacks"]
): Record<string, string> => ({
  ALL: messages.statusAll,
  IDLE: messages.statusIdle,
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
  "IDLE",
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
  const [deployTarget, setDeployTarget] = useState<AdminStackDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminStackDTO | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [columnVisibility, setColumnVisibility] = usePersistedColumnVisibility(
    "portal-admin-stacks-table",
    {}
  )

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
      setSuspendTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : messages.suspendFailed)
    } finally {
      setActionLoading(null)
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
      setResumeTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : messages.resumeFailed)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeploy = async () => {
    if (!deployTarget) return
    setActionLoading(deployTarget.id)
    try {
      const { data: res } = await eden.api.admin["app-hosting"].stacks[
        deployTarget.id
      ].deploy.post({})
      if (!res || !res.ok) {
        throw new Error(
          messages.deployFailed.replace("{stack}", deployTarget.slug)
        )
      }
      toast.success(
        messages.deploySuccess.replace("{stack}", deployTarget.slug)
      )
      setReloadTick((v) => v + 1)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : messages.deployFailed.replace("{stack}", deployTarget.slug)
      )
    } finally {
      setActionLoading(null)
      setDeployTarget(null)
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
      const result = res.data
      if (
        result &&
        (!result.gitopsDeleted ||
          !result.argocdDeleted ||
          !result.stockReleased)
      ) {
        toast.warning(
          messages.terminatePartial.replace("{stack}", deleteTarget.slug)
        )
      } else {
        toast.success(
          messages.terminateSuccess.replace("{stack}", deleteTarget.slug)
        )
      }
      setReloadTick((v) => v + 1)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : messages.terminateFailed)
    } finally {
      setActionLoading(null)
    }
  }

  const columns = useMemo<ColumnDef<AdminStackDTO>[]>(
    () => [
      {
        id: "organization",
        accessorFn: (row) => row.organizationName ?? row.organizationId,
        header: messages.tableOrganization,
        enableHiding: true,
        cell: ({ row }) => {
          const stack = row.original
          return (
            <div className="text-xs">
              {stack.organizationName ? (
                <div>
                  <div
                    className="max-w-[170px] truncate font-medium text-foreground"
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
            </div>
          )
        },
      },
      {
        id: "platform",
        accessorFn: (row) => row.name,
        header: messages.tableStack,
        enableHiding: false,
        cell: ({ row }) => {
          const stack = row.original
          const domain = stack.customDomain ?? stack.subdomain
          const isNameDifferent = stack.slug !== stack.name

          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {stack.name}
                </span>
                {stack.framework && (
                  <Badge
                    variant="secondary"
                    className="h-4.5 px-1.5 text-[10px] font-medium"
                  >
                    {stack.framework}
                  </Badge>
                )}
              </div>
              {isNameDifferent && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  {stack.slug}
                </div>
              )}
              {domain && (
                <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <Globe size={11} className="shrink-0" />
                  <span className="max-w-[220px] truncate">{domain}</span>
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: messages.tableStatus,
        enableHiding: true,
        cell: ({ row }) => {
          const stack = row.original
          return (
            <div>
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
              {stack.billingState && stack.billingState !== "ACTIVE" && (
                <div className="mt-0.5 text-[10px] text-amber-500">
                  {stack.billingState}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: "cluster",
        accessorFn: (row) => row.clusterName ?? row.clusterCode,
        header: messages.tableCluster,
        enableHiding: true,
        cell: ({ row }) => {
          const stack = row.original
          if (!stack.clusterName) {
            return <span className="text-muted-foreground">—</span>
          }
          return (
            <div className="text-xs">
              <div className="font-medium text-foreground">
                {stack.clusterName}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {stack.clusterCode}
              </div>
            </div>
          )
        },
      },
      {
        id: "resources",
        header: messages.tableResources,
        enableHiding: true,
        cell: ({ row }) => {
          const stack = row.original
          const hasSpecs = stack.cpu || stack.memory || stack.replicas !== null
          if (!hasSpecs) {
            return <span className="text-xs text-muted-foreground">—</span>
          }

          return (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {stack.replicas !== null && (
                <div>
                  <span className="font-mono font-medium text-foreground">
                    {stack.replicas}
                  </span>
                  <span className="ml-1 text-[10px]">{messages.replicas}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                {stack.cpu && <span>{stack.cpu}m CPU</span>}
                {stack.cpu && stack.memory && <span>•</span>}
                {stack.memory && <span>{stack.memory}Mi RAM</span>}
              </div>
            </div>
          )
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: messages.tableCreated,
        enableHiding: true,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString(locale, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">{messages.tableAction}</div>,
        enableHiding: false,
        cell: ({ row }) => {
          const stack = row.original
          const isTerminated = stack.status === "TERMINATED"

          if (isTerminated) {
            if (!stack.gitopsCleanedUp) {
              return (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading === stack.id}
                    onClick={() => setDeleteTarget(stack)}
                    className="h-7 gap-1 px-2 text-xs text-rose-600 hover:text-rose-700"
                  >
                    <Trash className="size-3.5" />
                    {messages.retryCleanup}
                  </Button>
                </div>
              )
            }
            return (
              <div className="text-right">
                <span className="text-xs text-muted-foreground">
                  {messages.statusTerminated}
                </span>
              </div>
            )
          }

          return (
            <div className="flex items-center justify-end gap-1.5">
              {stack.suspended || stack.status === "STOPPED" ? (
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
              )}

              {(stack.status === "IDLE" || stack.status === "FAILED") && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading === stack.id}
                  onClick={() => setDeployTarget(stack)}
                  className="h-7 gap-1 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                >
                  <Play className="size-3.5" />
                  {messages.deploy}
                </Button>
              )}

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
            </div>
          )
        },
      },
    ],
    [locale, messages, actionLoading]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: stacks,
    columns,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  })

  const COLUMN_LABELS: Record<string, string> = {
    organization: messages.tableOrganization,
    platform: messages.tableStack,
    status: messages.tableStatus,
    cluster: messages.tableCluster,
    resources: messages.tableResources,
    createdAt: messages.tableCreated,
    actions: messages.tableAction,
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
        <div className="flex items-center gap-2">
          {/* Column Show/Hide Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <SlidersHorizontal size={14} />
                <span>{messages.columns}</span>
                <CaretDown size={12} className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{messages.toggleColumns}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(checked) =>
                      col.toggleVisibility(Boolean(checked))
                    }
                  >
                    {COLUMN_LABELS[col.id] ?? col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-8"
          >
            <ArrowsClockwise
              size={14}
              className={`mr-1 ${loading ? "animate-spin" : ""}`}
            />
            {messages.refresh}
          </Button>
        </div>
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
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {messages.loading}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-32 text-center text-sm text-rose-500"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {messages.empty}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
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

      {/* Deploy Confirm Dialog */}
      <AlertDialog
        open={!!deployTarget}
        onOpenChange={(open) => !open && setDeployTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.deployTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.deployDescription.replace(
                "{stack}",
                deployTarget?.slug ?? ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeploy}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {messages.deployConfirm}
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
