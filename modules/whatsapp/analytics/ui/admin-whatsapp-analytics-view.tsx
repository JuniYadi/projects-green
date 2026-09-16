"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Percent,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { defaultLocale, type AppLocale } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
const monthlyChartConfig = {
  revenueIdr: {
    label: "Omzet Tagihan",
    color: "#3b82f6",
  },
  metaTotalCostIdr: {
    label: "Modal Meta (+PPN)",
    color: "#ef4444",
  },
  grossProfitIdr: {
    label: "Laba Kotor",
    color: "#10b981",
  },
} satisfies ChartConfig

interface MonthlyTrendItem {
  month: string
  deliveredMessages: number
  metaTotalCostIdr: number
  revenueIdr: number
  grossProfitIdr: number
  marginPct: number
}

interface FinancialSummary {
  period: {
    startDate: string
    endDate: string
  }
  kpi: {
    totalDeliveredMessages: number
    totalRevenueIdr: string
    totalMetaBaseCostIdr: string
    totalMetaVatCostIdr: string
    totalMetaNetCostIdr: string
    grossProfitIdr: string
    grossMarginPct: string
    status: "HEALTHY" | "MODERATE" | "RISK"
  }
  categoryBreakdown: Array<{
    category: string
    volume: number
    metaBaseCostIdr: string
    metaVatCostIdr: string
    metaTotalCostIdr: string
    revenueIdr: string
    grossProfitIdr: string
    marginPct: string
  }>
}

interface OrgProfitabilityItem {
  organizationId: string
  organizationName?: string
  deviceCount: number
  totalDelivered: number
  metaBaseCostIdr: string
  metaVatCostIdr: string
  metaTotalCostIdr: string
  revenueIdr: string
  grossProfitIdr: string
  marginPct: string
  marginStatus: "HEALTHY" | "MODERATE" | "RISK"
}

function TopOrgCardList({
  orgs,
  emptyMessage,
  formatIdr,
  messages,
}: {
  orgs: OrgProfitabilityItem[]
  emptyMessage: string
  formatIdr: (val?: string | number) => string
  messages?: ReturnType<
    typeof getMessages
  >["console"]["whatsapp"]["adminAnalytics"]
}) {
  if (orgs.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  const sorted = [...orgs].sort(
    (a, b) => parseFloat(b.revenueIdr) - parseFloat(a.revenueIdr)
  )
  const maxRev = Math.max(...sorted.map((o) => parseFloat(o.revenueIdr)), 1)

  return (
    <>
      {sorted.slice(0, 5).map((org, idx) => {
        const rev = parseFloat(org.revenueIdr)
        const profit = parseFloat(org.grossProfitIdr)
        const isDeficit = profit < 0
        const pct = Math.min(Math.round((rev / maxRev) * 100), 100)
        const orgLabel =
          org.organizationName && org.organizationName !== org.organizationId
            ? org.organizationName
            : `Tenant (${org.organizationId.slice(0, 12)}...)`

        return (
          <div
            key={org.organizationId}
            className="space-y-1.5 rounded-lg border border-border/50 bg-card/40 p-2.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                  #{idx + 1}
                </span>
                <span className="truncate font-medium text-foreground">
                  {orgLabel}
                </span>
              </div>
              <div className="shrink-0 text-right font-mono font-semibold">
                {formatIdr(org.revenueIdr)}
              </div>
            </div>

            {/* Mini Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${isDeficit ? "bg-destructive" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted-foreground">
              <span>
                {org.totalDelivered.toLocaleString("id-ID")}{" "}
                {messages?.messagesUnit ?? "messages"}
              </span>
              <span
                className={`font-mono font-medium ${isDeficit ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {isDeficit ? "- " : "+ "}
                {formatIdr(org.grossProfitIdr)} ({org.marginPct}%)
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}

export function AdminWhatsappAnalyticsView() {
  const params = useParams()
  const locale = ((params?.lang as string) ?? defaultLocale) as AppLocale
  const messages = getMessages(locale).console.whatsapp.adminAnalytics
  const [syncing, setSyncing] = React.useState(false)
  const [summary, setSummary] = React.useState<FinancialSummary | null>(null)
  const [orgs, setOrgs] = React.useState<OrgProfitabilityItem[]>([])
  const [periodPreset, setPeriodPreset] = React.useState("30d")

  const monthOptions = React.useMemo(() => {
    const now = new Date()
    const options: Array<{ value: string; label: string }> = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
      )
      const year = d.getUTCFullYear()
      const monthNum = String(d.getUTCMonth() + 1).padStart(2, "0")
      const value = `month_${year}-${monthNum}`
      const label = d.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      })
      options.push({ value, label })
    }
    return options
  }, [])
  const [customStart, setCustomStart] = React.useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    return d.toISOString().split("T")[0]
  })
  const [customEnd, setCustomEnd] = React.useState(() => {
    return new Date().toISOString().split("T")[0]
  })
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null)
  const [monthlyTrends, setMonthlyTrends] = React.useState<MonthlyTrendItem[]>(
    []
  )
  const [refreshToken, setRefreshToken] = React.useState(0)
  const [lastMonthOrgs, setLastMonthOrgs] = React.useState<
    OrgProfitabilityItem[]
  >([])
  const [curMonthOrgs, setCurMonthOrgs] = React.useState<
    OrgProfitabilityItem[]
  >([])
  const [monthLabels, setMonthLabels] = React.useState({
    current: "",
    last: "",
  })
  const getPeriodParams = React.useCallback(() => {
    if (periodPreset === "custom") {
      const p = new URLSearchParams()
      if (customStart && customEnd) {
        p.set("startDate", customStart)
        p.set("endDate", customEnd)
        return p.toString()
      }
      // Fallback to 30 days if custom range is not fully selected yet
      return new URLSearchParams({ days: "30" }).toString()
    }

    if (periodPreset.startsWith("month_")) {
      const ym = periodPreset.replace("month_", "")
      const [yearStr, monthStr] = ym.split("-")
      const y = Number(yearStr)
      const m = Number(monthStr)
      const start = new Date(Date.UTC(y, m - 1, 1))
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59))
      const p = new URLSearchParams({
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      })
      return p.toString()
    }

    const daysMap: Record<string, string> = {
      "7d": "7",
      "30d": "30",
      "60d": "60",
      "90d": "90",
    }
    return new URLSearchParams({
      days: daysMap[periodPreset] || "30",
    }).toString()
  }, [periodPreset, customStart, customEnd])

  React.useEffect(() => {
    let ignore = false
    const run = async () => {
      try {
        const queryStr = getPeriodParams()
        const now = new Date()
        const curStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        )
        const curEnd = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)
        )
        const lastStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
        )
        const lastEnd = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59)
        )

        const curMonthParams = `startDate=${curStart.toISOString().split("T")[0]}&endDate=${curEnd.toISOString().split("T")[0]}`
        const lastMonthParams = `startDate=${lastStart.toISOString().split("T")[0]}&endDate=${lastEnd.toISOString().split("T")[0]}`

        setMonthLabels({
          current: curStart.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          }),
          last: lastStart.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          }),
        })
        const [sumRes, orgsRes, trendsRes, curMonthRes, lastMonthRes] =
          await Promise.all([
            fetch(`/api/admin/whatsapp/analytics/summary?${queryStr}`),
            fetch(`/api/admin/whatsapp/analytics/organizations?${queryStr}`),
            fetch("/api/admin/whatsapp/analytics/monthly-trends?months=12"),
            fetch(
              `/api/admin/whatsapp/analytics/organizations?${curMonthParams}`
            ),
            fetch(
              `/api/admin/whatsapp/analytics/organizations?${lastMonthParams}`
            ),
          ])
        const sumJson = (await sumRes.json()) as {
          ok?: boolean
          data?: FinancialSummary
        }
        const orgsJson = (await orgsRes.json()) as {
          ok?: boolean
          data?: OrgProfitabilityItem[]
        }
        const trendsJson = (await trendsRes.json()) as {
          ok?: boolean
          data?: MonthlyTrendItem[]
        }
        const curMonthJson = (await curMonthRes.json()) as {
          ok?: boolean
          data?: OrgProfitabilityItem[]
        }
        const lastMonthJson = (await lastMonthRes.json()) as {
          ok?: boolean
          data?: OrgProfitabilityItem[]
        }
        if (!ignore) {
          if (sumJson.ok && sumJson.data) setSummary(sumJson.data)
          if (orgsJson.ok && Array.isArray(orgsJson.data))
            setOrgs(orgsJson.data)
          if (trendsJson.ok && Array.isArray(trendsJson.data))
            setMonthlyTrends(trendsJson.data)
          if (curMonthJson.ok && Array.isArray(curMonthJson.data))
            setCurMonthOrgs(curMonthJson.data)
          if (lastMonthJson.ok && Array.isArray(lastMonthJson.data))
            setLastMonthOrgs(lastMonthJson.data)
        }
      } catch (err) {
        console.error("Failed to load admin WhatsApp analytics:", err)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [getPeriodParams, refreshToken])

  const handleSyncMeta = async () => {
    setSyncing(true)
    try {
      const daysMap: Record<string, number> = {
        "7d": 7,
        "30d": 30,
        "60d": 60,
        "90d": 90,
      }
      const syncDays = daysMap[periodPreset] ?? 30
      const res = await fetch("/api/admin/whatsapp/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: syncDays }),
      })
      const json = (await res.json()) as { ok?: boolean }
      if (json.ok) {
        setLastSyncedAt(
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        )
        setRefreshToken((prev) => prev + 1)
      }
    } catch (err) {
      console.error("Failed to sync Meta pricing analytics:", err)
    } finally {
      setSyncing(false)
    }
  }

  const formatIdr = (val?: string | number) => {
    if (val === undefined || val === null) return "Rp 0"
    const num = typeof val === "string" ? parseFloat(val) : val
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={periodPreset}
            onChange={(e) => setPeriodPreset(e.target.value)}
          >
            <optgroup label={messages.calendarMonth}>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={messages.lastDay}>
              <option value="7d">{messages.last7Days}</option>
              <option value="30d">{messages.last30Days}</option>
              <option value="60d">{messages.last60Days}</option>
              <option value="90d">{messages.last90Days}</option>
            </optgroup>
            <optgroup label={messages.custom}>
              <option value="custom">{messages.customDateRange}</option>
            </optgroup>
          </select>

          {periodPreset === "custom" && (
            <div className="flex items-center gap-1.5 rounded-md border border-input bg-background/50 px-2 py-1">
              <input
                type="date"
                className="h-7 rounded border border-input bg-background px-2 font-mono text-xs text-foreground focus:ring-1 focus:ring-ring focus:outline-none"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">-</span>
              <input
                type="date"
                className="h-7 rounded border border-input bg-background px-2 font-mono text-xs text-foreground focus:ring-1 focus:ring-ring focus:outline-none"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col items-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncMeta}
              disabled={syncing}
            >
              <RefreshCw
                className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "..." : "Sync Meta Pricing"}
            </Button>
            {lastSyncedAt && (
              <span className="text-[10px] text-muted-foreground">
                {messages.lastSync} {lastSyncedAt}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Risk Alert Banner */}
      {orgs.some((org) => parseFloat(org.grossProfitIdr) < 0) && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {messages.marginWarningTitle}
            </p>
            <p className="text-xs text-destructive/80">
              {messages.marginWarningDesc}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.totalRevenue}
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatIdr(summary?.kpi?.totalRevenueIdr)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.totalRevenueDesc}
            </p>
          </CardContent>
        </Card>

        {/* Total Meta Expense (COGS inc. PPN 11%) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.metaCost}
            </CardTitle>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatIdr(summary?.kpi?.totalMetaNetCostIdr)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.incTax} {formatIdr(summary?.kpi?.totalMetaVatCostIdr)}
            </p>
          </CardContent>
        </Card>

        {/* Realized Gross Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.grossProfit}
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                parseFloat(summary?.kpi?.grossProfitIdr ?? "0") < 0
                  ? "text-destructive"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {formatIdr(summary?.kpi?.grossProfitIdr)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {messages.grossProfitDesc}
            </p>
          </CardContent>
        </Card>

        {/* Profit Margin % */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {messages.marginHealth}
            </CardTitle>
            <Percent className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span
                className={`text-2xl font-bold ${
                  parseFloat(summary?.kpi?.grossMarginPct ?? "0") < 0
                    ? "text-destructive"
                    : ""
                }`}
              >
                {summary?.kpi?.grossMarginPct ?? "0"}%
              </span>
              {summary?.kpi?.status === "HEALTHY" ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="mr-1 size-3" /> {messages.healthy}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-destructive/40 bg-destructive/10 text-xs text-destructive"
                >
                  <AlertTriangle className="mr-1 size-3" /> {messages.warning}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.kpi?.totalDeliveredMessages ?? 0}{" "}
              {messages.totalSentMessages}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 1-Year Monthly Profitability & Revenue Chart */}
      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{messages.trendTitle}</CardTitle>
            <CardDescription>{messages.trendDesc}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {monthlyTrends.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              {messages.noTrendData}
            </div>
          ) : (
            <div className="h-[320px] w-full pt-4">
              <ChartContainer
                config={monthlyChartConfig}
                className="h-full w-full"
              >
                <BarChart
                  data={monthlyTrends}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/40"
                  />
                  <XAxis
                    dataKey="month"
                    className="text-[11px]"
                    tickFormatter={(val: string) => {
                      const [y, m] = val.split("-")
                      const date = new Date(Number(y), Number(m) - 1, 1)
                      return date.toLocaleDateString("id-ID", {
                        month: "short",
                        year: "2-digit",
                      })
                    }}
                  />
                  <YAxis
                    className="text-[11px]"
                    tickFormatter={(val: number) => {
                      if (val >= 1_000_000)
                        return `${(val / 1_000_000).toFixed(1)}jt`
                      if (val >= 1_000) return `${(val / 1_000).toFixed(0)}rb`
                      return String(val)
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label: React.ReactNode) => {
                          const [y, m] = String(label).split("-")
                          const date = new Date(Number(y), Number(m) - 1, 1)
                          return date.toLocaleDateString("id-ID", {
                            month: "long",
                            year: "numeric",
                          })
                        }}
                        formatter={(value: unknown, name: unknown) => [
                          formatIdr(typeof value === "number" ? value : 0),
                          typeof name === "string" && name in monthlyChartConfig
                            ? monthlyChartConfig[
                                name as keyof typeof monthlyChartConfig
                              ].label
                            : String(name),
                        ]}
                      />
                    }
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                  />
                  <Bar
                    dataKey="revenueIdr"
                    name={messages.thInvoiceRevenue}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="metaTotalCostIdr"
                    name={messages.thMetaCost}
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="grossProfitIdr"
                    name={messages.thNetProfit}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>{messages.categorySummaryTitle}</CardTitle>
          <CardDescription>{messages.categorySummaryDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.thCategory}</TableHead>
                <TableHead className="text-right">
                  {messages.thMessageVolume}
                </TableHead>
                <TableHead className="text-right">
                  {messages.thInvoiceRevenue}
                </TableHead>
                <TableHead className="text-right">
                  {messages.thMetaCost}
                </TableHead>
                <TableHead className="text-right">
                  {messages.thNetProfit}
                </TableHead>
                <TableHead className="text-right">Margin (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.categoryBreakdown?.map((item) => {
                const isNegative = parseFloat(item.grossProfitIdr) < 0
                return (
                  <TableRow key={item.category}>
                    <TableCell className="font-medium">
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.volume.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatIdr(item.revenueIdr)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      <div>{formatIdr(item.metaTotalCostIdr)}</div>
                      <div className="text-[10px] text-muted-foreground/70">
                        PPN: {formatIdr(item.metaVatCostIdr)}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        isNegative
                          ? "text-destructive"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {formatIdr(item.grossProfitIdr)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        isNegative ? "text-destructive" : ""
                      }`}
                    >
                      {item.marginPct}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Side-by-Side Top Organizations: Last Month vs Current Month (Option B: Clean Metric Cards) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Last Month Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {messages.topLastMonthTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {messages.topLastMonthDesc}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {monthLabels.last || "Past Month"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <TopOrgCardList
              orgs={lastMonthOrgs}
              emptyMessage={messages.noLastMonthData}
              formatIdr={formatIdr}
              messages={messages}
            />
          </CardContent>
        </Card>

        {/* Current Month Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {messages.topCurrentMonthTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {messages.topCurrentMonthDesc}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
              >
                {monthLabels.current || "Current Month"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <TopOrgCardList
              orgs={curMonthOrgs}
              emptyMessage={messages.noCurrentMonthData}
              formatIdr={formatIdr}
              messages={messages}
            />
          </CardContent>
        </Card>
      </div>

      {/* Organization Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>{messages.tenantHealthTitle}</CardTitle>
          <CardDescription>{messages.tenantHealthDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {messages.noTenantData}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.thTenantName}</TableHead>
                  <TableHead className="text-right">
                    {messages.thDevices}
                  </TableHead>
                  <TableHead className="text-right">
                    {messages.thMessageVolume}
                  </TableHead>
                  <TableHead className="text-right">
                    {messages.thInvoiceRevenue}
                  </TableHead>
                  <TableHead className="text-right">
                    {messages.thMetaCost}
                  </TableHead>
                  <TableHead className="text-right">
                    {messages.thNetProfit}
                  </TableHead>
                  <TableHead className="text-right">
                    {messages.thMargin}
                  </TableHead>
                  <TableHead className="text-center">
                    {messages.thStatus}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => {
                  const isNegative = parseFloat(org.grossProfitIdr) < 0
                  return (
                    <TableRow key={org.organizationId}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {org.organizationName &&
                          org.organizationName !== org.organizationId
                            ? org.organizationName
                            : `Tenant (${org.organizationId.slice(0, 12)}...)`}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {org.organizationId}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {org.deviceCount}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {org.totalDelivered.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatIdr(org.revenueIdr)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatIdr(org.metaTotalCostIdr)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          isNegative
                            ? "text-destructive"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatIdr(org.grossProfitIdr)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          isNegative ? "text-destructive" : ""
                        }`}
                      >
                        {org.marginPct}%
                      </TableCell>
                      <TableCell className="text-center">
                        {org.marginStatus === "HEALTHY" ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                          >
                            {messages.statusHealthy}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 bg-destructive/10 text-xs text-destructive"
                          >
                            {messages.statusRisk}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
