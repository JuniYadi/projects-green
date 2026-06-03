import type { Metadata } from "next"

import { BillingAlertsForm } from "./billing-alerts-form"

export const metadata: Metadata = {
  title: "Billing Alerts | Console",
  description: "Configure billing alert preferences",
}

export default function BillingAlertsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Billing Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Configure alerts for balance, usage, and invoice notifications.
        </p>
      </header>

      <BillingAlertsForm />
    </main>
  )
}
