"use client"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import {
  Phone,
  ChatCircle,
  PaperPlaneTilt,
  ChartLine,
  Warning,
  Sparkle,
} from "@phosphor-icons/react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import { AccessRestricted } from "@/modules/whatsapp/ui/access-restricted"
import { ServiceOrderDialog } from "@/components/billing/service-order-dialog"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { WhatsAppCommandCenter } from "@/modules/whatsapp/onboarding/whatsapp-command-center"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"

const CATEGORY_COLORS: Record<string, string> = {
  UTILITY: "var(--color-chart-1, #22c55e)",
  AUTHENTICATION: "var(--color-chart-2, #3b82f6)",
  MARKETING: "var(--color-chart-3, #f59e0b)",
  SERVICE: "var(--color-chart-4, #a855f7)",
}

const DASHBOARD_CHART_CONFIG = {
  in: { label: "Pesan Masuk", color: "var(--color-chart-1, #22c55e)" },
  out: { label: "Pesan Keluar", color: "var(--color-chart-2, #3b82f6)" },
} satisfies ChartConfig
type WebhookStats = {
  periodEnd: string
  totalEvents: number
  failedEvents: number
  deadLetters: number
  failureRate: number
}

type DashboardState = "loading" | "error" | "access_denied" | "loaded"

type AccessDeniedInfo = {
  required: string
  current: string | null
  action: string
}

type MessageDirection = "INBOX" | "OUTBOX"

type ConversationListItem = {
  id: string
  organizationId: string
  contactPhone: string
  lastMessageAt: string | null
  lastDirection: MessageDirection | null
  whatsappDeviceId: string | null
  createdAt: string
  updatedAt: string
  _count: { whatsappMessages: number }
}

function WebhookAlertBadge({ rate, label }: { rate: number; label: string }) {
  if (rate > 5) {
    return (
      <Badge variant="destructive">
        <Warning className="mr-1 size-3" weight="fill" />
        {label}
      </Badge>
    )
  }
  return null
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

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function WhatsAppDashboardPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.whatsapp.dashboard
  const [state, setState] = React.useState<DashboardState>("loading")
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [conversations, setConversations] = React.useState<
    ConversationListItem[]
  >([])
  const [accessDenied, setAccessDenied] =
    React.useState<AccessDeniedInfo | null>(null)
  const [isOrderOpen, setIsOrderOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [webhookStats, setWebhookStats] = React.useState<WebhookStats | null>(
    null
  )
  const [broadcastTotal, setBroadcastTotal] = React.useState(0)
  const [dailyCounts, setDailyCounts] = React.useState<
    { date: string; messageInboxCount: number; messageOutboxCount: number }[]
  >([])
  const [overview, setOverview] = React.useState<{
    month: { messageInboxCount: number; messageOutboxCount: number }[]
    cost?: {
      totalAmount: number
      totalEntries: number
      byCategory: { category: string; count: number; totalCost: number }[]
    }
  } | null>(null)
  const loadData = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      try {
        const [
          deviceResponse,
          conversationResponse,
          webhookResponse,
          overviewResponse,
          dailyResponse,
        ] = await Promise.all([
          whatsappClient.devices.list(),
          whatsappClient.conversations.list(),
          whatsappClient.webhooks.stats().catch(() => null),
          whatsappClient.usage.overview().catch(() => null),
          whatsappClient.usage
            .daily({
              from: new Date(Date.now() - 6 * 86400000)
                .toISOString()
                .slice(0, 10),
              to: new Date().toISOString().slice(0, 10),
            })
            .catch(() => ({ counts: [] })),
        ])
        if (cancelled) return
        setDevices(deviceResponse.devices)
        const rawCounts = (dailyResponse?.counts || []) as {
          date: string
          messageInboxCount: number
          messageOutboxCount: number
        }[]
        const countsMap = new Map(
          rawCounts.map((c) => [c.date.slice(0, 10), c])
        )
        const filled7Days: {
          date: string
          messageInboxCount: number
          messageOutboxCount: number
        }[] = []
        for (let i = 6; i >= 0; i--) {
          const dStr = new Date(Date.now() - i * 86400000)
            .toISOString()
            .slice(0, 10)
          const found = countsMap.get(dStr)
          filled7Days.push({
            date: dStr,
            messageInboxCount: found?.messageInboxCount ?? 0,
            messageOutboxCount: found?.messageOutboxCount ?? 0,
          })
        }
        setDailyCounts(filled7Days)
        setConversations(
          conversationResponse.conversations as ConversationListItem[]
        )
        if (webhookResponse?.data) {
          setWebhookStats(webhookResponse.data)
        }
        if (overviewResponse?.ok) {
          setOverview(
            overviewResponse as {
              month: { messageInboxCount: number; messageOutboxCount: number }[]
            }
          )
        }
        // Load broadcast totals independently so unavailable metrics do not
        // block the rest of the dashboard.
        try {
          const broadcastResponse = await whatsappClient.broadcasts.summary()
          if (broadcastResponse?.total !== undefined) {
            setBroadcastTotal(broadcastResponse.total)
          }
        } catch {
          // Broadcast metrics are optional for dashboard rendering.
        }
        setState("loaded")
      } catch (err) {
        if (cancelled) return

        // UNAUTHORIZED → redirect to login (serverFetch already does this,
        // but handle it here as a safety net)
        const apiError = err as Record<string, unknown>
        if (
          err instanceof Error &&
          "error" in err &&
          apiError.error === "UNAUTHORIZED"
        ) {
          const pathParts = window.location.pathname.split("/")
          const locale = pathParts[1] || "en"
          window.location.href = `/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`
          return
        }

        if (
          err instanceof Error &&
          "error" in err &&
          apiError.error === "FORBIDDEN" &&
          apiError.required
        ) {
          setAccessDenied({
            required: apiError.required as string,
            current: (apiError.current as string) ?? null,
            action: (apiError.action as string) ?? "",
          })
          setState("access_denied")
        } else {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to load dashboard data."
          setErrorMessage(message)
          setState("error")
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    return loadData()
  }, [loadData])

  const messageInTotal =
    overview?.month?.reduce((sum, m) => sum + m.messageInboxCount, 0) ?? 0
  const messageOutTotal =
    overview?.month?.reduce((sum, m) => sum + m.messageOutboxCount, 0) ?? 0

  const recentConversations = React.useMemo(
    () => conversations.slice(0, 5),
    [conversations]
  )

  const onboarding = useWhatsAppOnboarding({ locale })

  if (!onboarding.isGraduated && state === "loaded") {
    return (
      <div className="space-y-6">
        <WhatsAppCommandCenter
          onboarding={onboarding}
          onSubscribeClick={() => setIsOrderOpen(true)}
          locale={locale}
        />
        <ServiceOrderDialog
          productCode="WHATSAPP"
          productTitle="WhatsApp"
          open={isOrderOpen}
          onOpenChange={setIsOrderOpen}
          lang={locale}
          messages={messages.console.billing.serviceOrder}
          onSuccess={() => {
            void loadData()
          }}
        />
        <FlightHudWidget
          onboarding={onboarding}
          onSubscribeClick={() => setIsOrderOpen(true)}
          locale={locale}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{t.heading}</h1>
            {webhookStats && (
              <Badge
                variant={
                  webhookStats.failureRate > 5 ? "destructive" : "secondary"
                }
                className="text-xs font-normal"
              >
                <span
                  className={`mr-1.5 size-2 rounded-full ${
                    webhookStats.failureRate > 5
                      ? "bg-destructive"
                      : "bg-emerald-500"
                  }`}
                />
                {webhookStats.failureRate === 0
                  ? locale === "id"
                    ? "Meta API: Normal (0% Gagal)"
                    : "Meta API: Normal (0% Failure)"
                  : `${webhookStats.failureRate}% ${locale === "id" ? "Gagal" : "Failure"}`}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                localStorage.removeItem("whatsapp_onboarding_hud_closed")
              } catch {}
              window.location.reload()
            }}
            className="gap-1.5 text-xs"
          >
            <Sparkle className="size-3.5 text-primary" weight="fill" />
            {messages.console.whatsapp.onboarding.hud.showOnboardingGuide}
          </Button>
          <Button variant="outline" onClick={() => setIsOrderOpen(true)}>
            <Sparkle className="mr-2 size-4 text-primary" />
            {messages.console.whatsapp.onboarding.hud.subscribePlan}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/console/whatsapp/devices">
              <Phone className="mr-2 size-4" />
              {t.viewDevices}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/console/whatsapp/messages">
              <PaperPlaneTilt className="mr-2 size-4" />
              <WhatsAppText id="s30" />
            </Link>
          </Button>
        </div>
      </div>

      {state === "loaded" && devices.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-base font-semibold">
                <WhatsAppText id="s31" />
              </h3>
              <p className="text-sm text-muted-foreground">
                <WhatsAppText id="s32" />
              </p>
            </div>
            <Button className="shrink-0" onClick={() => setIsOrderOpen(true)}>
              <Sparkle className="mr-2 size-4" />
              Hubungkan WhatsApp Sekarang
            </Button>
          </CardContent>
        </Card>
      )}

      {state === "access_denied" && accessDenied && (
        <AccessRestricted {...accessDenied} />
      )}

      {state === "error" && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Warning className="mb-3 size-10 text-destructive" weight="fill" />
            <p className="text-sm font-medium text-destructive">
              {errorMessage}
            </p>
            <Button className="mt-3" variant="outline" onClick={loadData}>
              {t.viewDevices}
            </Button>
          </CardContent>
        </Card>
      )}

      {state !== "error" && (
        <>
          {/* Global Stat Cards */}
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
                      {t.statActiveDevices}
                    </CardTitle>
                    <Phone
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{devices.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {t.connected}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {locale === "id" ? "Pesan Masuk" : "Inbound Messages"}
                    </CardTitle>
                    <ChatCircle
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {messageInTotal.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "id" ? "Total diterima" : "Total received"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {locale === "id" ? "Pesan Keluar" : "Outbound Messages"}
                    </CardTitle>
                    <PaperPlaneTilt
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {messageOutTotal.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "id" ? "Total terkirim" : "Total sent"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {locale === "id" ? "Pesan Broadcast" : "Broadcasts"}
                    </CardTitle>
                    <ChartLine
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{broadcastTotal}</div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "id" ? "Kampanye terkirim" : "Campaigns sent"}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* 2-Column Main Row: 7-Day Traffic Trend & Live Chat Stream */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* 7-Day Trend Mini Bar Chart */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {locale === "id"
                        ? "Tren Trafik 7 Hari"
                        : "7-Day Traffic Trend"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {locale === "id"
                        ? "Volume pesan masuk vs keluar 7 hari berturut-turut"
                        : "Inbound vs outbound volume over 7 consecutive days"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">
                        {locale === "id" ? "Masuk" : "Inbound"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">
                        {locale === "id" ? "Keluar" : "Outbound"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                {state === "loading" ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : (
                  <ChartContainer
                    config={DASHBOARD_CHART_CONFIG}
                    className="h-[220px] w-full"
                  >
                    <BarChart
                      data={dailyCounts.map((c) => ({
                        date: new Date(c.date).toLocaleDateString(
                          locale === "id" ? "id-ID" : "en-US",
                          { day: "numeric", month: "short" }
                        ),
                        in: c.messageInboxCount,
                        out: c.messageOutboxCount,
                      }))}
                    >
                      <XAxis
                        dataKey="date"
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
                        maxBarSize={24}
                      />
                      <Bar
                        dataKey="out"
                        name={locale === "id" ? "Pesan Keluar" : "Outbound"}
                        fill="#3b82f6"
                        radius={[2, 2, 0, 0]}
                        maxBarSize={24}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent Conversations (Live Chat Stream) */}
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t.conversationsCardTitle}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {locale === "id"
                      ? "Obrolan aktif pelanggan dari seluruh perangkat"
                      : "Recent customer conversations across all devices"}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild className="text-xs">
                  <Link href="/console/whatsapp/messages">
                    {locale === "id" ? "Buka Pesan →" : "View Inbox →"}
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 space-y-2.5 pb-4">
                {state === "loading" ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ChatCircle
                      className="mb-2 size-8 text-muted-foreground"
                      weight="fill"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t.disconnected}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentConversations.slice(0, 5).map((conversation) => (
                      <Link
                        key={conversation.id}
                        href="/console/whatsapp/messages"
                        className="flex items-center justify-between rounded-md border p-2.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
                            <ChatCircle
                              className="size-3.5 text-primary"
                              weight="fill"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium">
                              {conversation.contactPhone}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {conversation.lastDirection === "INBOX"
                                ? locale === "id"
                                  ? "Arah: Pesan Masuk"
                                  : "Direction: Inbound"
                                : locale === "id"
                                  ? "Arah: Pesan Keluar"
                                  : "Direction: Outbound"}
                              {` · ${conversation._count.whatsappMessages} pesan`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <Badge
                            variant={
                              conversation.lastDirection === "INBOX"
                                ? "secondary"
                                : "outline"
                            }
                            className="px-1.5 py-0 text-[9px]"
                          >
                            {conversation.lastDirection === "INBOX"
                              ? locale === "id"
                                ? "Masuk"
                                : "Inbound"
                              : locale === "id"
                                ? "Keluar"
                                : "Outbound"}
                          </Badge>
                          {conversation.lastMessageAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(conversation.lastMessageAt)}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Full-Width Card: Donut Category Breakdown & Horizontal Bars */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {locale === "id"
                  ? "Komposisi Kategori Pesan"
                  : "Category Breakdown"}
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === "id"
                  ? "Distribusi pesan berdasarkan percakapan berbayar & layanan resmi Meta"
                  : "Message distribution by official Meta paid and service categories"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state === "loading" ? (
                <Skeleton className="h-[140px] w-full" />
              ) : !overview?.cost?.byCategory ||
                overview.cost.byCategory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground">
                  <ChatCircle className="mb-2 size-8 text-muted-foreground" />
                  <span>
                    {locale === "id"
                      ? "Belum ada data kategori bulan ini."
                      : "No category data available this month."}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                  <div className="h-[150px] w-[150px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview.cost.byCategory.map((c) => ({
                            name: c.category
                              .replace("WHATSAPP_MESSAGE_", "")
                              .replace("WHATSAPP_", ""),
                            value: c.count,
                            category: c.category,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {overview.cost.byCategory.map((entry) => (
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
                  {/* Horizontal Bar Breakdown */}
                  <div className="w-full space-y-3 text-xs">
                    {overview.cost.byCategory.map((cat) => {
                      const cleanName = cat.category
                        .replace("WHATSAPP_MESSAGE_", "")
                        .replace("WHATSAPP_", "")
                      const total = overview.cost?.totalEntries ?? 1
                      const pct = Number(
                        ((cat.count / (total || 1)) * 100).toFixed(1)
                      )
                      const catColor =
                        CATEGORY_COLORS[cat.category] ??
                        CATEGORY_COLORS[cleanName] ??
                        "hsl(var(--primary))"
                      return (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: catColor }}
                              />
                              <span className="font-medium">{cleanName}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {cat.count} pesan ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all"
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
              )}
            </CardContent>
          </Card>
        </>
      )}
      <ServiceOrderDialog
        productCode="WHATSAPP"
        productTitle="WhatsApp"
        open={isOrderOpen}
        onOpenChange={setIsOrderOpen}
        lang={locale}
        messages={messages.console.billing.serviceOrder}
        onSuccess={() => {
          void loadData()
        }}
      />
      <FlightHudWidget
        onboarding={onboarding}
        onSubscribeClick={() => setIsOrderOpen(true)}
      />
    </div>
  )
}
