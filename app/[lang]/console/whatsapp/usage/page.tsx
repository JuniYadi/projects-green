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
  ArrowRight,
  Receipt,
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
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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

function getMonthName(month: number, locale?: string): string {
  const loc = locale === "id" ? "id-ID" : "en-US"
  return new Date(2026, month - 1).toLocaleString(loc, { month: "short" })
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
            <Link href="/console/whatsapp/pricing?tab=ledger">
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
            <CardTitle className="text-sm font-medium">
              {locale === "id" ? "Pesan Masuk" : "Inbound Count"}
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
              {locale === "id" ? "Pesan Terkirim" : "Outbound Count"}
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
              {locale === "id"
                ? "Kuota Terpakai Bulan Ini"
                : "Monthly Quota Used"}
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
              {locale === "id" ? "Sisa Kuota Paket" : "Remaining Quota"}
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
              {locale === "id" ? "Estimasi Biaya Bulanan" : "Projected Cost"}
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
              {locale === "id"
                ? "Proyeksi biaya hingga akhir bulan"
                : "Estimated monthly cost"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {locale === "id" ? "Saldo Tersedia" : "Balance"}
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
                Rp{costBreakdown.balance?.toLocaleString("id-ID") ?? "0"}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {locale === "id"
                ? "Saldo pemakaian tambahan (PAYG)"
                : "Overage balance"}
            </p>
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
                {locale === "id" ? "Estimasi: " : "Projected: "}
                {costBreakdown.projectedCost.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                })}
              </span>
              <span>
                {locale === "id" ? "Saldo: Rp" : "Balance: Rp"}
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
                        {dev.phoneNumber ??
                          (locale === "id"
                            ? "Nomor Tidak Diketahui"
                            : "Unknown")}
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
                    usedLabel={locale === "id" ? "terpakai" : "used"}
                    quotaLabel={locale === "id" ? "kuota" : "quota"}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  <WhatsAppText id="s57" />
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  <span>
                    {dateRange.from} <WhatsAppText id="s23" />
                    {dateRange.to}
                  </span>
                </div>
              </div>
              {/* Legend Badges */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[hsl(var(--chart-1))]" />
                  <span className="font-medium text-foreground">
                    {locale === "id" ? "Pesan Masuk" : "Inbound"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[hsl(var(--chart-2))]" />
                  <span className="font-medium text-foreground">
                    {locale === "id" ? "Pesan Terkirim" : "Outbound"}
                  </span>
                </div>
              </div>
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
                    date: new Date(c.date).toLocaleDateString(
                      locale === "id" ? "id-ID" : "en-US",
                      {
                        day: "numeric",
                        month: "short",
                      }
                    ),
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
                    tickFormatter={(v) => `${v}`}
                    width={28}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent className="border bg-background p-2 shadow-md" />
                    }
                  />
                  <Bar
                    dataKey="in"
                    name={locale === "id" ? "Pesan Masuk" : "Inbound"}
                    fill="var(--color-in)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="out"
                    name={locale === "id" ? "Pesan Terkirim" : "Outbound"}
                    fill="var(--color-out)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
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
          <CardTitle>
            {locale === "id" ? "Perbandingan Bulanan" : "Monthly Comparison"}
          </CardTitle>
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
                        {getMonthName(m.month, locale)} {m.year}
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

      {/* Ledger Navigation Banner */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">
                {locale === "id"
                  ? "Butuh Audit & Riwayat Pemotongan Kredit Lengkap?"
                  : "Need Full Credit Deduction & Audit Ledger?"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {locale === "id"
                  ? "Periksa detail pemotongan kuota, status pengiriman Meta, dan refund kredit di menu Tarif & Biaya."
                  : "Inspect itemized credit deductions, Meta delivery statuses, and automatic refunds under Pricing & Ledger."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="shrink-0 gap-1 text-xs"
          >
            <Link href="/console/whatsapp/pricing?tab=ledger">
              <WhatsAppText id="s64" />
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
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
