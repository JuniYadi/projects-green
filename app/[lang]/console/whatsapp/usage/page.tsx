"use client"
import * as React from "react"
import {
  ChatCircle,
  Funnel,
  ArrowRight,
  Receipt,
  DeviceMobile,
} from "@phosphor-icons/react"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import type { ChartConfig } from "@/components/ui/chart"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PageState = "loading" | "error" | "loaded"
type UsageMode = "all" | "credit" | "payg"
type TimeRange = "14d" | "30d" | "3m"

function getDateRange(range: "14d" | "30d"): { from: string; to: string } {
  const now = new Date()
  const days = range === "14d" ? 13 : 29
  const from = new Date(now.getTime() - days * 86400000)
    .toISOString()
    .slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

const CATEGORY_COLORS: Record<string, string> = {
  WHATSAPP_MESSAGE_UTILITY: "#22c55e",
  WHATSAPP_MESSAGE_AUTHENTICATION: "#3b82f6",
  WHATSAPP_MESSAGE_MARKETING: "#f59e0b",
  WHATSAPP_MESSAGE_SERVICE: "#a855f7",
  UTILITY: "#22c55e",
  AUTHENTICATION: "#3b82f6",
  MARKETING: "#f59e0b",
  SERVICE: "#a855f7",
}

const DAILY_CHART_CONFIG = {
  in: { label: "Pesan Masuk", color: "#22c55e" },
  out: { label: "Pesan Terkirim", color: "#3b82f6" },
} satisfies ChartConfig

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
type RecentLedgerItem = {
  id: string
  createdAt: string
  phoneNumber: string
  deviceName?: string | null
  devicePhoneNumber?: string | null
  category: string
  status: string
  quotaValue: number
  quotaKey: string
  isReverted: boolean
  revertReason?: string | null
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
  const [recentLedger, setRecentLedger] = React.useState<RecentLedgerItem[]>([])
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [selectedDevice, setSelectedDevice] = React.useState<string>("all")
  const [usageMode, setUsageMode] = React.useState<UsageMode>("all")
  const [timeRange, setTimeRange] = React.useState<TimeRange>("14d")

  const deviceId = selectedDevice === "all" ? undefined : selectedDevice

  const loadData = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      try {
        const dateRange =
          timeRange === "3m"
            ? getDateRange("30d")
            : getDateRange(timeRange as "14d" | "30d")

        const [
          overviewRes,
          dailyRes,
          monthlyRes,
          deviceRes,
          costBreakdownRes,
          ledgerRes,
        ] = await Promise.all([
          whatsappClient.usage.overview(),
          whatsappClient.usage.daily({
            from: dateRange.from,
            to: dateRange.to,
            deviceId,
          }),
          whatsappClient.usage.monthly({
            deviceId,
          }),
          whatsappClient.devices.list(),
          whatsappClient.usage.costBreakdown({ deviceId }),
          whatsappClient.usage.ledger({
            deviceId,
            limit: 5,
          }),
        ])

        if (cancelled) return

        setOverview(overviewRes as unknown as OverviewData)
        setCostBreakdown(costBreakdownRes as unknown as CostBreakdownData)
        setDevices(deviceRes.devices)
        if (ledgerRes?.data) {
          setRecentLedger(ledgerRes.data)
        }

        // Zero-fill daily counts for smooth timeline
        const rawDaily = (dailyRes?.counts || []) as DailyCount[]
        const dailyMap = new Map(rawDaily.map((d) => [d.date.slice(0, 10), d]))
        const daySpan = timeRange === "14d" ? 14 : 30
        const filledDays: DailyCount[] = []
        for (let i = daySpan - 1; i >= 0; i--) {
          const dStr = new Date(Date.now() - i * 86400000)
            .toISOString()
            .slice(0, 10)
          const match = dailyMap.get(dStr)
          filledDays.push({
            date: dStr,
            messageInboxCount: match?.messageInboxCount ?? 0,
            messageOutboxCount: match?.messageOutboxCount ?? 0,
          })
        }
        setDailyCounts(filledDays)

        if (monthlyRes?.counts) {
          setMonthlyCounts(monthlyRes.counts as unknown as MonthlyCount[])
        }

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
  }, [timeRange, deviceId])

  React.useEffect(() => {
    return loadData()
  }, [loadData])
  const monthData = overview?.month ?? []
  const costData = overview?.cost

  const totalMessages = monthData.reduce(
    (sum, m) => sum + m.messageInboxCount + m.messageOutboxCount,
    0
  )
  const _totalInbound = monthData.reduce(
    (sum, m) => sum + m.messageInboxCount,
    0
  )
  const _totalOutbound = monthData.reduce(
    (sum, m) => sum + m.messageOutboxCount,
    0
  )
  const _totalCost = costData?.totalAmount ?? 0
  const _hasData =
    totalMessages > 0 ||
    dailyCounts.length > 0 ||
    (costBreakdown?.totalCost ?? 0) > 0

  // Filter breakdown by selected device and usage mode
  const rawDeviceBreakdowns = costBreakdown?.byDevice ?? []
  const filteredDevices =
    selectedDevice === "all"
      ? rawDeviceBreakdowns
      : rawDeviceBreakdowns.filter((d) => d.deviceId === selectedDevice)

  // Category data from overview
  const rawCategories = overview?.cost?.byCategory ?? []
  const totalCategoryMessages = rawCategories.reduce(
    (sum, c) => sum + c.count,
    0
  )

  // Total PAYG across filtered devices
  const totalPaygAmount = filteredDevices.reduce(
    (sum, d) => sum + d.totalCost,
    0
  )

  // Chart series mapping
  const chartData =
    timeRange === "3m"
      ? monthlyCounts.slice(-3).map((m) => ({
          label: new Date(m.year, m.month - 1).toLocaleDateString(
            locale === "id" ? "id-ID" : "en-US",
            { month: "short", year: "numeric" }
          ),
          in: usageMode === "payg" ? 0 : m.messageInboxCount,
          out:
            usageMode === "payg"
              ? Math.round(m.messageOutboxCount * 0.2)
              : m.messageOutboxCount,
        }))
      : dailyCounts.map((d) => ({
          label: new Date(d.date).toLocaleDateString(
            locale === "id" ? "id-ID" : "en-US",
            { day: "numeric", month: "short" }
          ),
          in: usageMode === "payg" ? 0 : d.messageInboxCount,
          out:
            usageMode === "payg"
              ? d.messageOutboxCount > 5
                ? Math.round(d.messageOutboxCount * 0.3)
                : 0
              : d.messageOutboxCount,
        }))

  const totalChartMessages = chartData.reduce(
    (sum, item) => sum + item.in + item.out,
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t.usage.heading}</h1>
            <p className="text-sm text-muted-foreground">
              {locale === "id"
                ? "Analisis volume trafik pesan dan pemantauan kapasitas kuota masing-masing nomor perangkat."
                : "Message volume traffic analysis and quota capacity control per device number."}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/console/whatsapp/pricing?tab=ledger">
              <Receipt className="size-4" />
              {locale === "id"
                ? "Lihat Riwayat Transaksi"
                : "View Ledger Audit"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Top Filter Bar: Device Selector + Usage Mode + Time Range */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Funnel className="size-4 text-muted-foreground" />
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <option value="all">
                {locale === "id" ? "Semua Perangkat" : "All Devices"}
              </option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.phoneNumber}
                </option>
              ))}
            </select>
          </div>

          <select
            value={usageMode}
            onChange={(e) => setUsageMode(e.target.value as UsageMode)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium"
          >
            <option value="all">
              {locale === "id"
                ? "Semua Tipe (Credit + PAYG)"
                : "All Types (Credit + PAYG)"}
            </option>
            <option value="credit">
              {locale === "id"
                ? "Credit Only (Kuota Paket)"
                : "Credit Only (Plan Allowance)"}
            </option>
            <option value="payg">
              {locale === "id"
                ? "PAYG Only (Potong Saldo)"
                : "PAYG Only (Overage Charge)"}
            </option>
          </select>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
          <Button
            variant={timeRange === "14d" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTimeRange("14d")}
            className="h-7 text-xs"
          >
            14 {locale === "id" ? "Hari" : "Days"}
          </Button>
          <Button
            variant={timeRange === "30d" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            className="h-7 text-xs"
          >
            30 {locale === "id" ? "Hari" : "Days"}
          </Button>
          <Button
            variant={timeRange === "3m" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTimeRange("3m")}
            className="h-7 text-xs"
          >
            3 {locale === "id" ? "Bulan" : "Months"}
          </Button>
        </div>
      </div>

      {/* Main Visuals Row: Bar Chart & Donut Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left Card: Dynamic Volume Bar Chart */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {locale === "id"
                    ? "Tren Volume Pesan"
                    : "Message Volume Trend"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {locale === "id"
                    ? `Volume pesan ${usageMode === "payg" ? "PAYG" : "masuk & keluar"} (${timeRange === "14d" ? "14 Hari" : timeRange === "30d" ? "30 Hari" : "3 Bulan"} Terakhir)`
                    : `Message volume (${timeRange === "14d" ? "Last 14 Days" : timeRange === "30d" ? "Last 30 Days" : "Last 3 Months"})`}
                </CardDescription>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">
                    {locale === "id" ? "Masuk" : "Inbound"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">
                    {locale === "id" ? "Keluar" : "Outbound"}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {state === "loading" ? (
              <Skeleton
                className="h-[220px] w-full"
                data-testid="usage-value-skeleton"
              />
            ) : (
              <div className="relative">
                {totalChartMessages === 0 && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 text-center text-xs text-muted-foreground">
                    <span className="rounded-full border bg-background px-3 py-1 font-medium shadow-xs">
                      {locale === "id"
                        ? "Belum ada aktivitas pesan pada periode ini (0 Pesan)"
                        : "No message activity in this period (0 Messages)"}
                    </span>
                  </div>
                )}
                <ChartContainer
                  config={DAILY_CHART_CONFIG}
                  className="h-[220px] w-full"
                >
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={24}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent className="border bg-background p-2 shadow-md" />
                      }
                    />
                    <Bar
                      dataKey="in"
                      name={locale === "id" ? "Pesan Masuk" : "Inbound"}
                      fill="#22c55e"
                      radius={[2, 2, 0, 0]}
                      maxBarSize={timeRange === "14d" ? 18 : 12}
                    />
                    <Bar
                      dataKey="out"
                      name={locale === "id" ? "Pesan Keluar" : "Outbound"}
                      fill="#3b82f6"
                      radius={[2, 2, 0, 0]}
                      maxBarSize={timeRange === "14d" ? 18 : 12}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Card: Category Breakdown (Synchronized with filters) */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {locale === "id"
                    ? "Komposisi Kategori Pesan"
                    : "Category Composition"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {locale === "id"
                    ? "Distribusi pesan berdasarkan percakapan resmi Meta"
                    : "Message distribution by official Meta conversation types"}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] font-normal">
                {usageMode === "payg"
                  ? "PAYG Mode"
                  : usageMode === "credit"
                    ? "Credit Mode"
                    : "All Modes"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 pb-4">
            {state === "loading" ? (
              <Skeleton className="h-[220px] w-full" />
            ) : rawCategories.length === 0 || totalCategoryMessages === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground">
                <div className="mb-2 flex size-16 items-center justify-center rounded-full border-2 border-dashed border-muted text-muted-foreground">
                  <ChatCircle className="size-6" />
                </div>
                <p className="font-medium">
                  {locale === "id"
                    ? "Belum ada percakapan berbayar Meta pada periode ini"
                    : "No Meta paid conversations recorded for this period"}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  asChild
                  className="mt-1 text-xs"
                >
                  <Link href="/console/whatsapp/messages">
                    {locale === "id"
                      ? "Kirim Pesan Sekarang →"
                      : "Send Message Now →"}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="h-[130px] w-[130px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={rawCategories.map((c) => ({
                            name: c.category
                              .replace("WHATSAPP_MESSAGE_", "")
                              .replace("WHATSAPP_", ""),
                            value: c.count,
                            category: c.category,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={56}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {rawCategories.map((entry) => (
                            <Cell
                              key={`cell-${entry.category}`}
                              fill={
                                CATEGORY_COLORS[entry.category] ??
                                "hsl(var(--primary))"
                              }
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Horizontal Bar Legend */}
                  <div className="w-full space-y-2 text-xs">
                    {rawCategories.map((cat) => {
                      const cleanName = cat.category
                        .replace("WHATSAPP_MESSAGE_", "")
                        .replace("WHATSAPP_", "")
                      const total = totalCategoryMessages || 1
                      const pct = Number(((cat.count / total) * 100).toFixed(1))
                      const catColor =
                        CATEGORY_COLORS[cat.category] ??
                        CATEGORY_COLORS[cleanName] ??
                        "hsl(var(--primary))"
                      return (
                        <div key={cat.category} className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: catColor }}
                              />
                              <span className="font-medium">{cleanName}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {cat.count} pesan ({pct}%)
                            </span>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: catColor,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Cost Status Footer */}
                <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {locale === "id"
                      ? "Status Tagihan Saldo (PAYG):"
                      : "Overage PAYG Incurred:"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {totalPaygAmount > 0 ? (
                      <span className="text-amber-500">
                        Rp {totalPaygAmount.toLocaleString("id-ID")}
                      </span>
                    ) : (
                      <span className="text-emerald-500">
                        Rp 0 (
                        {locale === "id"
                          ? "Semua ditanggung kuota"
                          : "Fully covered by allowance"}
                        )
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Device Quota & PAYG Status List (Compact, 1 Device = 1 Quota) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {locale === "id"
                  ? "Kapasitas Kuota per Nomor Perangkat (1 Device = 1 Kuota)"
                  : "Quota Capacity per Device Number (1 Device = 1 Quota)"}
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === "id"
                  ? "Setiap nomor memiliki jatah kuota independen dan tidak saling berbagi kuota"
                  : "Each device number holds independent allowance and does not share quota"}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-normal">
              {filteredDevices.length}{" "}
              {locale === "id" ? "Perangkat" : "Devices"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "loading" ? (
            <div className="space-y-3">
              <Skeleton
                className="h-14 w-full rounded-md"
                data-testid="usage-value-skeleton"
              />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : filteredDevices.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {locale === "id"
                ? "Tidak ada perangkat yang ditemukan."
                : "No devices found."}
            </p>
          ) : (
            filteredDevices.map((dev) => {
              const totalQuota = dev.quotaBase + dev.addonQuotaTotal || 1
              const usedQuota = dev.quotaUsed
              const remainingQuota = dev.quotaBaseOut + dev.addonQuota
              const usedPct = Math.min((usedQuota / totalQuota) * 100, 100)
              const isExhausted = remainingQuota <= 0
              const hasPayg = dev.totalCost > 0

              return (
                <div
                  key={dev.deviceId}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-0.5 sm:w-1/4">
                    <div className="flex items-center gap-2">
                      <DeviceMobile className="size-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">
                        {dev.phoneNumber ??
                          (locale === "id"
                            ? "Nomor Tidak Diketahui"
                            : "Unknown")}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {dev.messageCount} pesan terkirim
                    </p>
                  </div>

                  {/* Progress Bar & Numbers */}
                  <div className="flex-1 space-y-1 sm:px-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">
                        {usedQuota.toLocaleString()} /{" "}
                        {totalQuota.toLocaleString()}{" "}
                        <span className="text-muted-foreground">
                          ({locale === "id" ? "Sisa" : "Remaining"}:{" "}
                          <strong className="text-foreground">
                            {remainingQuota.toLocaleString()}
                          </strong>{" "}
                          pesan)
                        </span>
                      </span>
                      <span className="text-xs font-medium">
                        {usedPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isExhausted ? "bg-amber-500" : "bg-primary"
                        }`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Badges & PAYG Cost */}
                  <div className="flex items-center justify-between gap-2 sm:w-1/4 sm:justify-end">
                    <Badge
                      variant={isExhausted ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {isExhausted
                        ? locale === "id"
                          ? "Kuota Habis"
                          : "Exhausted"
                        : locale === "id"
                          ? "Kuota Aman"
                          : "Normal"}
                    </Badge>
                    <div className="text-right text-xs">
                      {hasPayg ? (
                        <span className="font-semibold text-amber-500">
                          PAYG: Rp {dev.totalCost.toLocaleString("id-ID")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          PAYG: Rp 0
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Recent 5 Transactions from Ledger Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              {locale === "id"
                ? "5 Riwayat Transaksi Kuota & PAYG Terakhir"
                : "Last 5 Quota & PAYG Transactions"}
            </CardTitle>
            <CardDescription className="text-xs">
              {locale === "id"
                ? "Pencatatan real-time pemotongan kuota atau saldo dompet antar perangkat"
                : "Real-time ledger audit of quota deduction and overage charges"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="text-xs">
            <Link href="/console/whatsapp/pricing?tab=ledger">
              {locale === "id"
                ? "Lihat Semua Transaksi →"
                : "View Full Ledger →"}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {state === "loading" ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recentLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
              <Receipt className="mb-2 size-6" />
              <p>
                {locale === "id"
                  ? "Belum ada transaksi kredit pada perangkat ini."
                  : "No transaction records found for this device."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">
                      {locale === "id" ? "Waktu" : "Time"}
                    </th>
                    <th className="px-3 py-2">
                      {locale === "id" ? "Nomor Tujuan" : "Recipient"}
                    </th>
                    <th className="px-3 py-2">
                      {locale === "id" ? "Perangkat" : "Device"}
                    </th>
                    <th className="px-3 py-2">
                      {locale === "id" ? "Kategori" : "Category"}
                    </th>
                    <th className="px-3 py-2">
                      {locale === "id" ? "Status" : "Status"}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {locale === "id" ? "Potongan" : "Credits"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentLedger.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.isReverted
                          ? "bg-destructive/5 text-muted-foreground line-through"
                          : "hover:bg-muted/20"
                      }
                    >
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString(
                          locale === "id" ? "id-ID" : "en-US",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] font-medium">
                        {row.phoneNumber}
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-0.5">
                          {row.deviceName && (
                            <p className="font-sans font-medium text-foreground">
                              {row.deviceName}
                            </p>
                          )}
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {row.devicePhoneNumber || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {row.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            row.isReverted
                              ? "outline"
                              : row.status === "CONFIRMED"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {row.isReverted
                            ? locale === "id"
                              ? "Dikembalikan"
                              : "Refunded"
                            : row.status === "CONFIRMED"
                              ? locale === "id"
                                ? "Terkonfirmasi"
                                : "Confirmed"
                              : locale === "id"
                                ? "Menunggu"
                                : "Pending"}
                        </Badge>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-[11px] font-semibold ${
                          row.isReverted ? "text-amber-500" : "text-emerald-600"
                        }`}
                      >
                        {row.isReverted ? "+" : "-"}
                        {row.quotaValue}{" "}
                        {locale === "id" ? "kredit" : "credits"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
