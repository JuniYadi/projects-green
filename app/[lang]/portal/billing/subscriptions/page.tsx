"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  getAdminSubscriptions,
  type AdminSubscriptionItem,
} from "@/lib/billing-client"
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

function paymentStatusLabel(orderStatus: string | null | undefined): string {
  switch (orderStatus) {
    case "CHARGED":
      return "Charged"
    case "PENDING":
      return "Pending"
    case "FAILED":
      return "Failed"
    case "CANCELLED":
      return "Cancelled"
    case null:
    case undefined:
      return "—"
    default:
      return orderStatus
  }
}

function PaymentStatusBadge({
  orderStatus,
}: {
  orderStatus: string | null | undefined
}) {
  if (!orderStatus) return <span className="text-muted-foreground">—</span>
  const variant =
    orderStatus === "CHARGED"
      ? "default"
      : orderStatus === "FAILED" || orderStatus === "CANCELLED"
        ? "destructive"
        : "secondary"
  return <Badge variant={variant}>{paymentStatusLabel(orderStatus)}</Badge>
}

function SubscriptionRow({ sub }: { sub: AdminSubscriptionItem }) {
  const orgHref = sub.organizationId
    ? `/portal/billing/org/${sub.organizationId}`
    : null

  return (
    <TableRow>
      <TableCell>
        {orgHref ? (
          <Link href={orgHref} className="font-mono text-xs hover:underline">
            {sub.organizationId ?? "—"}
          </Link>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {sub.organizationId ?? "—"}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="font-medium">{sub.packageCode}</div>
        <div className="text-xs text-muted-foreground">
          {sub.planCode} · {sub.regionCode}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-xs text-muted-foreground">{sub.type}</div>
        <div className="text-xs text-muted-foreground">{sub.billingMode}</div>
      </TableCell>
      <TableCell className="font-medium">
        {sub.periodPrice
          ? formatBillingMoney(sub.periodPrice, sub.currency ?? "IDR")
          : sub.monthlyRateIdr
            ? formatBillingMoney(sub.monthlyRateIdr, "IDR")
            : "—"}
        {sub.billingPeriod ? (
          <span className="ml-1 text-xs text-muted-foreground">
            /{sub.billingPeriod.toLowerCase()}
          </span>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant={serviceStatusVariant(sub.status)}>{sub.status}</Badge>
      </TableCell>
      <TableCell>
        <PaymentStatusBadge orderStatus={sub.orderStatus} />
      </TableCell>
      <TableCell>
        <PaymentStatusBadge orderStatus={sub.invoiceStatus} />
      </TableCell>
      <TableCell>
        {sub.currentPeriodEnd ? (
          <span className="text-xs">
            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
    </TableRow>
  )
}

function SubscriptionCard({ sub }: { sub: AdminSubscriptionItem }) {
  const orgHref = sub.organizationId
    ? `/portal/billing/org/${sub.organizationId}`
    : null

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        {orgHref ? (
          <Link href={orgHref} className="font-mono text-xs hover:underline">
            {sub.organizationId}
          </Link>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {sub.organizationId ?? "—"}
          </span>
        )}
        <Badge variant={serviceStatusVariant(sub.status)}>{sub.status}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{sub.packageCode}</div>
          <div className="text-xs text-muted-foreground">
            {sub.planCode} · {sub.regionCode}
          </div>
        </div>
        <div className="text-right">
          <div className="font-medium">
            {sub.periodPrice
              ? formatBillingMoney(sub.periodPrice, sub.currency ?? "IDR")
              : sub.monthlyRateIdr
                ? formatBillingMoney(sub.monthlyRateIdr, "IDR")
                : "—"}
          </div>
          {sub.billingPeriod ? (
            <div className="text-xs text-muted-foreground">
              /{sub.billingPeriod.toLowerCase()}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Payment:</span> {sub.orderStatus ?? "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Invoice:</span>{" "}
          {sub.invoiceStatus ?? "—"}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">Renews:</span>{" "}
        {sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
          : "—"}
      </div>
    </Card>
  )
}
const PAGE_SIZE = 20

export default function BillingSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Filter state
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [product, setProduct] = useState<string>("all")
  const [billingPeriod, setBillingPeriod] = useState<string>("all")

  const load = useCallback(
    async (pageNum: number) => {
      setLoading(true)
      try {
        const params: Parameters<typeof getAdminSubscriptions>[0] = {
          page: pageNum,
          limit: PAGE_SIZE,
        }
        if (status !== "all") params.status = status

        const response = await getAdminSubscriptions(params)
        setSubscriptions(response.subscriptions)
        setTotal(response.pagination.total)
        setError(null)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load subscriptions."
        )
      } finally {
        setLoading(false)
      }
    },
    [status]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(page)
  }, [load, page])

  // Client-side filter on loaded data
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return subscriptions.filter((sub) => {
      if (
        q &&
        !sub.organizationId?.toLowerCase().includes(q) &&
        !sub.packageCode.toLowerCase().includes(q) &&
        !sub.planCode.toLowerCase().includes(q)
      ) {
        return false
      }
      if (product !== "all" && sub.packageCode !== product) return false
      if (billingPeriod !== "all" && sub.billingPeriod !== billingPeriod)
        return false
      return true
    })
  }, [subscriptions, search, product, billingPeriod])

  const totalPages_ = Math.ceil(total / PAGE_SIZE)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage and monitor all service subscriptions across organizations.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>All subscriptions</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search org, product, plan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48"
              />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={billingPeriod} onValueChange={setBillingPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Product / plan</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Renews</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No subscriptions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((sub) => (
                        <SubscriptionRow key={sub.id} sub={sub} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="block space-y-3 md:hidden">
                {filtered.length === 0 ? (
                  <p className="py-10 text-center text-muted-foreground">
                    No subscriptions found.
                  </p>
                ) : (
                  filtered.map((sub) => (
                    <SubscriptionCard key={sub.id} sub={sub} />
                  ))
                )}
              </div>

              {totalPages_ > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {subscriptions.length} of {total} subscriptions
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages_}
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
                      disabled={page >= totalPages_ || loading}
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
    </main>
  )
}
