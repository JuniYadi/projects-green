"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  CaretDown,
  CaretRight,
  Eye,
  ArrowsDownUpIcon,
  CaretDownIcon,
  CaretUpIcon,
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
import { DeviceMobileIcon } from "@phosphor-icons/react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  listVpnAdminSubscriptions,
  retryVpnServerAccount,
  revokeVpnServerAccount,
  retryAllVpnServerAccounts,
  validateVpnServerAccount,
  recreateVpnServerAccount,
  type VpnSubscriptionItem,
  type VpnServerAccountEntry,
  type ProvisioningSummary,
} from "./vpn-admin-client"
import { ProvisioningAuditModal } from "./provisioning-audit-modal"

const STATUS_VARIANT: Record<
  VpnSubscriptionItem["status"],
  "default" | "secondary" | "destructive"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "destructive",
}

const PROVISION_VARIANT: Record<
  VpnServerAccountEntry["provisioningStatus"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  PENDING: "outline",
  PROVISIONING: "secondary",
  FAILED: "destructive",
  REVOKED: "secondary",
}

const STATUS_FILTER_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Expired", value: "EXPIRED" },
]

function SummaryBadges({ summary }: { summary: ProvisioningSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {summary.active > 0 && (
        <Badge variant="default" className="text-xs">
          {summary.active} ACTIVE
        </Badge>
      )}
      {summary.pending > 0 && (
        <Badge variant="outline" className="text-xs">
          {summary.pending} PENDING
        </Badge>
      )}
      {summary.failed > 0 && (
        <Badge variant="destructive" className="text-xs">
          {summary.failed} FAILED
        </Badge>
      )}
      {summary.revoked > 0 && (
        <Badge variant="secondary" className="text-xs">
          {summary.revoked} REVOKED
        </Badge>
      )}
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(amount: string, currency: string) {
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

function ColumnHeader({
  column,
  title,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (asc: boolean) => void; getCanHide: () => boolean }
  title: string
}) {
  if (!column.getCanHide()) {
    return title
  }

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
): ColumnDef<VpnSubscriptionItem>[] {
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
      accessorKey: "id",
      header: ({ column }) => (
        <ColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/portal/vpn/subscriptions/${row.original.id}`}
          className="font-mono text-xs text-foreground underline-offset-4 hover:underline"
        >
          {row.original.id.slice(0, 8)}...
        </Link>
      ),
    },
    {
      accessorKey: "organizationName",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Organization" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-sm">
          {row.original.organizationName ?? row.original.organizationId}
        </span>
      ),
    },
    {
      accessorKey: "packageName",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Package" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.packageName}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {row.original.status}
        </Badge>
      ),
      filterFn: "equals",
    },
    {
      accessorKey: "deviceCount",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Devices" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/portal/vpn/devices?subscriptionId=${row.original.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
          {row.original.deviceCount}
        </Link>
      ),
    },
    {
      accessorKey: "priceLocked",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Price" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {formatCurrency(row.original.priceLocked, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "currentPeriodStart",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Period Start" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.currentPeriodStart)}
        </span>
      ),
      sortingFn: "datetime",
    },
    {
      accessorKey: "currentPeriodEnd",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Period End" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.currentPeriodEnd)}
        </span>
      ),
      sortingFn: "datetime",
    },
    {
      accessorKey: "provisioningSummary",
      header: "Provisioning",
      cell: ({ row }) => (
        <SummaryBadges summary={row.original.provisioningSummary} />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
      sortingFn: "datetime",
    },
  ]
}

export function SubscriptionsTable() {
  const [subs, setSubs] = useState<VpnSubscriptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [auditAccount, setAuditAccount] = useState<VpnServerAccountEntry | null>(
    null
  )
  const [reloadKey, setReloadKey] = useState(0)

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")

  useEffect(() => {
    let cancelled = false

    const fetchSubs = async () => {
      try {
        setError(null)
        const res = await listVpnAdminSubscriptions()
        if (!cancelled) setSubs(res.data)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSubs()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const toggleExpand = useCallback((subId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(subId)) next.delete(subId)
      else next.add(subId)
      return next
    })
  }, [])

  const columns = useMemo(
    () => getColumns(expanded, toggleExpand),
    [expanded, toggleExpand]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: subs,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    globalFilterFn: (row, _, filterValue) => {
      const searchValue = String(filterValue ?? "")
        .trim()
        .toLowerCase()

      if (!searchValue) return true

      const searchable = [
        "id",
        "organizationName",
        "packageName",
        "status",
      ]
      return searchable.some((col) => {
        const value = row.getValue(col)
        return String(value ?? "")
          .toLowerCase()
          .includes(searchValue)
      })
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const act = async (
    subId: string,
    account: VpnServerAccountEntry,
    action: "retry" | "revoke" | "validate" | "recreate"
  ) => {
    if (
      action === "revoke" &&
      !window.confirm(`Revoke ${account.protocol} on ${account.serverName}?`)
    )
      return
    if (
      action === "recreate" &&
      !window.confirm(
        `Recreate ${account.protocol} account on ${account.serverName}? This clears stored config/credentials and queues provisioning again.`
      )
    )
      return

    setBusy(`${action}:${account.id}`)
    try {
      if (action === "retry") {
        await retryVpnServerAccount(subId, account.id)
        reload()
      } else if (action === "revoke") {
        await revokeVpnServerAccount(subId, account.id)
        reload()
      } else if (action === "recreate") {
        await recreateVpnServerAccount(subId, account.id)
        reload()
      } else {
        const result = await validateVpnServerAccount(subId, account.id)
        window.alert(
          result.data.exists
            ? `Account exists on server.\n\n${result.data.message}`
            : `Account is missing on server.\n\n${result.data.message}`
        )
      }
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const retryAllFailed = async (subId: string) => {
    if (!window.confirm("Retry provisioning for all failed accounts?")) return
    setBusy(subId)
    try {
      await retryAllVpnServerAccounts(subId)
      reload()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
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

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search by ID, org, package..."
          className="w-full sm:max-w-sm"
          aria-label="Search subscriptions"
        />
        <div className="flex flex-wrap gap-3 sm:ml-auto">
          <Select
            value={String(
              table.getColumn("status")?.getFilterValue() ?? "all"
            )}
            onValueChange={(val) =>
              table
                .getColumn("status")
                ?.setFilterValue(val === "all" ? undefined : val)
            }
          >
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                Columns
                <CaretDownIcon className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={(checked) =>
                      col.toggleVisibility(Boolean(checked))
                    }
                  >
                    {col.id.replace(/([A-Z])/g, " $1").trim()}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                const sub = row.original
                const isExpanded = expanded.has(sub.id)
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleExpand(sub.id)}
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
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">
                                Server Accounts
                              </h4>
                              {sub.provisioningSummary.failed > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy === sub.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    retryAllFailed(sub.id)
                                  }}
                                >
                                  {busy === sub.id
                                    ? "Retrying..."
                                    : "Retry All Failed"}
                                </Button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {sub.serverAccounts.map((account) => (
                                <div
                                  key={account.id}
                                  className="flex items-center justify-between rounded-md border bg-background p-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">
                                        {account.serverName}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {account.protocol} · {account.username}
                                      </span>
                                    </div>
                                    <Badge
                                      variant={
                                        PROVISION_VARIANT[
                                          account.provisioningStatus
                                        ]
                                      }
                                    >
                                      {account.provisioningStatus}
                                    </Badge>
                                    {account.failureReason && (
                                      <span className="max-w-xs truncate text-xs text-red-500">
                                        {account.failureReason}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="View Audit Log"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setAuditAccount(account)
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={busy?.endsWith(account.id)}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        act(sub.id, account, "validate")
                                      }}
                                    >
                                      {busy === `validate:${account.id}`
                                        ? "Validating..."
                                        : "Validate"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={busy?.endsWith(account.id)}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        act(sub.id, account, "recreate")
                                      }}
                                    >
                                      {busy === `recreate:${account.id}`
                                        ? "Recreating..."
                                        : "Recreate"}
                                    </Button>
                                    {(account.provisioningStatus === "FAILED" ||
                                      account.provisioningStatus ===
                                        "PENDING") && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy?.endsWith(account.id)}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          act(sub.id, account, "retry")
                                        }}
                                      >
                                        Retry
                                      </Button>
                                    )}
                                    {(account.provisioningStatus === "ACTIVE" ||
                                      account.provisioningStatus === "FAILED" ||
                                      account.provisioningStatus ===
                                        "PENDING") && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy?.endsWith(account.id)}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          act(sub.id, account, "revoke")
                                        }}
                                      >
                                        Revoke
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
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
                  No subscriptions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {auditAccount && (
        <ProvisioningAuditModal
          account={auditAccount}
          open={!!auditAccount}
          onClose={() => setAuditAccount(null)}
        />
      )}
    </div>
  )
}
