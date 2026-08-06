"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import {
  getAdminOrders,
  billingPeriodLabel,
  type AdminOrder,
} from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

const ORDER_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "CHARGED", label: "Charged" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
]

const BILLING_PERIODS = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL", label: "Annual" },
]

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" {
  if (status === "FULFILLED" || status === "CHARGED") return "default"
  if (status === "FAILED" || status === "CANCELLED") return "destructive"
  return "secondary"
}

function exportToCsv(orders: AdminOrder[], filename: string) {
  const headers = [
    "Order ID",
    "Organization ID",
    "Package Code",
    "Plan Code",
    "Billing Period",
    "Status",
    "Currency",
    "Subtotal",
    "Total",
    "Charged At",
    "Fulfilled At",
    "Invoice Number",
    "Invoice Status",
    "Created At",
  ]
  const rows = orders.map((order) => [
    order.id,
    order.organizationId,
    order.line?.packageCode ?? "",
    order.line?.planCode ?? "",
    order.line?.billingPeriod ?? "",
    order.status,
    order.currency,
    order.subtotalAmount,
    order.totalAmount,
    order.chargedAt ?? "",
    order.fulfilledAt ?? "",
    order.invoice?.invoiceNumber ?? "",
    order.invoice?.status ?? "",
    order.createdAt,
  ])
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BillingOrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [filters, setFilters] = useState({
    status: searchParams.get("status") ?? "",
    packageCode: searchParams.get("packageCode") ?? "",
    billingPeriod: searchParams.get("billingPeriod") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: {
        page?: number
        limit?: number
        status?: string
        packageCode?: string
        billingPeriod?: string
        from?: string
        to?: string
      } = { page: pagination.page, limit: pagination.limit }
      if (filters.status) params.status = filters.status
      if (filters.packageCode) params.packageCode = filters.packageCode
      if (filters.billingPeriod) params.billingPeriod = filters.billingPeriod
      if (filters.from) params.from = filters.from
      if (filters.to) params.to = filters.to
      const response = await getAdminOrders(params)
      setOrders(response.orders)
      setPagination(response.pagination)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load orders."
      )
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      status: "",
      packageCode: "",
      billingPeriod: "",
      from: "",
      to: "",
    })
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const hasActiveFilters =
    filters.status !== "" ||
    filters.packageCode !== "" ||
    filters.billingPeriod !== "" ||
    filters.from !== "" ||
    filters.to !== ""

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
          <CardTitle />
          <div className="mb-4 flex flex-wrap gap-3">
            <Select
              value={filters.status}
              onValueChange={(v) => updateFilter("status", v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Package code"
              value={filters.packageCode}
              onChange={(e) => updateFilter("packageCode", e.target.value)}
              onInput={(e) =>
                updateFilter("packageCode", e.currentTarget.value)
              }
              className="w-[160px]"
            />
            <Select
              value={filters.billingPeriod}
              onValueChange={(v) => updateFilter("billingPeriod", v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Billing period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All periods</SelectItem>
                {BILLING_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From"
              value={filters.from}
              onChange={(e) => updateFilter("from", e.target.value)}
              onInput={(e) => updateFilter("from", e.currentTarget.value)}
              className="w-[140px]"
            />
            <Input
              type="date"
              placeholder="To"
              value={filters.to}
              onChange={(e) => updateFilter("to", e.target.value)}
              onInput={(e) => updateFilter("to", e.currentTarget.value)}
              className="w-[140px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams()
                if (filters.status) params.set("status", filters.status)
                if (filters.packageCode)
                  params.set("packageCode", filters.packageCode)
                if (filters.billingPeriod)
                  params.set("billingPeriod", filters.billingPeriod)
                if (filters.from) params.set("from", filters.from)
                if (filters.to) params.set("to", filters.to)
                const qs = params.toString()
                const url = qs
                  ? `${window.location.pathname}?${qs}`
                  : window.location.pathname
                window.history.replaceState(null, "", url)
              }}
            >
              Apply
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(orders, "orders.csv")}
              disabled={orders.length === 0}
            >
              Export CSV
            </Button>
          </div>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading orders…</p>
          ) : (
            <></>
          )}
        </CardHeader>
        <CardContent>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
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
                        {formatBillingMoney(order.totalAmount, order.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.fulfilledAt ? "Fulfilled" : "Pending"}
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {pagination.total} total orders · {pagination.page} of{" "}
                {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page - 1,
                    }))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page + 1,
                    }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
