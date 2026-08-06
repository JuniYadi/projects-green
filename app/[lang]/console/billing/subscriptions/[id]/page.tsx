"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getSubscriptions, getInvoice } from "@/lib/billing-client"
import type { BillingSubscriptions, InvoiceDetail } from "@/lib/billing-client"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr))
}

function formatCurrency(amount: string, currency = "IDR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number.parseFloat(amount))
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    CANCELLED: "Cancelled",
    PENDING: "Pending",
  }
  return map[status.toUpperCase()] ?? status
}

function getStatusVariant(status: string): string {
  const styles: Record<string, string> = {
    ACTIVE:
      "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
    SUSPENDED:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    CANCELLED:
      "border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-400",
    PENDING:
      "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  }
  return styles[status.toUpperCase()] ?? styles.CANCELLED
}

function getTermLabel(billingPeriod: string | null | undefined): string {
  if (billingPeriod === "MONTHLY") return "Monthly"
  if (billingPeriod === "QUARTERLY") return "Quarterly"
  if (billingPeriod === "SEMI_ANNUAL") return "Semi-annual"
  if (billingPeriod === "ANNUAL") return "Annual"
  return billingPeriod ?? "N/A"
}

function getNextAction(sub: BillingSubscriptions["subscriptions"][0]): string {
  const status = sub.status.toUpperCase()
  if (status === "ACTIVE" && sub.invoiceStatus === "OVERDUE") {
    return "Update payment"
  }
  if (status === "ACTIVE" && sub.currentPeriodEnd) {
    const now = new Date()
    const end = new Date(sub.currentPeriodEnd)
    const daysUntil = Math.ceil(
      (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntil <= 7 && daysUntil >= 0) {
      return "Renew now"
    }
  }
  if (status === "ACTIVE") return "No action needed"
  if (status === "SUSPENDED") return "Contact support"
  if (status === "CANCELLED") return "No action needed"
  return "No action needed"
}

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string; lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const subscriptionId = params.id as string

  const [subscriptions, setSubscriptions] =
    useState<BillingSubscriptions | null>(null)
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [subsResult, invResult] = await Promise.all([
          getSubscriptions(),
          getInvoice(subscriptionId),
        ])
        if (!cancelled) {
          setSubscriptions(subsResult)
          setInvoice(invResult)
        }
      } catch {
        if (!cancelled) {
          setError(messages.console.billing.subscriptions.errorDescription)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [subscriptionId, messages.console.billing.subscriptions.errorDescription])

  const sub = subscriptions?.subscriptions.find((s) => s.id === subscriptionId)

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </main>
    )
  }

  if (!sub) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {messages.console.billing.invoiceNotFound}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The subscription you are looking for does not exist.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const nextAction = getNextAction(sub)
  const invoiceData = invoice?.invoice
  const d = messages.console.billing.subscriptions.detail

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/console/billing/subscriptions">
              <ArrowLeftIcon className="mr-2 size-4" />
              {d.backTo}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{d.heading}</h1>
          <p className="text-sm text-muted-foreground">{sub.packageCode}</p>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList aria-label={d.heading}>
          <TabsTrigger value="overview">{d.tabs.overview}</TabsTrigger>
          <TabsTrigger value="billing">{d.tabs.billing}</TabsTrigger>
          <TabsTrigger value="addons">{d.tabs.addons}</TabsTrigger>
          <TabsTrigger value="activity">{d.tabs.activity}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {sub.packageCode}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.status}
                  </p>
                  <Badge className={getStatusVariant(sub.status)}>
                    {getStatusLabel(sub.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.serviceStatus}
                  </p>
                  <Badge className={getStatusVariant(sub.status)}>
                    {getStatusLabel(sub.status)}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.product}
                  </p>
                  <p className="font-medium">{sub.packageCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.plan}
                  </p>
                  <p className="font-medium">{sub.planCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.term}
                  </p>
                  <p className="font-medium">
                    {getTermLabel(sub.billingPeriod)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.renewal}
                  </p>
                  <p className="font-medium">
                    {formatDate(sub.currentPeriodEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.invoiceState}
                  </p>
                  <p className="font-medium">{sub.invoiceStatus ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.overview.nextAction}
                  </p>
                  <p className="font-medium">{nextAction}</p>
                </div>
              </div>
              {sub.periodPrice && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {d.billing.amount}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(sub.periodPrice, sub.currency ?? "IDR")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {invoiceData?.invoiceNumber ?? d.billing.invoiceNumber}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoiceData ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {d.billing.status}
                      </p>
                      <Badge className={getStatusVariant(invoiceData.status)}>
                        {getStatusLabel(invoiceData.status)}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {d.billing.period}
                      </p>
                      <p className="font-medium">
                        {formatDate(invoiceData.periodStart)} –{" "}
                        {formatDate(invoiceData.periodEnd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {d.billing.amount}
                      </p>
                      <p className="font-medium">
                        {formatCurrency(
                          invoiceData.totalAmountIdr,
                          invoiceData.currency
                        )}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {d.addons.message}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {d.addons.unavailable}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {d.addons.message}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {d.activity.noActivity}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
