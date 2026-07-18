import { Suspense } from "react"

import { PaymentTabs } from "./payment-tabs"
import { Skeleton } from "@/components/ui/skeleton"

export default async function BillingPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          Manage payment gateways, bank accounts, and payment confirmations.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PaymentTabs defaultTab={tab} />
      </Suspense>
    </main>
  )
}
