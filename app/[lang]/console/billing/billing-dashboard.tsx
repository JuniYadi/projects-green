"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { BalanceCard } from "@/components/billing/balance-card"
import { SubscriptionCard } from "@/components/billing/subscription-card"
import { InvoiceTable } from "@/components/billing/invoice-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccount, getSubscriptions, getInvoices } from "@/lib/billing-client"
import type {
  BillingAccount,
  BillingSubscriptions,
  BillingInvoices,
} from "@/lib/billing-client"
import {
  PlusIcon,
  CalendarIcon,
  ChartLineUp,
  WalletIcon,
  CreditCardIcon,
  BellIcon,
  GaugeIcon,
} from "@phosphor-icons/react"

type DashboardData = {
  account: BillingAccount | null
  subscriptions: BillingSubscriptions | null
  invoices: BillingInvoices | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString()}`
}

function getNextBillingDate(
  subscriptions: BillingSubscriptions | null
): string | null {
  if (!subscriptions?.subscriptions.length) return null

  const dates = subscriptions.subscriptions
    .map((s) => s.currentPeriodEnd)
    .filter((d): d is string => d !== null)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return dates.length > 0 ? dates[0] : null
}

function calculateCostProjection(
  invoices: BillingInvoices | null
): number | null {
  if (!invoices?.invoices.length) return null

  const paidInvoices = invoices.invoices.filter((inv) => inv.status === "PAID")
  if (paidInvoices.length === 0) return null

  const totalSpent = paidInvoices.reduce(
    (sum, inv) => sum + Number.parseFloat(inv.totalAmountIdr),
    0
  )
  const avgMonthly = totalSpent / paidInvoices.length

  return Math.round(avgMonthly)
}

export function BillingDashboard() {
  const [data, setData] = useState<DashboardData>({
    account: null,
    subscriptions: null,
    invoices: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [errors, setErrors] = useState<{
    account?: string
    subscriptions?: string
    invoices?: string
  }>({})

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setErrors({})

      const results = await Promise.allSettled([
        getAccount(),
        getSubscriptions(),
        getInvoices(),
      ])

      setData({
        account: results[0].status === "fulfilled" ? results[0].value : null,
        subscriptions:
          results[1].status === "fulfilled" ? results[1].value : null,
        invoices: results[2].status === "fulfilled" ? results[2].value : null,
      })

      const newErrors: typeof errors = {}
      if (results[0].status === "rejected") {
        newErrors.account = "Failed to load balance"
      }
      if (results[1].status === "rejected") {
        newErrors.subscriptions = "Failed to load subscriptions"
      }
      if (results[2].status === "rejected") {
        newErrors.invoices = "Failed to load invoices"
      }
      setErrors(newErrors)
      setIsLoading(false)
    }

    void loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const nextBillingDate = getNextBillingDate(data.subscriptions)
  const costProjection = calculateCostProjection(data.invoices)

  return (
    <div className="space-y-6">
      {/* Balance and Actions Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {data.account ? (
          <BalanceCard
            balanceIdr={data.account.balanceIdr}
            formattedBalance={data.account.formattedBalance}
            isAboveWarn={data.account.isAboveWarn}
            accountAge={data.account.accountAge}
          />
        ) : (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.account || "Failed to load balance"}
            </p>
          </div>
        )}

        <div className="rounded-lg border p-4">
          <h3 className="text-base font-medium">Quick Actions</h3>
          <div className="mt-3 flex flex-col gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/console/billing/topup">
                <PlusIcon className="mr-2 h-4 w-4" />
                Top Up Balance
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/console/billing/transactions">
                Transaction History
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/console/billing/subscription">
                View Subscription
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-base font-medium">Need Help?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact our support team for billing inquiries.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-2">
            <Link href="/console/support-tickets/new">
              Create Support Ticket
            </Link>
          </Button>
        </div>
      </div>

      {/* Billing Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Next Invoice Date
            </CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextBillingDate ? formatDate(nextBillingDate) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on active subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cost Projection
            </CardTitle>
            <ChartLineUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {costProjection !== null
                ? formatCurrency(costProjection)
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated monthly average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Subscriptions
            </CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.subscriptions?.subscriptions.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active services
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Links */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Billing Management</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/console/billing/usage" className="block">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                    <GaugeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">Usage Dashboard</h3>
                    <p className="text-sm text-muted-foreground">
                      Monitor usage and costs
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/console/billing/payment-methods" className="block">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                    <CreditCardIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">Payment Methods</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage bank accounts
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/console/billing/alerts" className="block">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
                    <BellIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">Billing Alerts</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure notifications
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Subscription Cards */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Subscriptions</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/console/billing/subscription">View All</Link>
          </Button>
        </div>

        {data.subscriptions?.subscriptions.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {data.subscriptions.subscriptions.map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No active subscriptions</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent Invoices */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/console/billing/invoices">View All</Link>
          </Button>
        </div>

        <InvoiceTable
          invoices={data.invoices?.invoices.slice(0, 5) ?? []}
          lang="en"
          emptyMessage="No invoices yet."
        />
      </section>
    </div>
  )
}
