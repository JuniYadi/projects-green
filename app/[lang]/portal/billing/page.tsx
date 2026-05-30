import { Suspense } from "react"

import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { BillingTabs } from "./billing-tabs"
import { Skeleton } from "@/components/ui/skeleton"

export default async function PortalBillingPage({
  params,
}: Readonly<{ params: Promise<{ lang: string }> }>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your billing, subscriptions, and invoices.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <BillingTabs lang={locale} />
      </Suspense>
    </main>
  )
}