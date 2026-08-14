"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import { useAdminSubscriptionsQuery } from "@/hooks/use-billing-data"
import type { AdminSubscriptionItem } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CANCELLED", label: "Cancelled" },
] as const

const BILLING_PERIOD_OPTIONS = [
  { value: "all", label: "All periods" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL", label: "Annual" },
] as const

const PRODUCT_OPTIONS = [
  { value: "all", label: "All products" },
  { value: "APP_HOSTING", label: "App Hosting" },
  { value: "VPN", label: "VPN" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const

function serviceStatusVariant(
  status: string
): "default" | "secondary" | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "default"
    case "SUSPENDED":
      return "secondary"
    case "CANCELLED":
      return "destructive"
    default:
      return "secondary"
  }
}

function paymentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "CHARGED":
      return "Charged"
    case "PENDING":
      return "Pending"
    case "FAILED":
      return "Failed"
    case "CANCELLED":
      return "Cancelled"
    case "FULFILLED":
      return "Fulfilled"
    case null:
    case undefined:
      return "—"
    default:
      return status
  }
}

function PaymentStatusBadge({
  orderStatus,
}: {
  orderStatus: string | null | undefined
}) {
  if (!orderStatus) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const variant =
    orderStatus === "CHARGED"
      ? "default"
      : orderStatus === "FAILED" || orderStatus === "CANCELLED"
        ? "destructive"
        : "secondary"
  return <Badge variant={variant}>{paymentStatusLabel(orderStatus)}</Badge>
}

const PAGE_SIZE = 20
const EMPTY_SUBSCRIPTIONS: AdminSubscriptionItem[] = []

export function BillingSubscriptionsPage() {
  const searchParams = useSearchParams()
  const linkedSubscriptionId = searchParams.get("subscriptionId")
  const [page, setPage] = useState(1)
  const [selectedSubscription, setSelectedSubscription] =
    useState<AdminSubscriptionItem | null>(null)
  const subscriptionsQuery = useAdminSubscriptionsQuery({
    page,
    limit: PAGE_SIZE,
  })
  const subscriptions =
    subscriptionsQuery.data?.subscriptions ?? EMPTY_SUBSCRIPTIONS
  const total = subscriptionsQuery.data?.pagination.total ?? 0
  const totalPages = subscriptionsQuery.data?.pagination.totalPages ?? 0
  const loading = subscriptionsQuery.isLoading
  const error =
    subscriptionsQuery.error instanceof Error
      ? subscriptionsQuery.error.message
      : subscriptionsQuery.error
        ? "Unable to load subscriptions."
        : null

  useEffect(() => {
    if (!linkedSubscriptionId) return

    const linkedSubscription = subscriptions.find(
      (subscription) => subscription.id === linkedSubscriptionId
    )
    if (!linkedSubscription) return

    // Open the record targeted by a VPN operations handoff.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSubscription((current) =>
      current?.id === linkedSubscription.id ? current : linkedSubscription
    )
  }, [linkedSubscriptionId, subscriptions])

  const columns = useMemo<ColumnDef<AdminSubscriptionItem>[]>(
    () => [
      {
        accessorKey: "organizationId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Organization" />
        ),
        cell: ({ row }) =>
          row.original.organizationId ? (
            <Link
              className="font-medium hover:underline"
              href={`/portal/admin/organizations/${row.original.organizationId}`}
            >
              {row.original.organizationId}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "packageCode",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product / plan" />
        ),
        cell: ({ row }) => (
          <Button
            className="h-auto justify-start p-0 font-medium"
            variant="link"
            onClick={() => setSelectedSubscription(row.original)}
          >
            <span>{row.original.packageCode}</span>
            <span> / {row.original.planCode}</span>
          </Button>
        ),
      },
      {
        accessorKey: "billingPeriod",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Billing period" />
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
      },
      {
        accessorKey: "periodPrice",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Price" />
        ),
        cell: ({ row }) =>
          formatBillingMoney(
            row.original.periodPrice ?? row.original.monthlyRateIdr ?? "0",
            row.original.currency ?? "IDR"
          ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Service" />
        ),
        cell: ({ row }) => (
          <Badge variant={serviceStatusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "orderStatus",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment" />
        ),
        cell: ({ row }) => (
          <PaymentStatusBadge orderStatus={row.original.orderStatus} />
        ),
      },
      {
        accessorKey: "invoiceStatus",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice" />
        ),
        cell: ({ row }) =>
          row.original.invoiceStatus ? (
            <Badge variant="secondary">{row.original.invoiceStatus}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "vpnOperation",
        header: "VPN operation",
        cell: ({ row }) => {
          const subscription = row.original
          if (subscription.packageCode !== "VPN") {
            return <span className="text-xs text-muted-foreground">—</span>
          }
          if (!subscription.vpnSubscriptionId) {
            return (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )
          }
          return (
            <Link
              href={`/portal/vpn/subscriptions/${encodeURIComponent(subscription.vpnSubscriptionId)}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open VPN operations
            </Link>
          )
        },
      },
      {
        accessorKey: "currentPeriodEnd",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Renews" />
        ),
        sortingFn: "datetime",
        cell: ({ row }) =>
          row.original.currentPeriodEnd
            ? new Date(row.original.currentPeriodEnd).toLocaleDateString()
            : "—",
      },
    ],
    []
  )

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Commercial subscriptions</h1>
        <p className="text-muted-foreground">
          Manage payment, order, invoice, and renewal context across products.
          VPN account provisioning lives in VPN Service Operations.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>All commercial subscriptions</CardTitle>
          <CardDescription>
            Product rows link to operational workspaces only when the explicit
            relation exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <DataTable
                tableId="portal-billing-subscriptions"
                columns={columns}
                data={subscriptions}
                searchPlaceholder="Search org, product, plan…"
                searchableColumns={[
                  "organizationId",
                  "packageCode",
                  "planCode",
                  "type",
                  "status",
                  "orderStatus",
                  "invoiceStatus",
                ]}
                facetFilters={[
                  {
                    columnId: "status",
                    label: "Status",
                    allLabel: "All statuses",
                    options: STATUS_OPTIONS.filter(
                      (option) => option.value !== "all"
                    ),
                  },
                  {
                    columnId: "type",
                    label: "Product",
                    allLabel: "All products",
                    options: PRODUCT_OPTIONS.filter(
                      (option) => option.value !== "all"
                    ),
                  },
                  {
                    columnId: "billingPeriod",
                    label: "Billing period",
                    allLabel: "All periods",
                    options: BILLING_PERIOD_OPTIONS.filter(
                      (option) => option.value !== "all"
                    ),
                  },
                ]}
                defaultColumnVisibility={{ billingPeriod: false }}
                emptyMessage="No subscriptions found."
              />

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {subscriptions.length} of {total} subscriptions
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
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
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {selectedSubscription && (
        <Card
          className="border-primary/30"
          role="dialog"
          aria-label="Subscription detail drawer"
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Subscription details</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedSubscription.id}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSubscription(null)}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="font-medium">
                {selectedSubscription.organizationId ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Service status</p>
              <Badge
                variant={serviceStatusVariant(selectedSubscription.status)}
              >
                {selectedSubscription.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment</p>
              <p className="font-medium">
                {paymentStatusLabel(selectedSubscription.orderStatus)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Renewal</p>
              <p className="font-medium">
                {selectedSubscription.currentPeriodEnd
                  ? new Date(
                      selectedSubscription.currentPeriodEnd
                    ).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Locked price</p>
              <p className="font-medium">
                {selectedSubscription.periodPrice
                  ? formatBillingMoney(
                      selectedSubscription.periodPrice,
                      selectedSubscription.currency ?? "IDR"
                    )
                  : "—"}
              </p>
            </div>
            {selectedSubscription.cancelAtPeriodEnd && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Next transition</p>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">
                  Cancellation scheduled for the current period end.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}

export default BillingSubscriptionsPage
