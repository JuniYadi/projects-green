"use client"

import * as React from "react"
import {
  Receipt,
  Buildings,
  DeviceMobile,
  Calendar,
  Tag,
  CheckCircle,
  Clock,
  ArrowCounterClockwise,
  MagnifyingGlass,
  Funnel,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PageState = "loading" | "error" | "loaded"

interface LedgerEntry {
  id: string
  organizationId: string
  waMessageId: string
  phoneNumber: string
  category: string
  quotaKey: string
  quotaValue: number
  status: string
  isReverted: boolean
  revertReason: string | null
  revertedAt: string | null
  lastStatus: string | null
  whatsappDeviceId: string | null
  createdAt: string
  updatedAt: string
  devicePhoneNumber?: string | null
}

interface LedgerSummary {
  totalCredits: number
  totalRefundedCredits: number
  activeCredits: number
}

interface OrganizationOption {
  id: string
  name: string
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "UTILITY", label: "Utility" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AUTHENTICATION", label: "Authentication" },
  { value: "SERVICE", label: "Service" },
]

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "CHARGED_PENDING_VERIFY", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "REFUNDED", label: "Refunded / Reverted" },
]

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d)
  } catch {
    return iso
  }
}

function StatusBadge({
  status,
  isReverted,
}: {
  status: string
  isReverted: boolean
}) {
  if (isReverted || status === "REFUNDED" || status === "REVERTED") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        <ArrowCounterClockwise className="mr-1 size-3" />
        Refunded
      </Badge>
    )
  }

  if (status === "CONFIRMED") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        <CheckCircle className="mr-1 size-3" />
        Confirmed
      </Badge>
    )
  }

  if (status === "CHARGED_PENDING_VERIFY") {
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      >
        <Clock className="mr-1 size-3" />
        Pending
      </Badge>
    )
  }

  return <Badge variant="secondary">{status}</Badge>
}

function CategoryBadge({ category }: { category: string }) {
  const c = category?.toUpperCase()
  let color = "bg-secondary text-secondary-foreground"
  if (c === "MARKETING")
    color = "bg-purple-500/10 text-purple-600 border-purple-500/20"
  else if (c === "UTILITY")
    color = "bg-blue-500/10 text-blue-600 border-blue-500/20"
  else if (c === "AUTHENTICATION")
    color = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
  else if (c === "SERVICE")
    color = "bg-sky-500/10 text-sky-600 border-sky-500/20"

  return (
    <Badge variant="outline" className={color}>
      {category}
    </Badge>
  )
}

export default function PortalWhatsAppLedgerPage() {
  const [state, setState] = React.useState<PageState>("loading")
  const [error, setError] = React.useState("")
  const [entries, setEntries] = React.useState<LedgerEntry[]>([])
  const [summary, setSummary] = React.useState<LedgerSummary>({
    totalCredits: 0,
    totalRefundedCredits: 0,
    activeCredits: 0,
  })
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)

  // Filters
  const [organizations, setOrganizations] = React.useState<
    OrganizationOption[]
  >([])
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [selectedOrg, setSelectedOrg] = React.useState<string>("all")
  const [selectedDevice, setSelectedDevice] = React.useState<string>("all")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all")
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all")
  const [search, setSearch] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

  // Load organizations and devices for filters
  React.useEffect(() => {
    let cancelled = false
    const loadMetadata = async () => {
      try {
        const [orgRes, devRes] = await Promise.all([
          eden.api.admin.organizations.get({ $query: { limit: 100 } }),
          eden.api.admin.devices.get({ $query: { take: "200" } }),
        ])

        if (cancelled) return

        const orgBody = orgRes.data as unknown as {
          ok: boolean
          data?: { organizations: OrganizationOption[] }
          organizations?: OrganizationOption[]
        }
        if (orgBody?.ok) {
          setOrganizations(
            orgBody.data?.organizations ?? orgBody.organizations ?? []
          )
        }

        const devBody = devRes.data as unknown as {
          ok: boolean
          devices: DeviceListItem[]
        }
        if (devBody?.ok) {
          setDevices(devBody.devices)
        }
      } catch (err) {
        console.error("Failed to load organizations/devices:", err)
      }
    }

    void loadMetadata()
    return () => {
      cancelled = true
    }
  }, [])

  // Filter devices list based on selected organization
  const filteredDevices = React.useMemo(() => {
    if (selectedOrg === "all") return devices
    return devices.filter((d) => d.organizationId === selectedOrg)
  }, [devices, selectedOrg])

  const effectiveSelectedDevice =
    selectedDevice !== "all" &&
    filteredDevices.some((d) => d.id === selectedDevice)
      ? selectedDevice
      : "all"

  // Org name lookup map
  const orgMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const org of organizations) {
      map.set(org.id, org.name)
    }
    return map
  }, [organizations])

  // Load ledger records
  const loadLedger = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      setState("loading")
      setError("")

      try {
        const params: Record<string, string | number | undefined> = {
          page,
          limit: 20,
        }

        if (selectedOrg !== "all") {
          params.organizationId = selectedOrg
        }
        if (effectiveSelectedDevice !== "all") {
          params.deviceId = effectiveSelectedDevice
        }
        if (selectedCategory !== "all") {
          params.category = selectedCategory
        }
        if (selectedStatus !== "all") {
          params.status = selectedStatus
        }
        if (search.trim()) {
          params.search = search.trim()
        }
        if (dateFrom) {
          params.from = dateFrom
        }
        if (dateTo) {
          params.to = dateTo
        }

        const res = await whatsappClient.usage.ledger(params)

        if (cancelled) return

        if (res.ok) {
          setEntries(res.data as unknown as LedgerEntry[])
          setTotal(res.total)
          setTotalPages(res.totalPages || 1)
          if (res.summary) {
            setSummary(res.summary)
          }
          setState("loaded")
        } else {
          throw new Error("Failed to load ledger records")
        }
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : "Failed to load ledger data."
        setError(message)
        setState("error")
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [
    page,
    selectedOrg,
    effectiveSelectedDevice,
    selectedCategory,
    selectedStatus,
    search,
    dateFrom,
    dateTo,
  ])

  React.useEffect(() => {
    return loadLedger()
  }, [loadLedger])

  const handleResetFilters = () => {
    setSelectedOrg("all")
    setSelectedDevice("all")
    setSelectedCategory("all")
    setSelectedStatus("all")
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          WhatsApp Billing & Quota Ledger
        </h1>
        <p className="text-sm text-muted-foreground">
          Itemized history of message charges, quota deductions, and refunds
          across all organizations.
        </p>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deducted Units
            </CardTitle>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary.totalCredits.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total quota units / messages recorded
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Charges
            </CardTitle>
            <CheckCircle className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.activeCredits.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Net active billed quota units
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Refunded / Reverted
            </CardTitle>
            <ArrowCounterClockwise className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.totalRefundedCredits.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Units restored due to delivery failures
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Narrow down transactions by organization, device, category, status,
            or date range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Organization Filter */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Buildings className="size-3.5" />
                Organization
              </label>
              <select
                aria-label="Filter by organization"
                value={selectedOrg}
                onChange={(e) => {
                  setSelectedOrg(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Device Filter */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <DeviceMobile className="size-3.5" />
                Device
              </label>
              <select
                aria-label="Filter by device"
                value={effectiveSelectedDevice}
                onChange={(e) => {
                  setSelectedDevice(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Devices</option>
                {filteredDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.phoneNumber ?? d.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Tag className="size-3.5" />
                Category
              </label>
              <select
                aria-label="Filter by category"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Funnel className="size-3.5" />
                Status
              </label>
              <select
                aria-label="Filter by status"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                {STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MagnifyingGlass className="size-3.5" />
                Search Phone / WAMID
              </label>
              <Input
                placeholder="6281... or wamid.HBg..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="h-8 text-sm"
              />
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5" />
                From Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="h-8 text-sm"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5" />
                To Date
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="h-8 text-sm"
              />
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 w-full"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Ledger Entries</CardTitle>
            <CardDescription>
              Showing {entries.length} of {total} total transactions
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadLedger()}
                className="mt-3"
              >
                Retry
              </Button>
            </div>
          )}

          {state === "loading" && (
            <div className="space-y-3 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {state === "loaded" && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                No ledger transactions found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try adjusting your filters or date range.
              </p>
            </div>
          )}

          {state === "loaded" && entries.length > 0 && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Device / Recipient</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">
                      Quantity / Value
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes / Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const orgName =
                      orgMap.get(entry.organizationId) ?? entry.organizationId
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {formatDate(entry.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{orgName}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {entry.organizationId}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">
                            {entry.phoneNumber}
                          </div>
                          {entry.devicePhoneNumber && (
                            <div className="text-xs text-muted-foreground">
                              via {entry.devicePhoneNumber}
                            </div>
                          )}
                          <div className="max-w-[180px] truncate font-mono text-[10px] text-muted-foreground">
                            {entry.waMessageId}
                          </div>
                        </TableCell>
                        <TableCell>
                          <CategoryBadge category={entry.category} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {entry.quotaValue} {entry.quotaKey || "unit"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={entry.status}
                            isReverted={entry.isReverted}
                          />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {entry.revertReason ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              Revert: {entry.revertReason}
                            </span>
                          ) : (
                            entry.lastStatus || "-"
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({total} items)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
