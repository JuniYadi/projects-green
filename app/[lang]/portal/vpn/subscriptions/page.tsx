import type { Metadata } from "next"

import { SubscriptionsTable } from "../_components/subscriptions-table"

export const metadata: Metadata = { title: "VPN Service Operations" }

export default async function VpnSubscriptionsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">VPN Service Operations</h1>
        <p className="text-sm text-muted-foreground">
          Manage per-protocol server accounts and provisioning for purchased VPN
          services. Payment, orders, and renewals are managed in Billing.
        </p>
      </header>
      <SubscriptionsTable />
    </main>
  )
}
