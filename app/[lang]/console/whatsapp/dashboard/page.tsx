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
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import { AccessRestricted } from "@/modules/whatsapp/ui/access-restricted"
import { ServiceOrderDialog } from "@/components/billing/service-order-dialog"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { WhatsAppCommandCenter } from "@/modules/whatsapp/onboarding/whatsapp-command-center"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"

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
  const [overview, setOverview] = React.useState<{
    month: { messageInboxCount: number; messageOutboxCount: number }[]
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
        ] = await Promise.all([
          whatsappClient.devices.list(),
          whatsappClient.conversations.list(),
          whatsappClient.webhooks.stats().catch(() => null),
          whatsappClient.usage.overview().catch(() => null),
        ])
        if (cancelled) return
        setDevices(deviceResponse.devices)
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.heading}</h1>
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
                      {t.statTotalConversations}
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
                    <p className="text-xs text-muted-foreground">{t.active}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t.statMessagesSent}
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
                    <p className="text-xs text-muted-foreground">{t.active}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t.statMessagesSent}
                    </CardTitle>
                    <ChartLine
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{broadcastTotal}</div>
                    <p className="text-xs text-muted-foreground">
                      {t.statTotalConversations}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* {t.deviceHealthTitle} Card */}
          <Card
            className={
              webhookStats && webhookStats.failureRate > 5
                ? "border-destructive"
                : undefined
            }
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t.deviceHealthTitle}
              </CardTitle>
              <ChartLine
                className="size-4 text-muted-foreground"
                weight="fill"
              />
            </CardHeader>
            <CardContent>
              <div
                className={
                  webhookStats
                    ? webhookStats.failureRate > 5
                      ? "text-2xl font-bold text-destructive"
                      : webhookStats.failureRate > 2
                        ? "text-2xl font-bold text-orange-500"
                        : "text-2xl font-bold"
                    : "text-2xl font-bold"
                }
              >
                {webhookStats ? `${webhookStats.failureRate}%` : "--"}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {webhookStats
                    ? `${webhookStats.failedEvents}/${webhookStats.totalEvents} failed (1h)`
                    : t.deviceHealthDesc}
                </p>
                {webhookStats && (
                  <WebhookAlertBadge
                    rate={webhookStats.failureRate}
                    label={t.disconnected}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* {t.conversationsCardTitle} */}
          <Card>
            <CardHeader>
              <CardTitle>{t.conversationsCardTitle}</CardTitle>
              <CardDescription>
                {state === "loading"
                  ? t.deviceHealthDesc
                  : t.conversationsCardDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state === "loading" ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ChatCircle
                    className="mb-3 size-10 text-muted-foreground"
                    weight="fill"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t.disconnected}
                  </p>
                  <Button variant="outline" className="mt-3" asChild>
                    <Link href="/console/whatsapp/messages">
                      {t.viewDevices}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentConversations.map((conversation) => (
                    <Link
                      key={conversation.id}
                      href="/console/whatsapp/messages"
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                          <ChatCircle
                            className="size-4 text-primary"
                            weight="fill"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {conversation.contactPhone}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(conversation.lastDirection === "INBOX"
                              ? t.connected
                              : t.disconnected) +
                              ` | ${conversation._count.whatsappMessages} messages`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {conversation.lastDirection === "INBOX" ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.connected}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {t.disconnected}
                          </Badge>
                        )}
                        {conversation.lastMessageAt && (
                          <span className="text-[11px] text-muted-foreground">
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
