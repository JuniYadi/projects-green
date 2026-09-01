"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  getAdminOrders,
  cancelAdminOrder,
  fulfillAdminOrder,
  billingPeriodLabel,
  type AdminOrder,
} from "@/lib/billing-client"
import { formatKey } from "@/lib/format-key"
import { formatBillingMoney } from "@/modules/billing/format-money"
import {
  MoreHorizontal,
  Ban,
  PlayCircle,
  ExternalLink,
  Eye,
} from "lucide-react"
const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CHARGED", label: "Charged" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const

const BILLING_PERIODS = [
  { value: "all", label: "All periods" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL", label: "Annual" },
] as const

const PAGE_SIZE = 20

function paymentStatusVariant(
  status: string
): "default" | "secondary" | "destructive" {
  switch (status) {
    case "CHARGED":
    case "FULFILLED":
      return "default"
    case "FAILED":
    case "CANCELLED":
      return "destructive"
    default:
      return "secondary"
  }
}

function fulfillmentStatus(fulfilledAt: string | null): string {
  return fulfilledAt ? "Fulfilled" : "Pending"
}

export function BillingOrdersPage() {
  const params = useParams()
  const lang = (params?.lang as string) || "en"

  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [status, setStatus] = useState<string>("all")
  const [packageCode, setPackageCode] = useState<string>("")
  const [billingPeriod, setBillingPeriod] = useState<string>("all")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")

  const [activeOrder, setActiveOrder] = useState<AdminOrder | null>(null)
  const [confirmCancelOrder, setConfirmCancelOrder] =
    useState<AdminOrder | null>(null)
  const [confirmFulfillOrder, setConfirmFulfillOrder] =
    useState<AdminOrder | null>(null)
  const [actionReason, setActionReason] = useState<string>("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const reloadOrders = () => {
    void load(page, { status, packageCode, billingPeriod, from, to })
  }
  const load = useCallback(
    async (
      pageNum: number,
      filters: {
        status?: string
        packageCode?: string
        billingPeriod?: string
        from?: string
        to?: string
      }
    ) => {
      setLoading(true)
      try {
        const params: {
          page: number
          limit: number
          organizationId?: string
          packageCode?: string
          status?: string
          billingPeriod?: string
          from?: string
          to?: string
        } = {
          page: pageNum,
          limit: PAGE_SIZE,
        }
        if (filters.status && filters.status !== "all")
          params.status = filters.status
        if (filters.packageCode) params.packageCode = filters.packageCode
        if (filters.billingPeriod && filters.billingPeriod !== "all")
          params.billingPeriod = filters.billingPeriod
        if (filters.from) params.from = filters.from
        if (filters.to) params.to = filters.to

        const response = await getAdminOrders(params)
        setOrders(response.orders)
        setTotal(response.pagination.total)
        setTotalPages(response.pagination.totalPages)
        setError(null)
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to load orders."
        )
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void load(page, { status, packageCode, billingPeriod, from, to })
  }, [load, page, status, packageCode, billingPeriod, from, to])

  const handleFilterChange = useCallback((field: string, value: string) => {
    switch (field) {
      case "status":
        setStatus(value)
        break
      case "packageCode":
        setPackageCode(value)
        break
      case "billingPeriod":
        setBillingPeriod(value)
        break
      case "from":
        setFrom(value)
        break
      case "to":
        setTo(value)
        break
    }
    setPage(1)
  }, [])

  const handleCancelOrder = async () => {
    if (!confirmCancelOrder) return
    setActionLoading(true)
    setActionError(null)
    try {
      await cancelAdminOrder(confirmCancelOrder.id, actionReason || undefined)
      setConfirmCancelOrder(null)
      setActionReason("")
      if (activeOrder?.id === confirmCancelOrder.id) {
        setActiveOrder(null)
      }
      reloadOrders()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to cancel order."
      )
    } finally {
      setActionLoading(false)
    }
  }

  const handleFulfillOrder = async () => {
    if (!confirmFulfillOrder) return
    setActionLoading(true)
    setActionError(null)
    try {
      await fulfillAdminOrder(confirmFulfillOrder.id)
      setConfirmFulfillOrder(null)
      if (activeOrder?.id === confirmFulfillOrder.id) {
        setActiveOrder(null)
      }
      reloadOrders()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to fulfill order."
      )
    } finally {
      setActionLoading(false)
    }
  }

  const handleExportCsv = useCallback(() => {
    const headers = [
      "Order ID",
      "Organization ID",
      "Product",
      "Plan",
      "Billing Period",
      "Amount",
      "Currency",
      "Status",
      "Charge Status",
      "Fulfillment",
      "Invoice",
      "Invoice Status",
      "Created",
    ]
    const rows = orders.map((order) => [
      order.id,
      order.organizationId,
      order.line?.packageCode ?? "",
      order.line?.planCode ?? "",
      order.line?.billingPeriod ?? "",
      order.totalAmount,
      order.currency,
      order.status,
      order.status,
      order.fulfilledAt ? "Fulfilled" : "Pending",
      order.invoice?.invoiceNumber ?? "",
      order.invoice?.status ?? "",
      order.createdAt,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [orders])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">
          Trace charges, invoices, subscriptions, and fulfillment in one trail.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Commercial orders</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading orders…</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => handleFilterChange("status", v)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Product</Label>
                  <Input
                    placeholder="Package code…"
                    value={packageCode}
                    onChange={(e) =>
                      handleFilterChange("packageCode", e.target.value)
                    }
                    className="w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Billing Period</Label>
                  <Select
                    value={billingPeriod}
                    onValueChange={(v) =>
                      handleFilterChange("billingPeriod", v)
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_PERIODS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => handleFilterChange("from", e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => handleFilterChange("to", e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={handleExportCsv}>
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Product / plan</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Charge</TableHead>
                      <TableHead>Fulfillment</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setActiveOrder(order)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="font-mono text-xs font-semibold">
                              {order.id}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {order.organizationId}
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.line ? (
                              <>
                                <div className="font-medium">
                                  {order.line.packageCode}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {order.line.planCode}
                                </div>
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {order.line
                              ? billingPeriodLabel(order.line.billingPeriod)
                              : "—"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatBillingMoney(
                              order.totalAmount,
                              order.currency
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={paymentStatusVariant(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {fulfillmentStatus(order.fulfilledAt)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {order.invoice ? (
                              <Link
                                href={`/${lang}/portal/billing/invoices`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                {order.invoice.invoiceNumber}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="xs">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => setActiveOrder(order)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                {order.status === "PENDING" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        setActionError(null)
                                        setActionReason("")
                                        setConfirmCancelOrder(order)
                                      }}
                                    >
                                      <Ban className="mr-2 h-4 w-4" />
                                      Cancel Order
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {order.status === "CHARGED" &&
                                  !order.fulfilledAt && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setActionError(null)
                                          setConfirmFulfillOrder(order)
                                        }}
                                      >
                                        <PlayCircle className="mr-2 h-4 w-4" />
                                        Fulfill / Provision
                                      </DropdownMenuItem>
                                    </>
                                  )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {Math.min(orders.length, PAGE_SIZE)} of {total}{" "}
                    results
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
      {/* Order Details Sheet (Drawer) */}
      <Sheet
        open={Boolean(activeOrder)}
        onOpenChange={(open) => {
          if (!open) setActiveOrder(null)
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-left font-mono">
              Order {activeOrder?.id}
            </SheetTitle>
            <SheetDescription className="text-left">
              Organization: {activeOrder?.organizationId}
            </SheetDescription>
          </SheetHeader>
          {activeOrder && (
            <div className="mt-6 flex flex-col gap-6 text-sm">
              {/* Status Section */}
              <div className="rounded-lg border p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  Order Status
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant={paymentStatusVariant(activeOrder.status)}>
                    {activeOrder.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Fulfillment: {fulfillmentStatus(activeOrder.fulfilledAt)}
                  </span>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Created: {new Date(activeOrder.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Items & Billing Details */}
              <div className="rounded-lg border p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  Package & Pricing
                </div>
                {activeOrder.line ? (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="font-medium">
                      {activeOrder.line.packageCode} (
                      {activeOrder.line.planCode})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Period:{" "}
                      {billingPeriodLabel(activeOrder.line.billingPeriod)}
                    </div>
                    <div className="mt-2 text-base font-semibold">
                      Total:{" "}
                      {formatBillingMoney(
                        activeOrder.totalAmount,
                        activeOrder.currency
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-muted-foreground">—</div>
                )}

                {activeOrder.invoice && (
                  <div className="mt-4 border-t pt-3">
                    <div className="text-xs text-muted-foreground">
                      Linked Invoice
                    </div>
                    <Link
                      href={`/${lang}/portal/billing/invoices`}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {activeOrder.invoice.invoiceNumber} (
                      {activeOrder.invoice.status})
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Provisioning Answers & Metadata */}
              {(() => {
                const meta = (activeOrder.metadata ?? {}) as Record<
                  string,
                  unknown
                >
                const answers = (meta.provisioningAnswers ??
                  (typeof meta.device === "object" ? meta.device : null) ??
                  {}) as Record<string, unknown>
                const answerEntries = Object.entries(answers).filter(
                  ([key, val]) =>
                    key !== "_provisioningFields" &&
                    (typeof val === "string" ||
                      typeof val === "number" ||
                      typeof val === "boolean")
                )

                if (answerEntries.length === 0) return null

                return (
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      Form & Provisioning Responses
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {answerEntries.map(([key, val]) => (
                        <div
                          key={key}
                          className="flex flex-col gap-0.5 rounded bg-muted/40 p-2 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {formatKey(key)}
                          </span>
                          <span className="font-mono font-medium">
                            {typeof val === "boolean"
                              ? val
                                ? "Yes"
                                : "No"
                              : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Drawer Actions */}
              <div className="flex flex-col gap-2 pt-2">
                {activeOrder.status === "PENDING" && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setActionError(null)
                      setActionReason("")
                      setConfirmCancelOrder(activeOrder)
                    }}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Cancel Order
                  </Button>
                )}
                {activeOrder.status === "CHARGED" &&
                  !activeOrder.fulfilledAt && (
                    <Button
                      onClick={() => {
                        setActionError(null)
                        setConfirmFulfillOrder(activeOrder)
                      }}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Fulfill / Provision Order
                    </Button>
                  )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Order Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmCancelOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmCancelOrder(null)
            setActionError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel Order{" "}
              <span className="font-mono font-medium text-foreground">
                {confirmCancelOrder?.id}
              </span>
              ? Any unpaid invoice associated with this order will be voided.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="cancel-reason" className="text-xs">
              Cancellation Reason (optional)
            </Label>
            <Input
              id="cancel-reason"
              placeholder="Reason for cancellation"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="mt-1.5"
            />
            {actionError && (
              <p className="mt-2 text-xs text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmCancelOrder(null)}
              disabled={actionLoading}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={actionLoading}
            >
              {actionLoading ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill Order Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmFulfillOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmFulfillOrder(null)
            setActionError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fulfill Order</DialogTitle>
            <DialogDescription>
              Manually trigger provisioning for Order{" "}
              <span className="font-mono font-medium text-foreground">
                {confirmFulfillOrder?.id}
              </span>
              . This will create or renew the associated subscription and
              trigger deployment.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p className="text-xs text-destructive">{actionError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmFulfillOrder(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleFulfillOrder} disabled={actionLoading}>
              {actionLoading ? "Provisioning..." : "Confirm Fulfill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default BillingOrdersPage
