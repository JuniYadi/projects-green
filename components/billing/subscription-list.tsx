"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
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
import { getMessages } from "@/lib/i18n/messages"
import type { AppMessages } from "@/lib/i18n/messages/types"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type SubscriptionListProps = {
  subscriptions: SubscriptionItem[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

type SubscriptionMessages = AppMessages["console"]["billing"]["subscriptions"]

const STATUS_FILTER_VALUES = [
  "ALL",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
  "PENDING",
] as const

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

function getStatusLabel(status: string, t: SubscriptionMessages): string {
  const labels: Record<string, string> = {
    ACTIVE: t.statusFilterActive,
    SUSPENDED: t.statusFilterSuspended,
    CANCELLED: t.statusFilterCancelled,
    PENDING: t.statusFilterPending,
  }
  return labels[status.toUpperCase()] ?? status
}

function getStatusClassName(status: string): string {
  return statusStyles[status.toUpperCase()] ?? statusStyles.CANCELLED
}

function getStatusIcon(status: string): React.ReactNode {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return <CheckCircleIcon aria-hidden="true" className="size-4" />
    case "SUSPENDED":
      return <TriangleIcon aria-hidden="true" className="size-4" />
    case "CANCELLED":
      return <XCircleIcon aria-hidden="true" className="size-4" />
    default:
      return <Timer aria-hidden="true" className="size-4" />
  }
}

function getInvoiceStatusClassName(status: string): string {
  if (!status) return ""
  return invoiceStatusStyles[status.toUpperCase()] ?? ""
}

type Action = { label: string; icon: React.ReactNode }

function getNextAction(sub: SubscriptionItem, t: SubscriptionMessages): Action {
  const status = sub.status.toUpperCase()

  if (status === "ACTIVE" && sub.invoiceStatus === "OVERDUE") {
    return {
      label: t.actionPayInvoice,
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
      return { label: t.actionRenewNow, icon: <Timer className="size-4" /> }
    }
  }
  if (status === "ACTIVE") {
    return {
      label: t.actionNoActionNeeded,
      icon: (
        <CheckCircleIcon className="size-4 text-green-600 dark:text-green-400" />
      ),
    }
  }
  if (status === "PENDING") {
    return {
      label: t.actionServiceBeingPrepared,
      icon: <Timer className="size-4" />,
    }
  }
  if (status === "SUSPENDED") {
    return {
      label: t.actionContactSupport,
      icon: <TriangleIcon className="size-4" />,
    }
  }
  return {
    label: t.actionNoActionNeeded,
    icon: <XCircleIcon className="size-4" />,
  }
}

function formatRenewal(
  sub: SubscriptionItem,
  t: SubscriptionMessages,
  locale: string
): string {
  if (!sub.currentPeriodEnd) return t.notAvailable
  const end = new Date(sub.currentPeriodEnd)
  const date = end.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const now = new Date()
  if (end < now) {
    return t.renewalExpired.replace("{date}", date)
  }
  return t.renewalRenews.replace("{date}", date)
}

function getTermLabel(sub: SubscriptionItem, t: SubscriptionMessages): string {
  const labels: Record<string, string> = {
    MONTHLY: t.termMonthly,
    QUARTERLY: t.termQuarterly,
    SEMI_ANNUAL: t.termSemiAnnual,
    ANNUAL: t.termAnnual,
  }
  return labels[sub.billingPeriod ?? ""] ?? sub.billingPeriod ?? t.notAvailable
}

function createSubscriptionColumns(
  t: SubscriptionMessages,
  locale: string
): ColumnDef<SubscriptionItem>[] {
  return [
    {
      accessorKey: "packageCode",
      header: t.columnProduct,
      cell: ({ row }) => (
        <Link
          href={`/${locale}/console/billing/subscriptions/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.packageCode}
        </Link>
      ),
    },
    {
      accessorKey: "planCode",
      header: t.columnPlan,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.planCode}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t.columnStatus,
      cell: ({ row }) => {
        const status = row.original.status
        const label = getStatusLabel(status, t)
        return (
          <Badge
            className={`inline-flex items-center gap-1 ${getStatusClassName(status)}`}
            aria-label={t.statusAriaLabel.replace("{status}", label)}
          >
            {getStatusIcon(status)}
            <span>{label}</span>
          </Badge>
        )
      },
    },
    {
      accessorKey: "billingPeriod",
      header: t.columnTerm,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {getTermLabel(row.original, t)}
        </span>
      ),
    },
    {
      accessorKey: "currentPeriodEnd",
      header: t.columnRenewal,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatRenewal(row.original, t, locale)}
        </span>
      ),
    },
    {
      accessorKey: "invoiceStatus",
      header: t.columnInvoice,
      cell: ({ row }) => {
        const status = row.original.invoiceStatus
        return status ? (
          <Badge className={getInvoiceStatusClassName(status)}>{status}</Badge>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )
      },
    },
    {
      id: "nextAction",
      header: t.columnNextAction,
      accessorFn: (row) => getNextAction(row, t).label,
      cell: ({ row }) => {
        const action = getNextAction(row.original, t)
        return (
          <span className="inline-flex items-center gap-1 text-sm">
            {action.icon}
            {action.label}
          </span>
        )
      },
    },
  ]
}

export function SubscriptionList({
  subscriptions,
  isLoading,
  error,
  onRetry,
}: SubscriptionListProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.billing.subscriptions
  const statusFilterOptions = STATUS_FILTER_VALUES.map((value) => ({
    value,
    label:
      value === "ALL"
        ? t.statusFilterAll
        : value === "ACTIVE"
          ? t.statusFilterActive
          : value === "SUSPENDED"
            ? t.statusFilterSuspended
            : value === "CANCELLED"
              ? t.statusFilterCancelled
              : t.statusFilterPending,
  }))
  const columns = createSubscriptionColumns(t, locale)
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
            {t.retryButton}
          </button>
        )}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium text-foreground">{t.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.emptyDescription}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          aria-label={t.searchPlaceholder}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t.statusFilterAll} />
          </SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        tableId="billing-subscriptions"
        columns={columns}
        data={filtered}
        searchableColumns={["packageCode", "planCode", "id"]}
        searchPlaceholder={t.searchPlaceholder}
        emptyMessage={t.emptyTitle}
      />

      {/* Card view for mobile */}
      <div className="space-y-3 md:hidden">
        {filtered.map((sub) => {
          const action = getNextAction(sub, t)
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
                <Badge
                  className={`inline-flex items-center gap-1 ${getStatusClassName(sub.status)}`}
                  aria-label={t.statusAriaLabel.replace(
                    "{status}",
                    getStatusLabel(sub.status, t)
                  )}
                >
                  {getStatusIcon(sub.status)}
                  <span>{getStatusLabel(sub.status, t)}</span>
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t.columnTerm}</span>
                  <span>{getTermLabel(sub, t)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t.columnRenewal}
                  </span>
                  <span>{formatRenewal(sub, t, locale)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t.columnInvoice}
                  </span>
                  <span>
                    {sub.invoiceStatus ? (
                      <Badge
                        className={getInvoiceStatusClassName(sub.invoiceStatus)}
                      >
                        {sub.invoiceStatus}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t.columnNextAction}
                  </span>
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
