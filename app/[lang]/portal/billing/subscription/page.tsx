import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getAdminSubscriptions } from "@/lib/billing-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"


export default async function PortalBillingSubscriptionPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground">
          Platform-wide subscription management
        </p>
      </header>

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <SubscriptionsDashboard />
      </Suspense>
    </main>
  )
}

async function SubscriptionsDashboard() {
  const { subscriptions, pagination } = await getAdminSubscriptions({
    limit: 100,
  })

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pagination.total} total subscription{pagination.total !== 1 ? "s" : ""}
        </p>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No subscriptions found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Organization</th>
                    <th className="px-4 py-3 text-left font-medium">Package</th>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Region</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Billing</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Monthly Rate (IDR)</th>
                    <th className="px-4 py-3 text-left font-medium">Period End</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">{sub.organizationId ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{sub.packageCode}</Badge>
                      </td>
                      <td className="px-4 py-3">{sub.planCode}</td>
                      <td className="px-4 py-3">{sub.regionCode}</td>
                      <td className="px-4 py-3">{sub.type}</td>
                      <td className="px-4 py-3">{sub.billingMode}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            sub.status === "active"
                              ? "default"
                              : sub.status === "past_due"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(sub.monthlyRateIdr).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        {sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
