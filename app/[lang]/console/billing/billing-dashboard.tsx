"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { SubscriptionCard } from "@/components/billing/subscription-card"
import { InvoiceTable } from "@/components/billing/invoice-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  WalletIcon,
  Calendar,
  ChartLineUp,
  WarningIcon,
  PlusIcon,
} from "@/components/ui/phosphor-icons"
import { getAccount, getSubscriptions, getInvoices } from "@/lib/billing-client"
import type {
  BillingAccount,
  BillingSubscriptions,
  BillingInvoices,
} from "@/lib/billing-client"

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
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
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
    (sum, inv) => sum + Number(inv.totalAmountIdr),
    0
  )
  const avgMonthly = totalSpent / paidInvoices.length

  return Math.round(avgMonthly)
}

const secondaryLinks = [
  { href: "/console/billing/usage", label: "Usage" },
  { href: "/console/billing/alerts", label: "Alerts" },
  { href: "/console/billing/transactions", label: "Transactions" },
  { href: "/console/billing/subscription", label: "Subscriptions" },
]

export function BillingDashboard() {
  const [data, setData] = useState<DashboardData>({
    account: null,
    subscriptions: null,
    invoices: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [accountError, setAccountError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setAccountError(null)

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

      if (results[0].status === "rejected") {
        setAccountError("Failed to load balance")
      }
      setIsLoading(false)
    }

    void loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const account = data.account
  const subscriptions = data.subscriptions?.subscriptions ?? []
  const nextBillingDate = getNextBillingDate(data.subscriptions)
  const costProjection = calculateCostProjection(data.invoices)
  const lowBalance = account ? !account.isAboveWarn : false

  return (
    <div className="flex flex-col gap-6">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1">
          {secondaryLinks.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>
        <Button asChild size="sm">
          <Link href="/console/billing/topup">
            <PlusIcon />
            Top Up Balance
          </Link>
        </Button>
      </div>

      {/* Summary stat cards */}
      {account ? (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <WalletIcon className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{account.formattedBalance}</p>
              <p className="text-xs text-muted-foreground">
                Account age: {account.accountAge}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Next Invoice
              </CardTitle>
              <Calendar className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatDate(nextBillingDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                Based on active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Est. Monthly
              </CardTitle>
              <ChartLineUp className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {costProjection !== null
                  ? formatCurrency(costProjection)
                  : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                Estimated monthly average
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="ring-destructive/20">
          <CardContent>
            <p className="text-sm text-destructive">
              {accountError || "Failed to load balance"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Low balance warning */}
      {lowBalance && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Your balance is running low. Top up to avoid service interruption.
          </p>
        </div>
      )}

      {/* Active Subscriptions */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Active Subscriptions
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/console/billing/subscription">View all</Link>
          </Button>
        </div>

        {subscriptions.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {subscriptions.map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No active subscriptions
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent Invoices */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Recent Invoices
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/console/billing/invoices">View all</Link>
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
