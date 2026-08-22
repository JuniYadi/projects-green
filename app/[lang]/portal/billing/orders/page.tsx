"use client"

import { useCallback, useEffect, useState } from "react"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  getAdminOrders,
  billingPeriodLabel,
  type AdminOrder,
} from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

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
  const [selectedOrderResponses, setSelectedOrderResponses] =
    useState<AdminOrder | null>(null)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="font-mono text-xs">{order.id}</div>
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
                          <TableCell>
                            {order.invoice ? (
                              <span className="text-xs">
                                {order.invoice.invoiceNumber}
                                <br />
                                {order.invoice.status}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const meta = (order.metadata ?? {}) as Record<
                                string,
                                unknown
                              >
                              const answers = (meta.provisioningAnswers ??
                                (typeof meta.device === "object"
                                  ? meta.device
                                  : null) ??
                                {}) as Record<string, unknown>
                              const hasAnswers = Object.keys(answers).length > 0

                              if (!hasAnswers) return "—"
                              return (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() =>
                                    setSelectedOrderResponses(order)
                                  }
                                >
                                  View Responses
                                </Button>
                              )
                            })()}
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
      {/* Modal Dialog to View Order Form Responses */}
      <Dialog
        open={Boolean(selectedOrderResponses)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderResponses(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order Form Responses</DialogTitle>
            <DialogDescription>
              Submitted configuration and provisioning parameters for Order{" "}
              <span className="font-mono font-medium text-foreground">
                {selectedOrderResponses?.id}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(() => {
              if (!selectedOrderResponses) return null
              const meta = (selectedOrderResponses.metadata ?? {}) as Record<
                string,
                unknown
              >
              const answers = (meta.provisioningAnswers ??
                (typeof meta.device === "object" ? meta.device : null) ??
                {}) as Record<string, unknown>

              const entries = Object.entries(answers).filter(
                ([key, val]) =>
                  key !== "_provisioningFields" &&
                  val !== null &&
                  val !== undefined &&
                  typeof val !== "object"
              )

              if (entries.length === 0) {
                return (
                  <p className="text-center text-xs text-muted-foreground">
                    No custom form field responses recorded.
                  </p>
                )
              }

              const formatKey = (key: string) =>
                key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/_/g, " ")
                  .replace(/^\w/, (c) => c.toUpperCase())

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
    </main>
  )
}

export default BillingOrdersPage
