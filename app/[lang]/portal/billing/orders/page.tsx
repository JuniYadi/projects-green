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
import {
  getAdminOrders,
  billingPeriodLabel,
  type AdminOrder,
} from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

export default function BillingOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAdminOrders({ page: 1, limit: 50 })
      setOrders(response.orders)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load orders."
      )
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
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
                          {formatBillingMoney(
                            order.totalAmount,
                            order.currency
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === "CHARGED" ||
                              order.status === "FULFILLED"
                                ? "default"
                                : "secondary"
                            }
                          >
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
          )}
        </CardContent>
      </Card>
    </main>
  )
}
