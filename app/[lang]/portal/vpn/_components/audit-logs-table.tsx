"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowsDownUpIcon,
  CaretDown,
  CaretDownIcon,
  CaretRight,
  CaretUpIcon,
  ClipboardIcon,
} from "@phosphor-icons/react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  listVpnAuditLogs,
  type AuditLogPagination,
  type VpnAuditLogListItem,
} from "./vpn-admin-client"
import {
  actionTone,
  extractAuditDetails,
  type AuditDetailRow,
} from "./audit-details"

const ACTION_OPTIONS = [
  "REGISTERED",
  "REVOKED",
  "CONFIG_DOWNLOADED",
  "PROVISIONING_STARTED",
  "PROVISIONING_SUCCESS",
  "PROVISIONING_FAILED",
  "PROVISIONING_RETRIED",
  "PROVISIONING_STEP",
] as const

const STATUS_OPTIONS = ["OK", "FAILED"] as const

const PAGE_SIZE = 50

const TONE_BADGE: Record<AuditDetailRow["tone"], string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-red-500/15 text-red-700 dark:text-red-400",
  neutral: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function shortId(id: string | null): string {
  if (!id) return "—"
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

function ColumnHeader({
  column,
  title,
}: {
  column: {
    getIsSorted: () => false | "asc" | "desc"
    toggleSorting: (asc: boolean) => void
    getCanHide: () => boolean
  }
  title: string
}) {
  if (!column.getCanHide()) return title
  const sorted = column.getIsSorted()
  const Icon =
    sorted === "asc"
      ? CaretUpIcon
      : sorted === "desc"
        ? CaretDownIcon
        : ArrowsDownUpIcon
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      <Icon className="ml-1 h-3.5 w-3.5" />
    </Button>
  )
}

function getColumns(
  expanded: Set<string>,
  toggleExpand: (id: string) => void
): ColumnDef<VpnAuditLogListItem>[] {
  return [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => {
        const isExpanded = expanded.has(row.original.id)
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(row.original.id)
            }}
            aria-label={isExpanded ? "Collapse row" : "Expand row"}
          >
            {isExpanded ? (
              <CaretDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <CaretRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )
      },
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <ColumnHeader column={column} title="Time" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
      sortingFn: "datetime",
    },
    {
      accessorKey: "action",
      header: ({ column }) => <ColumnHeader column={column} title="Action" />,
      cell: ({ row }) => {
        const action = row.original.action
        const tone = actionTone(action)
        return (
          <Badge
            variant="outline"
            className={`border-transparent ${TONE_BADGE[tone]}`}
          >
            {action}
          </Badge>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original
        const status =
          r.status ??
          (r.details && typeof r.details.status === "string"
            ? r.details.status
            : null)
        if (!status)
          return <span className="text-xs text-muted-foreground">—</span>
        const tone = actionTone(
          status === "OK" ? "SUCCESS" : status === "FAILED" ? "FAILED" : status
        )
        return (
          <Badge
            variant="outline"
            className={`border-transparent ${TONE_BADGE[tone]}`}
          >
            {status}
          </Badge>
        )
      },
      enableSorting: false,
    },
    {
      id: "step",
      accessorFn: (row) =>
        row.step ??
        (row.details && typeof row.details.step === "string"
          ? row.details.step
          : "") ??
        "",
      header: "Step",
      cell: ({ row }) => {
        const r = row.original
        const step =
          r.step ??
          (r.details && typeof r.details.step === "string"
            ? r.details.step
            : null)
        return step ? (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{step}</code>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )
      },
      enableSorting: false,
    },
    {
      id: "target",
      accessorFn: (row) => {
        const detailsServerId =
          row.details && typeof row.details.serverAccountId === "string"
            ? (row.details.serverAccountId as string)
            : null
        return (
          row.serverAccountId ??
          detailsServerId ??
          row.deviceId ??
          row.userId ??
          ""
        )
      },
      header: "Account / Actor",
      cell: ({ row }) => {
        const r = row.original
        const detailsServerId =
          r.details && typeof r.details.serverAccountId === "string"
            ? (r.details.serverAccountId as string)
            : null
        const who = r.adminId
          ? `admin:${shortId(r.adminId)}`
          : r.userId
            ? `user:${shortId(r.userId)}`
            : null
        const target = r.serverAccountId
          ? `srv:${shortId(r.serverAccountId)}`
          : detailsServerId
            ? `srv:${shortId(detailsServerId)}`
            : r.deviceId
              ? `dev:${shortId(r.deviceId)}`
              : null
        return (
          <div className="flex flex-col gap-0.5">
            {target ? (
              <span className="font-mono text-xs">{target}</span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
            {who && (
              <span className="text-xs text-muted-foreground">{who}</span>
            )}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const count = row.original.details
          ? Object.keys(row.original.details).length
          : 0
        return (
          <span className="text-xs text-muted-foreground">
            {count > 0 ? `${count} field${count === 1 ? "" : "s"}` : "—"}
          </span>
        )
      },
      enableSorting: false,
    },
  ]
}

function ExpandedDetails({ item }: { item: VpnAuditLogListItem }) {
  const { rows, other } = useMemo(
    () =>
      extractAuditDetails({
        details: item.details,
        step: item.step,
        status: item.status,
        serverAccountId: item.serverAccountId,
        deviceId: item.deviceId,
        userId: item.userId,
        adminId: item.adminId,
        ip: item.ip,
        userAgent: item.userAgent,
        action: item.action,
      }),
    [item]
  )

  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  const rawJson = useMemo(() => {
    try {
      return JSON.stringify(item.details ?? {}, null, 2)
    } catch {
      return "{}"
    }
  }, [item.details])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable in insecure contexts — no-op.
    }
  }

  const allRows = [...rows, ...other]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {allRows.map((row, idx) => (
          <div key={`${row.label}-${idx}`} className="flex gap-2 text-sm">
            <span className="w-36 shrink-0 text-muted-foreground">
              {row.label}
            </span>
            <span
              className={`min-w-0 font-medium break-words ${
                row.tone === "neutral"
                  ? ""
                  : TONE_BADGE[row.tone].replace(/text-\S+/, "").trim()
              }`}
              style={
                row.tone === "neutral" ? undefined : { color: "currentColor" }
              }
            >
              <span className={TONE_BADGE[row.tone]}>{row.value}</span>
            </span>
          </div>
        ))}
        {allRows.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No detail payload for this entry.
          </span>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRaw((s) => !s)}
          >
            {showRaw ? "Hide raw JSON" : "Show raw JSON"}
          </Button>
          <Button variant="outline" size="sm" onClick={copy}>
            <ClipboardIcon className="mr-1.5 h-3.5 w-3.5" />
            {copied ? "Copied!" : "Copy JSON"}
          </Button>
        </div>
        {showRaw && (
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
            {rawJson}
          </pre>
        )}
      </div>
    </div>
  )
}

export function AuditLogsTable() {
  const [data, setData] = useState<VpnAuditLogListItem[]>([])
  const [pagination, setPagination] = useState<AuditLogPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  // Commit filters on Apply so we don't refetch on every keystroke.
  const [committed, setCommitted] = useState({
    action: "all",
    status: "all",
    q: "",
    from: "",
    to: "",
  })

  // Table state
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false

    const fetchAudit = async () => {
      try {
        setError(null)
        setLoading(true)
        const res = await listVpnAuditLogs({
          page,
          limit: PAGE_SIZE,
          action: committed.action === "all" ? undefined : committed.action,
          status: committed.status === "all" ? undefined : committed.status,
          q: committed.q || undefined,
          from: committed.from || undefined,
          to: committed.to || undefined,
        })
        if (cancelled) return
        setData(res.data)
        setPagination(res.pagination)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAudit()

    return () => {
      cancelled = true
    }
  }, [reloadKey, page, committed])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const applyFilters = () => {
    setCommitted({
      action: actionFilter,
      status: statusFilter,
      q: search.trim(),
      from,
      to,
    })
    setPage(1)
  }

  const resetFilters = () => {
    setActionFilter("all")
    setStatusFilter("all")
    setSearch("")
    setFrom("")
    setTo("")
    setCommitted({ action: "all", status: "all", q: "", from: "", to: "" })
    setPage(1)
  }

  const columns = useMemo(
    () => getColumns(expanded, toggleExpand),
    [expanded, toggleExpand]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    manualPagination: true,
    pageCount: pagination?.totalPages ?? -1,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (loading && data.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Action
            </label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]" size="sm">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Search (account / device / user / admin ID)
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters()
              }}
              placeholder="e.g. srv_abc123"
              className="lg:max-w-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[150px]"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters}>
              Apply
            </Button>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={reload} title="Reload">
              <ArrowsDownUpIcon className="h-3.5 w-3.5 rotate-90" />
              <span className="sr-only">Reload</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const item = row.original
                const isExpanded = expanded.has(item.id)
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="bg-muted/30 p-4"
                        >
                          <ExpandedDetails item={item} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No audit entries match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>
            –
            <span className="font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of <span className="font-medium">{pagination.total}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
