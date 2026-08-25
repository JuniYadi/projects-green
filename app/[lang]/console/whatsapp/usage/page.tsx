"use client"
import {
  formatWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import {
  ChatCircle,
  PaperPlaneTilt,
  CurrencyDollar,
  ChartLine,
  Calendar,
  Funnel,
  CheckCircle,
  Clock,
  ArrowCounterClockwise,
  ArrowRight,
} from "@phosphor-icons/react"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import { QuotaProgressBar } from "@/components/whatsapp/quota-progress-bar"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { WhatsappBillingLedgerEntryDTO } from "@/modules/whatsapp/usage/usage.dto"

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
    quotaBaseOut: number
    addonQuota: number
    addonQuotaTotal: number
    quotaUsed: number
    quotaPercent: number
  }[]
  balance: number | null
  currency: string
}

function getLast30DaysRange(): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10)
  return { from, to }
}

function getMonthName(month: number): string {
  return new Date(2026, month - 1).toLocaleString("en", { month: "short" })
}

const DAILY_CHART_CONFIG = {
  in: { label: "Inbound", color: "hsl(var(--chart-1))" },
  out: { label: "Outbound", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

function getLast6Months(): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return months
}

function formatLedgerDate(iso: string | Date): string {
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso
    return d.toLocaleString("id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(iso)
  }
}

export default function WhatsAppUsagePage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.whatsapp
  const [state, setState] = React.useState<PageState>("loading")
  const [_error, setError] = React.useState("")
  const [overview, setOverview] = React.useState<OverviewData | null>(null)
  const [costBreakdown, setCostBreakdown] =
    React.useState<CostBreakdownData | null>(null)
  const [dailyCounts, setDailyCounts] = React.useState<DailyCount[]>([])
  const [monthlyCounts, setMonthlyCounts] = React.useState<MonthlyCount[]>([])
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [selectedDevice, setSelectedDevice] = React.useState<string>("all")
  const [dateRange, _setDateRange] = React.useState(getLast30DaysRange)
  const [recentLedger, setRecentLedger] = React.useState<
    WhatsappBillingLedgerEntryDTO[]
  >([])
  const [recentLedgerLoading, setRecentLedgerLoading] = React.useState(true)

  const deviceId = selectedDevice === "all" ? undefined : selectedDevice

  const loadData = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      try {
        const last6 = getLast6Months()

        const [
          overviewRes,
          dailyRes,
          deviceRes,
          costBreakdownRes,
          ledgerRes,
          ...monthlyResults
        ] = await Promise.all([
          whatsappClient.usage.overview(),
          whatsappClient.usage.daily({
            from: dateRange.from,
            to: dateRange.to,
            deviceId,
          }),
          whatsappClient.devices.list(),
          whatsappClient.usage.costBreakdown({ deviceId }),
          whatsappClient.usage.ledger({ limit: 5 }),
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

        if (ledgerRes && ledgerRes.ok) {
          setRecentLedger(
            (ledgerRes.data as unknown as WhatsappBillingLedgerEntryDTO[]) ?? []
          )
        }

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
      } finally {
        setRecentLedgerLoading(false)
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
    totalMessages > 0 ||
    dailyCounts.length > 0 ||
    monthlyCounts.length > 0 ||
    (costBreakdown?.totalCost ?? 0) > 0

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t.usage.heading}</h1>
            <p className="text-sm text-muted-foreground">
              {t.usage.description}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/console/whatsapp/ledger">
              <WhatsAppText id="s46" />
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Device Filter */}
      <div className="flex items-center gap-3">
        <Funnel className="size-4 text-muted-foreground" />
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">
            <WhatsAppText id="s47" />
          </option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.phoneNumber}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <WhatsAppText id="s44" />
            </CardTitle>
            <ChatCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                {totalMessages.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <WhatsAppText id="s48" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound Count</CardTitle>
            <ChatCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                {totalInbound.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <WhatsAppText id="s49" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Outbound Count
            </CardTitle>
            <PaperPlaneTilt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                {totalOutbound.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <WhatsAppText id="s50" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <WhatsAppText id="s45" />
            </CardTitle>
            <CurrencyDollar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                Rp{" "}
                {totalCost.toLocaleString("id-ID", {
                  minimumFractionDigits: 0,
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {formatWhatsAppText(
                "s300",
                { count: costData?.totalEntries ?? 0 },
                locale
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quota and Projected Cost Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Quota Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" || !costBreakdown ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                {costBreakdown.byDevice
                  .reduce((s, d) => s + d.quotaUsed, 0)
                  .toLocaleString()}{" "}
                /{" "}
                {costBreakdown.byDevice
                  .reduce((s, d) => s + d.quotaBase + d.addonQuotaTotal, 0)
                  .toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <WhatsAppText id="s51" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Remaining Quota
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" || !costBreakdown ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                {costBreakdown.byDevice
                  .reduce((s, d) => s + d.quotaBaseOut + d.addonQuota, 0)
                  .toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <WhatsAppText id="s52" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Projected Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" || !costBreakdown ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                {costBreakdown.projectedCost.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                }) || "—"}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Estimated monthly cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" || !costBreakdown ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="text-2xl font-bold">
                Rp{costBreakdown.balance?.toLocaleString("id-ID") ?? "0"}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Overage balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown by Device */}
      {state === "loaded" && costBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>
              <WhatsAppText id="s53" />
            </CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Projected:{" "}
                {costBreakdown.projectedCost.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                })}
              </span>
              <span>
                Balance: Rp
                {costBreakdown.balance?.toLocaleString("id-ID") ?? "0"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {costBreakdown.byDevice.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                <WhatsAppText id="s54" />
              </p>
            ) : (
              costBreakdown.byDevice.map((dev) => (
                <div key={dev.deviceId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {dev.phoneNumber ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhatsAppText(
                          "s301",
                          {
                            credits: dev.quotaUsed,
                            messages: dev.messageCount,
                          },
                          locale
                        )}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      Rp{" "}
                      {dev.totalCost.toLocaleString("id-ID", {
                        minimumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                  <QuotaProgressBar
                    used={dev.quotaUsed}
                    total={dev.quotaBase + dev.addonQuotaTotal}
                  />
                </div>
              ))
            )}
            {costBreakdown.byDevice.length > 0 && (
              <div className="flex items-center justify-between border-t pt-3 text-sm font-medium">
                <span>
                  <WhatsAppText id="s56" />
                </span>
                <span>
                  Rp{" "}
                  {costBreakdown.byDevice
                    .reduce((s, d) => s + d.totalCost, 0)
                    .toLocaleString("id-ID", { minimumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Chart + Cost by Category + Monthly */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <WhatsAppText id="s57" />
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              <span>
                {dateRange.from} <WhatsAppText id="s23" />
                {dateRange.to}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <Skeleton className="h-[240px] w-full" />
            ) : dailyCounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ChatCircle
                  className="mb-3 size-10 text-muted-foreground"
                  weight="fill"
                />
                <p className="text-sm text-muted-foreground">
                  <WhatsAppText id="s58" />
                </p>
              </div>
            ) : (
              <ChartContainer
                config={DAILY_CHART_CONFIG}
                className="h-[240px] w-full"
              >
                <BarChart
                  data={dailyCounts.map((c) => ({
                    date: new Date(c.date).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                    }),
                    in: c.messageInboxCount,
                    out: c.messageOutboxCount,
                  }))}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent className="border bg-background p-2 shadow-md" />
                    }
                  />
                  <Bar
                    dataKey="in"
                    fill="var(--color-in)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="out"
                    fill="var(--color-out)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <WhatsAppText id="s59" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "loading" ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !costData || costData.byCategory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  <WhatsAppText id="s60" />
                </p>
              </div>
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
                          <Badge
                            variant="secondary"
                            className="text-xs font-semibold"
                          >
                            {cat.category
                              .replace("WHATSAPP_MESSAGE_", "")
                              .replace("WHATSAPP_", "")
                              .toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatWhatsAppText(
                              "s299",
                              { count: cat.count.toLocaleString() },
                              locale
                            )}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">
                            Rp {cat.totalCost.toLocaleString("id-ID")}
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
      </div>

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
              <WhatsAppText id="s61" />
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
                        {formatWhatsAppText(
                          "s298",
                          {
                            inbound: m.messageInboxCount.toLocaleString(),
                            outbound: m.messageOutboxCount.toLocaleString(),
                            failed:
                              m.messageFailedCount > 0
                                ? formatWhatsAppText(
                                    "s355",
                                    { count: m.messageFailedCount },
                                    locale
                                  )
                                : "",
                          },
                          locale
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {total.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <WhatsAppText id="s63" />
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent 5 Deductions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              <WhatsAppText id="s382" locale={locale} />
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              <WhatsAppText id="s383" locale={locale} />
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/console/whatsapp/ledger">
              <WhatsAppText id="s64" />
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>
                  <WhatsAppText id="s10" />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>
                  <WhatsAppText id="s302" locale={locale} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLedgerLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : recentLedger.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-sm text-muted-foreground"
                  >
                    <WhatsAppText id="s65" />
                  </TableCell>
                </TableRow>
              ) : (
                recentLedger.map((row) => {
                  const isRefunded =
                    row.isReverted || row.status === "REVERTED_FAILED"
                  const isConfirmed = row.status === "CONFIRMED"

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatLedgerDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {row.phoneNumber}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold"
                        >
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {row.quotaValue}
                      </TableCell>
                      <TableCell>
                        {isRefunded ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400"
                          >
                            <ArrowCounterClockwise className="size-3" />
                            REFUNDED
                          </Badge>
                        ) : isConfirmed ? (
                          <Badge
                            variant="default"
                            className="gap-1 bg-emerald-600 text-[10px] text-white"
                          >
                            <CheckCircle className="size-3" weight="fill" />
                            CONFIRMED
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[10px]"
                          >
                            <Clock className="size-3" />
                            PENDING
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Empty State Banner */}
      {state === "loaded" && !hasData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ChartLine
              className="mb-4 size-12 text-muted-foreground"
              weight="fill"
            />
            <h3 className="mb-1 text-lg font-medium">
              <WhatsAppText id="s66" />
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              <WhatsAppText id="s67" />
            </p>
            <Button variant="outline" asChild className="mt-3">
              <Link href="?doc=1">
                <WhatsAppText id="s68" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
