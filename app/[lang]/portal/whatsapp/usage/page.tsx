"use client"

import * as React from "react"
import {
  ChatCircle,
  PaperPlaneTilt,
  CurrencyDollar,
  ChartLine,
  Calendar,
  Funnel,
  Warning,
} from "@phosphor-icons/react"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import { QuotaProgressBar } from "@/components/whatsapp/quota-progress-bar"

type PageState = "loading" | "error" | "loaded"

interface DailyCount {
  date: string
  messageInboxCount: number
  messageOutboxCount: number
}

interface MonthlyCount {
  year: number
  month: number
  messageInboxCount: number
  messageOutboxCount: number
  sessionCount: number
  messageFailedCount: number
}

interface CostCategory {
  category: string
  count: number
  totalCost: number
}

interface OverviewData {
  month: MonthlyCount[]
  cost: {
    totalAmount: number
    totalEntries: number
    byCategory: CostCategory[]
  }
  devices: {
    deviceId: string | null
    phoneNumber: string | null
    messageInboxCount: number
    messageOutboxCount: number
    sessionCount: number
    messageFailedCount: number
  }[]
}

interface CostBreakdownData {
  period: string
  totalCost: number
  projectedCost: number
  forecast: {
    daysElapsed: number
    daysRemaining: number
    currentCost: number
    projectedMonthlyCost: number
  }
  byDevice: {
    deviceId: string
    phoneNumber: string | null
    totalCost: number
    byCategory: { category: string; count: number; totalCost: number }[]
    messageCount: number
    quotaBase: number
    quotaUsed: number
    quotaPercent: number
  }[]
  balance: number | null
  currency: string
}

const dailyChartConfig = {
  inbound: {
    label: "Inbound",
    color: "var(--chart-1)",
  },
  outbound: {
    label: "Outbound",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`
}

function getMonthName(month: number): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  return months[month - 1] ?? ""
}

function getLast30DaysRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function getLast6Months(): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return months
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-1 h-7 w-16" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}

export default function PortalWhatsAppUsagePage() {
  const [state, setState] = React.useState<PageState>("loading")
  const [error, setError] = React.useState("")
  const [overview, setOverview] = React.useState<OverviewData | null>(null)
  const [costBreakdown, setCostBreakdown] = React.useState<CostBreakdownData | null>(null)
  const [dailyCounts, setDailyCounts] = React.useState<DailyCount[]>([])
  const [monthlyCounts, setMonthlyCounts] = React.useState<MonthlyCount[]>([])
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [selectedDevice, setSelectedDevice] = React.useState<string>("all")
  const [dateRange, setDateRange] = React.useState(getLast30DaysRange)

  const deviceId = selectedDevice === "all" ? undefined : selectedDevice

  const loadData = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      try {
        const last6 = getLast6Months()

        const [overviewRes, dailyRes, deviceRes, costBreakdownRes, ...monthlyResults] =
          await Promise.all([
            whatsappClient.usage.overview(),
            whatsappClient.usage.daily({
              from: dateRange.from,
              to: dateRange.to,
              deviceId,
            }),
            whatsappClient.devices.list(),
            whatsappClient.usage.costBreakdown({ deviceId }),
            ...last6.map((m) =>
              whatsappClient.usage.monthly({
                year: m.year,
                month: m.month,
                deviceId,
              })
            ),
          ])

        if (cancelled) return

        setOverview(overviewRes as unknown as OverviewData)
        setCostBreakdown(costBreakdownRes as unknown as CostBreakdownData)
        setDailyCounts(
          (dailyRes.counts as unknown as DailyCount[]).map((c) => ({
            date: c.date,
            messageInboxCount: c.messageInboxCount,
            messageOutboxCount: c.messageOutboxCount,
          }))
        )
        setDevices(deviceRes.devices)

        const allMonthly: MonthlyCount[] = []
        for (const res of monthlyResults) {
          for (const c of res.counts as unknown as MonthlyCount[]) {
            allMonthly.push(c)
          }
        }
        setMonthlyCounts(allMonthly)

        setState("loaded")
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : "Failed to load usage data."
        setError(message)
        setState("error")
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [dateRange.from, dateRange.to, deviceId])

  React.useEffect(() => {
    return loadData()
  }, [loadData])

  const monthData = overview?.month ?? []
  const costData = overview?.cost

  const totalMessages = monthData.reduce(
    (sum, m) => sum + m.messageInboxCount + m.messageOutboxCount,
    0
  )
  const totalInbound = monthData.reduce(
    (sum, m) => sum + m.messageInboxCount,
    0
  )
  const totalOutbound = monthData.reduce(
    (sum, m) => sum + m.messageOutboxCount,
    0
  )
  const totalCost = costData?.totalAmount ?? 0

  const hasData =
    totalMessages > 0 || dailyCounts.length > 0 || monthlyCounts.length > 0

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Usage Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Track message volumes, costs, and trends for your WhatsApp
              Business account.
            </p>
          </div>
          {devices.length > 1 && (
            <div className="flex items-center gap-2">
              <Funnel className="size-4 text-muted-foreground" />
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.phoneNumber ?? d.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {state === "error" && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Quota Alert Banner */}
      {state === "loaded" && costBreakdown && costBreakdown.byDevice.some((d) => d.quotaBase > 0 && d.quotaPercent >= 70) && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <Warning className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="text-sm text-yellow-600 dark:text-yellow-400">
            <strong>Quota Warning:</strong> One or more devices are approaching their monthly limit.
            <a href="/portal/whatsapp/usage" className="ml-1 underline">View details</a>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {state === "loading" ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Messages
                </CardTitle>
                <ChartLine
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalMessages.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Inbound Count
                </CardTitle>
                <ChatCircle
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalInbound.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Messages received
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Outbound Count
                </CardTitle>
                <PaperPlaneTilt
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalOutbound.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Messages sent</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Cost
                </CardTitle>
                <CurrencyDollar
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalCost)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {costData?.totalEntries ?? 0} ledger entries
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Per-Device Cost Breakdown */}
      {state === "loaded" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cost Breakdown by Device</CardTitle>
              {costBreakdown && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Projected: {formatCurrency(costBreakdown.projectedCost)}
                  </span>
                  {costBreakdown.balance !== null && (
                    <span className="text-muted-foreground">
                      Balance: {formatCurrency(costBreakdown.balance)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!costBreakdown || costBreakdown.byDevice.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No cost data available for this period.
              </p>
            ) : (
              <div className="space-y-4">
                {costBreakdown.byDevice.map((dev) => (
                  <div key={dev.deviceId} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {dev.phoneNumber ?? dev.deviceId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dev.messageCount.toLocaleString()} messages
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {formatCurrency(dev.totalCost)}
                        </p>
                        {dev.byCategory.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {dev.byCategory.map((c) => c.category.replace("WHATSAPP_MESSAGE_", "")).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    {dev.quotaBase > 0 && (
                      <QuotaProgressBar
                        used={dev.quotaUsed}
                        total={dev.quotaBase}
                      />
                    )}
                  </div>
                ))}
                <div className="flex justify-between rounded-lg bg-muted p-4 font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(costBreakdown.totalCost)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daily Message Trend</CardTitle>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    from: e.target.value,
                  }))
                }
                className="rounded-md border bg-background px-2 py-1 text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    to: e.target.value,
                  }))
                }
                className="rounded-md border bg-background px-2 py-1 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {state === "loading" ? (
            <Skeleton className="h-[300px] w-full" />
          ) : dailyCounts.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No message data for the selected date range.
              </p>
            </div>
          ) : (
            <ChartContainer config={dailyChartConfig} className="h-[300px]">
              <BarChart data={dailyCounts}>
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
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
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
                  dataKey="messageInboxCount"
                  name="Inbound"
                  fill="var(--color-inbound)"
                  stackId="messages"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="messageOutboxCount"
                  name="Outbound"
                  fill="var(--color-outbound)"
                  stackId="messages"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown + Monthly Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !costData || costData.byCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No cost data available for this period.
              </p>
            ) : (
              <div className="space-y-4">
                {costData.byCategory.map((cat) => {
                  const percentage =
                    costData.totalAmount > 0
                      ? (cat.totalCost / costData.totalAmount) * 100
                      : 0
                  return (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {cat.category
                              .replace("WHATSAPP_MESSAGE_", "")
                              .toLowerCase()
                              .replace(/^\w/, (c) => c.toUpperCase())}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {cat.count.toLocaleString()} entries
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">
                            {formatCurrency(cat.totalCost)}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : monthlyCounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No monthly data available.
              </p>
            ) : (
              <div className="space-y-3">
                {monthlyCounts.map((m) => {
                  const total = m.messageInboxCount + m.messageOutboxCount
                  return (
                    <div
                      key={`${m.year}-${m.month}`}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {getMonthName(m.month)} {m.year}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.messageInboxCount.toLocaleString()} in /{" "}
                          {m.messageOutboxCount.toLocaleString()} out
                          {m.messageFailedCount > 0 &&
                            ` · ${m.messageFailedCount} failed`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {total.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          total messages
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty State Banner */}
      {state === "loaded" && !hasData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ChartLine
              className="mb-4 size-12 text-muted-foreground"
              weight="fill"
            />
            <h3 className="mb-1 text-lg font-medium">No usage data yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Once your WhatsApp devices start sending and receiving messages,
              usage data will appear here with charts and cost breakdowns.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
