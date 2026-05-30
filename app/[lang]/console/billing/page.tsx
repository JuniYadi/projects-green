import type { Metadata } from "next"

import { BillingDashboard } from "@/app/[lang]/console/billing/billing-dashboard"

type BillingPageProps = {
  params: Promise<{
    lang: string
  }>
}

export const metadata: Metadata = {
  title: "Billing | Console",
  description: "Manage your billing, subscriptions, and invoices",
}

export default async function BillingPage({ params }: BillingPageProps) {
  await params // Ensure params are awaited

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your balance, subscriptions, and view invoice history.
        </p>
      </header>

      <BillingDashboard />
    </main>
  )
}
