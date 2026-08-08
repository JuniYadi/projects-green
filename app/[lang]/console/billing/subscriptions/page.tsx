"use client"

import { useParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useSubscriptionsQuery } from "@/hooks/use-billing-data"
import { SubscriptionList } from "@/components/billing/subscription-list"

export default function SubscriptionsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.billing.subscriptions
  const { data, isLoading, error, refetch } = useSubscriptionsQuery()

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.emptyDescription}</p>
      </header>

      <SubscriptionList
        subscriptions={data?.subscriptions ?? []}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => void refetch()}
      />
    </main>
  )
}
