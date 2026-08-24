import type { Metadata } from "next"

import { ManagedStocksList } from "@/components/deploy/managed-stocks-list"

export const metadata: Metadata = {
  title: "Managed DB Stocks | App Hosting Admin",
}

export default function ManagedStocksPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Managed Database Stock Pool</h1>
        <p className="text-sm text-muted-foreground">
          Import and manage pre-provisioned database slots for 1-click app
          deployments.
        </p>
      </header>
      <ManagedStocksList />
    </main>
  )
}
