"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { BalanceCard } from "@/components/billing/balance-card"
import { SubscriptionCard } from "@/components/billing/subscription-card"
import { InvoiceTable } from "@/components/billing/invoice-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccount, getSubscriptions, getInvoices } from "@/lib/billing-client"
import type { BillingAccount, BillingSubscriptions, BillingInvoices } from "@/lib/billing-client"
import { PlusIcon } from "@phosphor-icons/react"

type DashboardData = {
  account: BillingAccount | null
  subscriptions: BillingSubscriptions | null
  invoices: BillingInvoices | null
}

export function BillingDashboard() {
  const [data, setData] = useState<DashboardData>({
    account: null,
    subscriptions: null,
    invoices: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [errors, setErrors] = useState<{ account?: string; subscriptions?: string; invoices?: string }>({})

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
        subscriptions: results[1].status === "fulfilled" ? results[1].value : null,
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
        <Skeleton className="h-64" />
      </div>
    )
  }

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
              <Link href="/console/billing/transactions">Transaction History</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/console/billing/subscription">View Subscription</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-base font-medium">Need Help?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact our support team for billing inquiries.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-2">
            <Link href="/console/support-tickets/new">Create Support Ticket</Link>
          </Button>
        </div>
      </div>

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
          <div className="rounded-lg border p-6 text-center">
            <p className="text-muted-foreground">No active subscriptions</p>
          </div>
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

        {data.invoices?.invoices.length ? (
          <InvoiceTable
            invoices={data.invoices.invoices.slice(0, 5)}
            lang="en"
          />
        ) : (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-muted-foreground">No invoices yet</p>
          </div>
        )}
      </section>
    </div>
  )
}
