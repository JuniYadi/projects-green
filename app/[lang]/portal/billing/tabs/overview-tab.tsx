"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PlusIcon, CalendarIcon, FileTextIcon } from "@phosphor-icons/react"
import Link from "next/link"

import { BalanceCard } from "@/components/billing/balance-card"
import { getAccount, getSubscriptions, getInvoices } from "@/lib/billing-client"
import type { BillingAccount, SubscriptionItem, InvoiceListItem } from "@/lib/billing-client"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"

type OverviewTabProps = {
  lang: string
}

export function OverviewTab({ lang }: OverviewTabProps) {
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([])
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [accountData, subscriptionsData, invoicesData] = await Promise.all([
          getAccount(),
          getSubscriptions(),
          getInvoices(),
        ])
        setAccount(accountData)
        setSubscriptions(subscriptionsData.subscriptions)
        setInvoices(invoicesData.invoices.slice(0, 3))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
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

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    )
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "N/A"
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr))
  }

  function formatCurrency(amountIdr: string): string {
    const amount = Number.parseFloat(amountIdr)
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <BalanceCard
          balanceIdr={account?.balanceIdr ?? "0"}
          formattedBalance={account?.formattedBalance ?? "IDR 0"}
          isAboveWarn={account?.isAboveWarn ?? false}
          accountAge={account?.accountAge}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <CalendarIcon className="h-4 w-4" />
              Billing Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Subscriptions</span>
              <span className="font-medium">{subscriptions.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next Billing Date</span>
              <span className="font-medium">
                {subscriptions.length > 0 && subscriptions[0].currentPeriodEnd
                  ? formatDate(subscriptions[0].currentPeriodEnd)
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Billing Period</span>
              <span className="font-medium">Monthly</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start">
              <Link href={`/${lang}/portal/billing?tab=topup`}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Top Up Balance
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href={`/${lang}/portal/billing?tab=usage`}>
                View Usage
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <FileTextIcon className="h-4 w-4" />
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(invoice.issuedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {formatCurrency(invoice.totalAmountIdr)}
                    </span>
                    <InvoiceStatusBadge
                      status={invoice.status as "PENDING" | "PAID" | "VOID"}
                    />
                  </div>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${lang}/portal/billing?tab=invoices`}>
                  View All Invoices
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}