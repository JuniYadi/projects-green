import { SubscriptionsTable } from "../_components/subscriptions-table"

export default async function VpnSubscriptionsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Review customer VPN subscriptions and manage per-protocol server
          accounts.
        </p>
      </header>
      <SubscriptionsTable />
    </main>
  )
}
