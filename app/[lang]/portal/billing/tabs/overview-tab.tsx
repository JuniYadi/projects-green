"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarIcon, FileTextIcon, WalletIcon } from "@phosphor-icons/react"
import Link from "next/link"

import {
  getAdminInvoices,
  type AdminInvoiceListItem,
} from "@/lib/billing-client"
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge"

type OverviewTabProps = {
  lang: string
}

export function OverviewTab({ lang }: OverviewTabProps) {
  const [invoices, setInvoices] = useState<AdminInvoiceListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const invoicesData = await getAdminInvoices({ limit: 5 })
        setInvoices(invoicesData.invoices)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invoices")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <WalletIcon className="h-4 w-4" />
              Billing Administration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Review organization billing, subscriptions, usage, and payment administration from the platform surface.
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href={`/${lang}/portal/billing?tab=subscriptions`}>
                  View Subscriptions
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/${lang}/portal/billing?tab=usage`}>
                  View Usage
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <CalendarIcon className="h-4 w-4" />
              Quick Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start" size="sm">
              <Link href={`/${lang}/portal/billing?tab=subscriptions`}>
                <FileTextIcon className="mr-2 h-4 w-4" />
                View Subscriptions
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start"
              size="sm"
            >
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
            Organization Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organization invoices yet
            </p>
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
                <Link href={`/${lang}/portal/invoices`}>
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
