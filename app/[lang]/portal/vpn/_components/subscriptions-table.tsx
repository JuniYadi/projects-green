"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  CaretDownIcon,
  CaretUpIcon,
  ArrowsDownUpIcon,
  DeviceMobileIcon,
  X,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  listVpnAdminSubscriptions,
  type VpnSubscriptionItem,
  type ProvisioningSummary,
  type VpnAdminSubscriptionsQuery,
  type PaginationMeta,
} from "./vpn-admin-client"
import { usePersistedColumnVisibility } from "@/hooks/use-persisted-column-visibility"

const STATUS_VARIANT: Record<
  VpnSubscriptionItem["status"],
  "default" | "secondary" | "destructive"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "destructive",
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
  column: {
    getIsSorted: () => false | "asc" | "desc"
    toggleSorting: (asc: boolean) => void
    getCanHide: () => boolean
  }
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

function getColumns(): ColumnDef<VpnSubscriptionItem>[] {
  return [
    {
      accessorKey: "id",
      header: ({ column }) => <ColumnHeader column={column} title="ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">
          {row.original.id.slice(0, 8)}...
        </span>
      ),
    },
    {
      accessorKey: "organizationName",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Organization" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.organizationName ?? row.original.organizationId}
        </span>
      ),
    },
    {
      accessorKey: "packageName",
      header: ({ column }) => <ColumnHeader column={column} title="Package" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.packageName}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {row.original.status}
        </Badge>
      ),
      filterFn: "equals",
    },
    {
      accessorKey: "deviceCount",
      header: ({ column }) => <ColumnHeader column={column} title="Devices" />,
      cell: ({ row }) => (
        <a
          href={`/portal/vpn/devices?subscriptionId=${row.original.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <DeviceMobileIcon className="h-4 w-4 text-muted-foreground" />
          {row.original.deviceCount}
        </a>
      ),
    },
    {
      accessorKey: "priceLocked",
      header: ({ column }) => <ColumnHeader column={column} title="Price" />,
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
      header: ({ column }) => <ColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
      sortingFn: "datetime",
    },
  ]
}

function extractUnique(
  items: VpnSubscriptionItem[],
  key: (item: VpnSubscriptionItem) => string | null
): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const val = key(item)
    if (val) set.add(val)
  }
  return [...set].sort()
}

export function SubscriptionsTable() {
  const router = useRouter()
  const [subs, setSubs] = useState<VpnSubscriptionItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [orgFilter, setOrgFilter] = useState("all")
  const [pkgFilter, setPkgFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = usePersistedColumnVisibility(
    "portal-vpn-subscriptions"
  )

  const fetchSubs = useCallback(async (filters: VpnAdminSubscriptionsQuery) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listVpnAdminSubscriptions(filters)
      setSubs(res.data)
      setPagination(res.pagination)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search, fire immediately for everything else
  useEffect(() => {
    const timer = setTimeout(
      () => {
        const query: VpnAdminSubscriptionsQuery = { page }
        if (orgFilter !== "all") query.orgId = orgFilter
        if (pkgFilter !== "all") query.packageId = pkgFilter
        if (statusFilter !== "all")
          query.status = statusFilter as "ACTIVE" | "SUSPENDED" | "EXPIRED"
        if (dateFrom) query.periodStartFrom = dateFrom
        if (dateTo) query.periodStartTo = dateTo
        if (searchQuery.trim()) query.q = searchQuery.trim()

        fetchSubs(query)
      },
      searchQuery ? 300 : 0
    )

    return () => clearTimeout(timer)
  }, [
    orgFilter,
    pkgFilter,
    statusFilter,
    dateFrom,
    dateTo,
    searchQuery,
    page,
    fetchSubs,
  ])

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1)
  }, [orgFilter, pkgFilter, statusFilter, dateFrom, dateTo, searchQuery])

  const columns = useMemo(() => getColumns(), [])

  // ponytail: useReactTable API is incompatible with React Compiler — this is a known TanStack Table limitation
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: subs,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const hasActiveFilters =
    orgFilter !== "all" ||
    pkgFilter !== "all" ||
    statusFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    searchQuery.trim() !== ""

  const clearFilters = () => {
    setOrgFilter("all")
    setPkgFilter("all")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
    setSearchQuery("")
    setPage(1)
  }

  // Extract unique org/package names from current data for dropdown options
  const orgOptions = useMemo(
    () => extractUnique(subs, (s) => s.organizationName),
    [subs]
  )
  const pkgOptions = useMemo(
    () => extractUnique(subs, (s) => s.packageName),
    [subs]
  )

  const start =
    subs.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)

  if (loading && subs.length === 0) {
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, org..."
            className="w-full sm:max-w-sm"
            aria-label="Search subscriptions"
          />

          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[180px]" size="sm">
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={pkgFilter} onValueChange={setPkgFilter}>
            <SelectTrigger className="w-[180px]" size="sm">
              <SelectValue placeholder="All packages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All packages</SelectItem>
              {pkgOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue placeholder="All status" />
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}

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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/portal/vpn/subscriptions/${row.original.id}`)
                  }
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {hasActiveFilters
                    ? "No subscriptions match the current filters."
                    : "No subscriptions found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {start}-{end} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
