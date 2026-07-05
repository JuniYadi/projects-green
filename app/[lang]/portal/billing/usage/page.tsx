import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminUsage } from "@/lib/billing-client"

type PageProps = {
  params: Promise<{ lang: string }>
}

export default async function UsagePage({ params }: PageProps) {
  const { lang } = await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <Suspense fallback={<UsagePageSkeleton />}>
        <UsageContent />
      </Suspense>
    </main>
  )
}

async function UsageContent() {
  const usageResponse = await getAdminUsage({ days: 30 })
  const { breakdown, trend } = usageResponse.data

  const totalCost = breakdown.reduce((sum, item) => sum + item.totalCost, 0)
  const totalEvents = breakdown.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usage Overview</h1>
        <p className="text-muted-foreground">Platform-wide usage and consumption</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Total Cost Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Usage Cost (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {totalCost.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>

        {/* Total Events Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalEvents.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdown.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No usage data available.
            </p>
          ) : (
            <div className="space-y-3">
              {breakdown.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{item.category}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity.toLocaleString("id-ID")} events
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      Rp {item.totalCost.toLocaleString("id-ID")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Trend (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No trend data available.
            </p>
          ) : (
            <div className="space-y-3">
              {trend.map((item) => (
                <div key={item.date} className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {new Date(item.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div className="font-medium">
                    Rp {item.amount.toLocaleString("id-ID")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function UsagePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  )
}
