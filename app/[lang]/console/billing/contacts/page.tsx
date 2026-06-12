import type { Metadata } from "next"

import { BillingContactsList } from "./billing-contacts-list"

export const metadata: Metadata = {
  title: "Billing Contacts | Console",
  description: "Manage billing notification recipients",
}

export default function BillingContactsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Billing Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Manage who receives billing notifications including invoices, low
          balance alerts, and support updates.
        </p>
      </header>

      <BillingContactsList />
    </main>
  )
}
