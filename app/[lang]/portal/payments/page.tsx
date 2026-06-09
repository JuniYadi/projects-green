import { Suspense } from "react"

import { PaymentTabs } from "./payment-tabs"
import { Skeleton } from "@/components/ui/skeleton"

export default async function PaymentsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    tab?: string
  }>
}>) {
  const { tab } = await searchParams
  const defaultTab = tab || "overview"

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Manage payment gateways, bank accounts, and payment confirmations.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PaymentTabs defaultTab={defaultTab} />
      </Suspense>
    </main>
  )
}
