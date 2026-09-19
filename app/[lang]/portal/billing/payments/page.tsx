import type { Metadata } from "next"
import { Suspense } from "react"

import { PaymentTabs } from "./payment-tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export const metadata: Metadata = { title: "Payments" }

export default async function BillingPaymentsPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ tab?: string }>
  params?: Promise<{ lang?: string }>
}) {
  const { tab } = await searchParams
  const resolvedParams = params ? await params : undefined
  const locale = resolveLocaleOrDefault(resolvedParams?.lang)
  const messages = getMessages(locale).pPortalPages.billingPayments

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">{messages.title}</h1>
        <p className="text-muted-foreground">
          {messages.description}
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PaymentTabs defaultTab={tab} />
      </Suspense>
    </main>
  )
}
