"use client"

import { eden } from "@/lib/eden"
import { useCallback, useEffect, useState } from "react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import {
  CurrencyDollarIcon,
  PaperPlaneTiltIcon,
  LightningIcon,
  DeviceMobileIcon,
  DownloadIcon,
} from "@phosphor-icons/react"
import type { ChartConfig } from "@/components/ui/chart"

interface UsageBreakdown {
  category: string
  quantity: number
  totalCost: number
  percentage: number
}

interface DailyTrend {
  date: string
  amount: number
}

interface UsageSummary {
  period: string
  breakdown: UsageBreakdown[]
  totalSpend: number
}

function createChartConfig(chartCost: string) {
  return {
    cost: {
      label: chartCost,
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString()}`
}

function exportToCSV(
  data: UsageBreakdown[],
  filename: string,
  headers: string[]
) {
  const rows = data.map((item) => [
    item.category,
    item.quantity.toString(),
    item.totalCost.toString(),
    `${item.percentage.toFixed(1)}%`,
  ])

  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function UsagePage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.billing.usagePage
  const chartConfig = createChartConfig(t.chartCost)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [trend, setTrend] = useState<DailyTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryRes, trendRes] = await Promise.all([
          eden.api.billing.usage.breakdown.get(),
          eden.api.billing.usage.trend.get({ $query: { days: "30" } }),
        ])

        if (
          !summaryRes.data ||
          !trendRes.data ||
          !summaryRes.data.success ||
          !trendRes.data.success
        ) {
          throw new Error(t.loadError)
        }

        setSummary(summaryRes.data!.data as never)
        setTrend(trendRes.data!.data.trend as never)
      } catch (err) {
        setError(err instanceof Error ? err.message : t.unknownError)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [t.loadError, t.unknownError])

  const handleExport = useCallback(() => {
    if (summary?.breakdown) {
      const filename = `usage-report-${summary.period}.csv`
      exportToCSV(summary.breakdown, filename, [
        t.csvCategory,
        t.csvQuantity,
        t.csvTotalCost,
        t.csvPercentage,
      ])
    }
  }, [summary, t.csvCategory, t.csvQuantity, t.csvTotalCost, t.csvPercentage])

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </header>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </main>
    )
  }

  const breakdown = summary?.breakdown ?? []
  const totalCost = summary?.totalSpend ?? 0
  const totalEvents = breakdown.reduce((sum, item) => sum + item.quantity, 0)

  const summaryCards = [
    {
      title: t.totalCost,
      value: formatCurrency(totalCost),
      icon: CurrencyDollarIcon,
      description: t.currentPeriod,
    },
    {
      title: t.totalEvents,
      value: totalEvents.toLocaleString(),
      icon: LightningIcon,
      description: t.allServices,
    },
    {
      title: t.servicesUsed,
      value: breakdown.length.toString(),
      icon: DeviceMobileIcon,
      description: t.activeCategories,
    },
    {
      title: t.dailyAverage,
      value: formatCurrency(
        trend.length > 0
          ? Math.round(
              trend.reduce((sum, d) => sum + d.amount, 0) / trend.length
            )
          : 0
      ),
      icon: PaperPlaneTiltIcon,
      description: t.last30Days,
    },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            {t.exportCsv}
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
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
                        ({item.quantity.toLocaleString()} {t.eventsSuffix}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">
                        {formatCurrency(item.totalCost)}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {breakdown.length === 0 && (
                <p className="text-sm text-muted-foreground">{t.noData}</p>
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
                    new Date(value).toLocaleDateString(
                      locale === "id" ? "id-ID" : "en-US",
                      { month: "short", day: "numeric" }
                    )
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value: number) =>
                    `Rp ${(value / 1000).toFixed(0)}k`
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value: number) => [
                        formatCurrency(value),
                        t.chartCost,
                      ]}
                      labelFormatter={(label: string) =>
                        new Date(label).toLocaleDateString(
                          locale === "id" ? "id-ID" : "en-US",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )
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

      {/* Quota Usage — pending backend support */}
      <Card>
        <CardHeader>
          <CardTitle>{t.quotaUsage}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t.quotaUsageDescription}
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
