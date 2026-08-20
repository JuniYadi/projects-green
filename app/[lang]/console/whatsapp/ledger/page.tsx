"use client"

import * as React from "react"
import {
  Receipt,
  CheckCircle,
  Clock,
  ArrowCounterClockwise,
  Phone,
  Funnel,
  MagnifyingGlass,
  ArrowRight,
  ArrowsClockwise,
} from "@phosphor-icons/react"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useParams, useSearchParams } from "next/navigation"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
import Link from "next/link"
import type { WhatsappBillingLedgerEntryDTO } from "@/modules/whatsapp/usage/usage.dto"

type LedgerEntry = {
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

function formatDate(iso: string | Date): string {
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso
    return d.toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(iso)
  }
}

export default function WhatsAppLedgerPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = resolveLocaleOrDefault(params?.lang as string | undefined)

  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<LedgerEntry[]>([])
  const [summary, setSummary] = React.useState({
    totalCredits: 0,
    totalRefundedCredits: 0,
    activeCredits: 0,
  })
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)

  const [statusFilter, setStatusFilter] = React.useState(
    searchParams.get("status") || "all"
  )
  const [categoryFilter, setCategoryFilter] = React.useState(
    searchParams.get("category") || "all"
  )
  const [searchQuery, setSearchQuery] = React.useState(
    searchParams.get("search") || ""
  )
  const [devices, setDevices] = React.useState<
    { id: string; phoneNumber: string }[]
  >([])
  const [selectedDevice, setSelectedDevice] = React.useState(
    searchParams.get("deviceId") || "all"
  )

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await whatsappClient.usage.ledger({
          page,
          limit: 20,
          status: statusFilter !== "all" ? statusFilter : undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          deviceId: selectedDevice !== "all" ? selectedDevice : undefined,
          search: searchQuery.trim() || undefined,
        })
        if (cancelled) return
        if (res && res.ok) {
          setData((res.data as unknown as LedgerEntry[]) ?? [])
          setTotal(res.total ?? 0)
          setTotalPages(res.totalPages ?? 1)
          if (res.summary) setSummary(res.summary)
        }
      } catch (err) {
        console.error("Failed to load WhatsApp ledger:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, statusFilter, categoryFilter, selectedDevice, searchQuery])

  React.useEffect(() => {
    whatsappClient.devices
      .list()
      .then(
        (res: {
          ok: boolean
          devices?: { id: string; phoneNumber: string }[]
        }) => {
          if (res && res.ok && Array.isArray(res.devices)) {
            setDevices(
              res.devices.map((d) => ({
                id: d.id,
                phoneNumber: d.phoneNumber,
              }))
            )
          }
        }
      )
      .catch(() => {})
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            WhatsApp Deduction & Refund Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Itemized record of quota credits deducted, balance charged, and
            automatic refunds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p)}
            disabled={loading}
            className="gap-1.5"
          >
            <ArrowsClockwise
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="default" size="sm" asChild className="gap-1.5">
            <Link
              href={localizePathname({
                pathname: "/console/whatsapp/usage",
                locale,
              })}
            >
              View Usage Overview
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deducted Credits</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {summary.totalCredits.toLocaleString()} Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total quota credits reserved/debited across all dispatches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Refunded / Reverted</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-500">
              {summary.totalRefundedCredits.toLocaleString()} Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Automatically refunded due to Meta delivery rejection
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Billed Credits</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {summary.activeCredits.toLocaleString()} Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Confirmed delivered message quota
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={handleSearch}
            className="grid gap-4 md:grid-cols-4 lg:grid-cols-5"
          >
            <div className="relative">
              <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search phone or wamid..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PENDING">Pending Verify</SelectItem>
                <SelectItem value="REFUNDED">Refunded / Reverted</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="UTILITY">UTILITY</SelectItem>
                <SelectItem value="MARKETING">MARKETING</SelectItem>
                <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                <SelectItem value="SERVICE">SERVICE</SelectItem>
                <SelectItem value="REPLY">REPLY</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedDevice}
              onValueChange={(val) => {
                setSelectedDevice(val)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.phoneNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="submit" variant="secondary" className="gap-2">
              <Funnel className="size-4" />
              Apply Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source Type</TableHead>
                <TableHead>Deduction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Meta Message ID / Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <Receipt className="mx-auto mb-2 size-8 opacity-40" />
                    No deduction ledger entries found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                data.map((row) => {
                  const isRefunded =
                    row.isReverted || row.status === "REVERTED_FAILED"
                  const isConfirmed = row.status === "CONFIRMED"
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Phone className="size-3.5 text-muted-foreground" />
                          <span>{row.phoneNumber}</span>
                        </div>
                        {row.devicePhoneNumber && (
                          <span className="text-[11px] text-muted-foreground">
                            via {row.devicePhoneNumber}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold"
                        >
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        >
                          QUOTA_ALLOWANCE
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        {isRefunded ? (
                          <span className="text-muted-foreground line-through">
                            {row.quotaValue} credits
                          </span>
                        ) : (
                          <span>{row.quotaValue} credits</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isRefunded ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          >
                            <ArrowCounterClockwise className="size-3" />
                            REFUNDED
                          </Badge>
                        ) : isConfirmed ? (
                          <Badge
                            variant="default"
                            className="gap-1 bg-emerald-600 text-white"
                          >
                            <CheckCircle className="size-3" weight="fill" />
                            CONFIRMED
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="size-3" />
                            PENDING
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          {row.waMessageId}
                        </div>
                        {row.revertReason && (
                          <div className="max-w-[220px] truncate text-[11px] text-amber-600 dark:text-amber-400">
                            {row.revertReason}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <span className="text-xs text-muted-foreground">
                Showing page {page} of {totalPages} ({total} entries)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
