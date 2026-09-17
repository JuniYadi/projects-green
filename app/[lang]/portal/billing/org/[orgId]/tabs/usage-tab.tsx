"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import { CurrencyDollarIcon, LightningIcon } from "@phosphor-icons/react"
import { getAdminUsage } from "@/lib/billing-client"
import type { ChartConfig } from "@/components/ui/chart"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type UsageTabProps = {
  orgId: string
}

export function UsageTab({ orgId }: UsageTabProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingOrgTabsUsageTab

  const [breakdown, setBreakdown] = useState<
    {
      category: string
      quantity: number
      totalCost: number
      percentage: number
    }[]
  >([])
  const [trend, setTrend] = useState<{ date: string; amount: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const chartConfig = {
    cost: {
      label: t.cost,
      color: "var(--primary)",
    },
  } satisfies ChartConfig

  useEffect(() => {
    let cancelled = false
    getAdminUsage({ orgId, days: 30 })
      .then((res) => {
        if (cancelled) return
        setBreakdown(res.data.breakdown)
        setTrend(res.data.trend)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          {t.loadUsageFailed.replace("{message}", error)}
        </CardContent>
      </Card>
    )
  }

  const totalCost = breakdown.reduce((sum, item) => sum + item.totalCost, 0)
  const totalEvents = breakdown.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalCost}</CardTitle>
            <CurrencyDollarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBillingMoney(totalCost, "IDR")}
            </div>
            <p className="text-xs text-muted-foreground">{t.last30Days}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.totalEvents}
            </CardTitle>
            <LightningIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalEvents.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{t.allServices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.servicesUsed}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{breakdown.length}</div>
            <p className="text-xs text-muted-foreground">
              {t.activeCategories}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.dailyAverage}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBillingMoney(
                trend.length > 0
                  ? Math.round(
                      trend.reduce((sum, d) => sum + d.amount, 0) / trend.length
                    )
                  : 0,
                "IDR"
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t.last30Days}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{t.costByService}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdown.map((item) => (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium capitalize">
                        {item.category}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.eventsCount.replace(
                          "{count}",
                          item.quantity.toLocaleString()
                        )}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">
                        {formatBillingMoney(item.totalCost, "IDR")}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(item.percentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {breakdown.length === 0 && (
                <p className="text-sm text-muted-foreground">{t.noUsageData}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Daily Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t.dailyTrend}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={trend}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value: number) =>
                    `IDR ${(value / 1000).toFixed(0)}k`
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value: number) => [
                        formatBillingMoney(value, "IDR"),
                        t.cost,
                      ]}
                      labelFormatter={(label: string) =>
                        new Date(label).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      }
                    />
                  }
                />
                <Bar
                  dataKey="amount"
                  fill="var(--color-cost)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
