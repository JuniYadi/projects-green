"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckCircleIcon,
  Timer,
  XCircleIcon,
  TriangleIcon,
} from "@/components/ui/phosphor-icons"
import type { SubscriptionItem } from "@/lib/billing-client"

type SubscriptionListProps = {
  subscriptions: SubscriptionItem[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "PENDING", label: "Pending" },
]

const statusStyles: Record<string, string> = {
  ACTIVE:
    "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  SUSPENDED:
    "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  CANCELLED:
    "border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-400",
  PENDING: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
}

const invoiceStatusStyles: Record<string, string> = {
  PAID: "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  OPEN: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  OVERDUE: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  DRAFT: "border-muted-foreground/20 bg-muted text-muted-foreground",
  VOID: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  UNCOLLECTIBLE:
    "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
}

function getStatusLabel(status: string): string {
  return statusLabels[status.toUpperCase()] ?? status
}

function getStatusClassName(status: string): string {
  return statusStyles[status.toUpperCase()] ?? statusStyles.CANCELLED
}

function getInvoiceStatusClassName(status: string): string {
  if (!status) return ""
  return invoiceStatusStyles[status.toUpperCase()] ?? ""
}

type Action = { label: string; icon: React.ReactNode }

function getNextAction(sub: SubscriptionItem): Action {
  const status = sub.status.toUpperCase()

  if (status === "ACTIVE" && sub.invoiceStatus === "OVERDUE") {
    return {
      label: "Update payment",
      icon: <TriangleIcon className="size-4" />,
    }
  }
  if (status === "ACTIVE" && sub.currentPeriodEnd) {
    const now = new Date()
    const end = new Date(sub.currentPeriodEnd)
    const daysUntil = Math.ceil(
      (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntil <= 7 && daysUntil >= 0) {
      return { label: "Renew now", icon: <Timer className="size-4" /> }
    }
  }
  if (status === "ACTIVE") {
    return {
      label: "No action needed",
      icon: (
        <CheckCircleIcon className="size-4 text-green-600 dark:text-green-400" />
      ),
    }
  }
  if (status === "SUSPENDED") {
    return {
      label: "Contact support",
      icon: <TriangleIcon className="size-4" />,
    }
  }
  if (status === "CANCELLED") {
    return {
      label: "No action needed",
      icon: <XCircleIcon className="size-4" />,
    }
  }
  return { label: "No action needed", icon: <Timer className="size-4" /> }
}

function formatRenewal(sub: SubscriptionItem): string {
  if (!sub.currentPeriodEnd) return "N/A"
  const end = new Date(sub.currentPeriodEnd)
  const now = new Date()
  if (end < now) {
    return `Expired on ${end.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`
  }
  return `Renews on ${end.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`
}

function getTermLabel(sub: SubscriptionItem): string {
  const period = sub.billingPeriod
  if (period === "MONTHLY") return "Monthly"
  if (period === "QUARTERLY") return "Quarterly"
  if (period === "SEMI_ANNUAL") return "Semi-annual"
  if (period === "ANNUAL") return "Annual"
  return period ?? "N/A"
}

export function SubscriptionList({
  subscriptions,
  isLoading,
  error,
  onRetry,
}: SubscriptionListProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const filtered = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch =
        search === "" ||
        sub.packageCode.toLowerCase().includes(search.toLowerCase()) ||
        sub.planCode.toLowerCase().includes(search.toLowerCase()) ||
        sub.id.toLowerCase().includes(search.toLowerCase())
      const matchesStatus =
        statusFilter === "ALL" ||
        sub.status.toUpperCase() === statusFilter.toUpperCase()
      return matchesSearch && matchesStatus
    })
  }, [subscriptions, search, statusFilter])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No subscriptions found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            No subscriptions match your current filters.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search subscriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onInput={(e) => setSearch(e.currentTarget.value)}
          className="max-w-sm"
          aria-label="Search subscriptions"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table view for desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className="w-full caption-bottom text-sm"
          role="table"
          aria-label="Subscriptions list"
        >
          <thead>
            <tr className="border-b text-left align-middle">
              <th className="p-3 font-medium text-muted-foreground" scope="col">
                Product
              </th>
              <th className="p-3 font-medium text-muted-foreground" scope="col">
                Plan
              </th>
              <th className="p-3 font-medium text-muted-foreground" scope="col">
                Status
              </th>
              <th className="p-3 font-medium text-muted-foreground" scope="col">
                Term
              </th>
              <th className="p-3 font-medium text-muted-foreground" scope="col">
                Renewal
              </th>
              <th className="p-3 font-medium text-muted-foreground" scope="col">
                Invoice
              </th>
              <th className="p-3 font-medium text-muted-foreground" scope="col">
                Next Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sub) => {
              const action = getNextAction(sub)
              return (
                <tr
                  key={sub.id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <td className="p-3 font-medium">{sub.packageCode}</td>
                  <td className="p-3 text-muted-foreground">{sub.planCode}</td>
                  <td className="p-3">
                    <Badge className={getStatusClassName(sub.status)}>
                      {getStatusLabel(sub.status)}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {getTermLabel(sub)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatRenewal(sub)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {sub.invoiceStatus ? (
                      <Badge
                        className={getInvoiceStatusClassName(sub.invoiceStatus)}
                      >
                        {sub.invoiceStatus}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-sm">
                      {action.icon}
                      {action.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Card view for mobile */}
      <div className="space-y-3 md:hidden">
        {filtered.map((sub) => {
          const action = getNextAction(sub)
          return (
            <Card key={sub.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-medium">
                    {sub.packageCode}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {sub.planCode}
                  </p>
                </div>
                <Badge className={getStatusClassName(sub.status)}>
                  {getStatusLabel(sub.status)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Term</span>
                  <span>{getTermLabel(sub)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Renewal</span>
                  <span>{formatRenewal(sub)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span>
                    {sub.invoiceStatus ? (
                      <Badge
                        className={getInvoiceStatusClassName(sub.invoiceStatus)}
                      >
                        {sub.invoiceStatus}
                      </Badge>
                    ) : (
                      "&mdash;"
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Next Action</span>
                  <span className="inline-flex items-center gap-1">
                    {action.icon}
                    {action.label}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
