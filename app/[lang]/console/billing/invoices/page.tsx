"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { InvoiceTable } from "@/components/billing/invoice-table"
import { getInvoices } from "@/lib/billing-client"
import type { BillingInvoices } from "@/lib/billing-client"

export default function InvoicesPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [data, setData] = useState<BillingInvoices | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getInvoices()
        setData(result)
      } catch {
        setError(messages.console.billing.failedToLoadInvoices)
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [])

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {messages.console.billing.invoicesHeading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.console.billing.invoicesDescription}
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {messages.console.billing.billingHistory}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceTable invoices={data?.invoices ?? []} lang="en" />
        </CardContent>
      </Card>
    </main>
  )
}
