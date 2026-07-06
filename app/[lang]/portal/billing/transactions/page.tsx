import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminAdjustments, type AdminAdjustment } from "@/lib/billing-client"

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatCurrency(amount: string): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`
}

async function TransactionsList() {
  const { adjustments } = await getAdminAdjustments({ limit: 50 })

  if (adjustments.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          No transactions found.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">All Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {adjustments.map((adj: AdminAdjustment) => (
            <div
              key={adj.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {adj.reason ?? "Transaction"}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      adj.type === "CREDIT"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {adj.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(adj.createdAt)}
                  </span>
                </div>
              </div>
              <span
                className={`text-sm font-semibold ${
                  adj.type === "CREDIT" ? "text-green-600" : "text-red-600"
                }`}
              >
                {adj.type === "CREDIT" ? "+" : "-"}
                {formatCurrency(adj.amountIdr)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function PortalBillingTransactionsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">All Transactions</h1>
        <p className="text-muted-foreground">
          Platform-wide transaction history
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <TransactionsList />
      </Suspense>
    </main>
  )
}
