import type { Metadata } from "next"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { PlatformStatsCards } from "./overview/platform-stats-cards"
import { OrgSummaryTable } from "./overview/org-summary-table"
import { PlatformUsageTrend } from "./overview/platform-usage-trend"
import { AllOrgsInvoicesFeed } from "./overview/all-orgs-invoices-feed"

export const metadata: Metadata = { title: "Billing Overview" }

export default async function PortalBillingPage({
  params,
}: {
  params?: Promise<{ lang?: string }>
} = {}) {
  const resolvedParams = params ? await params : undefined
  const locale = resolveLocaleOrDefault(resolvedParams?.lang)
  const messages = getMessages(locale).pPortalPages.billingOverview

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">{messages.title}</h1>
        <p className="text-muted-foreground">
          {messages.description}
        </p>
      </header>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        <PlatformStatsCards />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <OrgSummaryTable />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <PlatformUsageTrend />
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <AllOrgsInvoicesFeed />
      </Suspense>
    </main>
  )
}
