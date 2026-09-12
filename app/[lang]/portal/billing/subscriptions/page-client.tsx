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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import { useAdminSubscriptionsQuery } from "@/hooks/use-billing-data"
import { formatKey } from "@/lib/format-key"
import {
  type AdminSubscriptionItem,
  updateAdminSubscription,
  renewAdminSubscription,
} from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

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
  const [selectedSubscription, setSelectedSubscription] =
    useState<AdminSubscriptionItem | null>(null)
  const [selectedConfigSub, setSelectedConfigSub] =
    useState<AdminSubscriptionItem | null>(null)
  const [editingSub, setEditingSub] = useState<AdminSubscriptionItem | null>(
    null
  )
  const [renewingSubId, setRenewingSubId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editForm, setEditForm] = useState<{
    billingPeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"
    currentPeriodEnd: string
    status: "ACTIVE" | "SUSPENDED" | "CANCELLED"
  }>({
    billingPeriod: "MONTHLY",
    currentPeriodEnd: "",
    status: "ACTIVE",
  })
  const [page, setPage] = useState(1)
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

    const timer = window.setTimeout(() => {
      setSelectedSubscription((current) =>
        current?.id === linkedSubscription.id ? current : linkedSubscription
      )
    }, 0)
    return () => window.clearTimeout(timer)
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
      {
        id: "provisioningConfig",
        header: "Provisioning",
        cell: ({ row }) => {
          const sub = row.original
          const config = (sub.allocatedConfig ?? {}) as Record<string, unknown>
          const hasEntries =
            Object.keys(config).filter(
              (k) =>
                k !== "_provisioningFields" &&
                config[k] !== null &&
                config[k] !== undefined &&
                typeof config[k] !== "object"
            ).length > 0

          if (!hasEntries) {
            return <span className="text-xs text-muted-foreground">—</span>
          }

          return (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSelectedConfigSub(sub)}
            >
              View Config
            </Button>
          )
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const sub = row.original
          return (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setEditingSub(sub)
                  setEditForm({
                    billingPeriod:
                      (sub.billingPeriod as
                        "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL") ||
                      "MONTHLY",
                    currentPeriodEnd: sub.currentPeriodEnd
                      ? new Date(sub.currentPeriodEnd)
                          .toISOString()
                          .slice(0, 16)
                      : "",
                    status:
                      (sub.status as "ACTIVE" | "SUSPENDED" | "CANCELLED") ||
                      "ACTIVE",
                  })
                }}
              >
                Edit Renewal
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={renewingSubId === sub.id}
                onClick={async () => {
                  try {
                    setRenewingSubId(sub.id)
                    await renewAdminSubscription(sub.id)
                    toast.success("Subscription renewal processed successfully")
                    void subscriptionsQuery.refetch()
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to renew subscription"
                    )
                  } finally {
                    setRenewingSubId(null)
                  }
                }}
              >
                {renewingSubId === sub.id ? "Renewing..." : "Renew Now"}
              </Button>
            </div>
          )
        },
      },
    ],
    [renewingSubId, subscriptionsQuery]
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingSub(selectedSubscription)
                  setEditForm({
                    billingPeriod:
                      (selectedSubscription.billingPeriod as
                        "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL") ||
                      "MONTHLY",
                    currentPeriodEnd: selectedSubscription.currentPeriodEnd
                      ? new Date(selectedSubscription.currentPeriodEnd)
                          .toISOString()
                          .slice(0, 16)
                      : "",
                    status:
                      (selectedSubscription.status as
                        "ACTIVE" | "SUSPENDED" | "CANCELLED") || "ACTIVE",
                  })
                }}
              >
                Edit Renewal
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSubscription(null)}
              >
                Close
              </Button>
            </div>
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

      {/* Modal Dialog for Subscription Provisioning Config */}
      <Dialog
        open={Boolean(selectedConfigSub)}
        onOpenChange={(open) => {
          if (!open) setSelectedConfigSub(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subscription Provisioning Parameters</DialogTitle>
            <DialogDescription>
              Configuration details and responses for Subscription{" "}
              <span className="font-mono font-medium text-foreground">
                {selectedConfigSub?.id}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(() => {
              if (!selectedConfigSub) return null
              const config = (selectedConfigSub.allocatedConfig ??
                {}) as Record<string, unknown>
              const entries = Object.entries(config).filter(
                ([key, val]) =>
                  key !== "_provisioningFields" &&
                  val !== null &&
                  val !== undefined &&
                  typeof val !== "object"
              )

              if (entries.length === 0) {
                return (
                  <p className="text-center text-xs text-muted-foreground">
                    No custom provisioning parameters recorded.
                  </p>
                )
              }

              return (
                <div className="grid gap-2.5">
                  {entries.map(([key, val]) => (
                    <div
                      key={key}
                      className="flex flex-col justify-between rounded-md border bg-muted/20 p-2.5 text-xs"
                    >
                      <span className="font-medium text-muted-foreground">
                        {formatKey(key)}
                      </span>
                      <span className="mt-1 font-mono font-semibold text-foreground">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog for Editing Subscription Renewal */}
      <Dialog
        open={Boolean(editingSub)}
        onOpenChange={(open) => {
          if (!open) setEditingSub(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription & Renewal</DialogTitle>
            <DialogDescription>
              Update billing period, status, or adjust the next renewal date for{" "}
              <span className="font-mono font-medium text-foreground">
                {editingSub?.id}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Service Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(val: "ACTIVE" | "SUSPENDED" | "CANCELLED") =>
                  setEditForm((prev) => ({ ...prev, status: val }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-period">Billing Period</Label>
              <Select
                value={editForm.billingPeriod}
                onValueChange={(
                  val: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"
                ) => setEditForm((prev) => ({ ...prev, billingPeriod: val }))}
              >
                <SelectTrigger id="edit-period">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="SEMI_ANNUAL">Semi-Annual</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-period-end">
                Renewal Expiry (Current Period End)
              </Label>
              <Input
                id="edit-period-end"
                type="datetime-local"
                value={editForm.currentPeriodEnd}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    currentPeriodEnd: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Updating this date automatically synchronizes the expiry on
                connected WhatsApp devices.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setEditingSub(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={async () => {
                if (!editingSub) return
                try {
                  setIsSubmitting(true)
                  await updateAdminSubscription(editingSub.id, {
                    status: editForm.status,
                    billingPeriod: editForm.billingPeriod,
                    currentPeriodEnd: editForm.currentPeriodEnd
                      ? new Date(editForm.currentPeriodEnd).toISOString()
                      : undefined,
                  })
                  toast.success("Subscription updated successfully")
                  setEditingSub(null)
                  void subscriptionsQuery.refetch()
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Failed to update subscription"
                  )
                } finally {
                  setIsSubmitting(false)
                }
              }}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default BillingSubscriptionsPage
