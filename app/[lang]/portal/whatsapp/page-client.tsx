"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  DeviceMobile,
  PaperPlaneTilt,
  ChatCircle,
  CurrencyDollar,
  Plus,
  Megaphone,
  ArrowsClockwise,
  Key,
  Plugs,
  WarningCircle,
  CheckCircle,
  Question,
} from "@phosphor-icons/react"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

type PageState = "loading" | "error" | "loaded"

interface OverviewData {
  month: { messageInboxCount: number; messageOutboxCount: number }[]
  today: { messageInboxCount?: number; messageOutboxCount: number }[]
  cost: {
    totalAmount?: number
    byCategory: { category: string; count: number; totalCost: number }[]
  }
}

type HealthBreakdown = {
  connected: number
  disconnected: number
  unknown: number
}

function computeHealth(
  device: DeviceListItem
): "connected" | "disconnected" | "unknown" {
  if (device.lastHeartbeatAt) {
    const fifteenMinAgo = Date.now() - 15 * 60 * 1000
    return new Date(device.lastHeartbeatAt).getTime() > fifteenMinAgo
      ? "connected"
      : "disconnected"
  }
  return device.status === "DISCONNECTED" ? "disconnected" : "unknown"
}

const META_CATEGORIES = [
  {
    key: "MARKETING",
    label: "Marketing",
    description: "Promotions, discounts & re-engagement campaigns",
    badgeVariant: "secondary" as const,
  },
  {
    key: "UTILITY",
    label: "Utility",
    description: "Order confirmations, shipping & account updates",
    badgeVariant: "outline" as const,
  },
  {
    key: "AUTHENTICATION",
    label: "Authentication",
    description: "OTPs, password resets & verification codes",
    badgeVariant: "outline" as const,
  },
  {
    key: "SERVICE",
    label: "Service",
    description: "Customer care & user-initiated support conversations",
    badgeVariant: "secondary" as const,
  },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-1 h-7 w-20" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

export default function PortalWhatsAppDashboardPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)

  const [state, setState] = React.useState<PageState>("loading")
  const [error, setError] = React.useState("")
  const [overview, setOverview] = React.useState<OverviewData | null>(null)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])

  const health = React.useMemo<HealthBreakdown>(() => {
    let connected = 0
    let disconnected = 0
    let unknown = 0
    for (const d of devices) {
      const h = computeHealth(d)
      if (h === "connected") connected++
      else if (h === "disconnected") disconnected++
      else unknown++
    }
    return { connected, disconnected, unknown }
  }, [devices])

  const loadData = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      try {
        const [overviewRes, deviceRes] = await Promise.all([
          whatsappClient.usage.overview(),
          whatsappClient.devices.list(),
        ])

        if (cancelled) return

        setOverview({
          month: overviewRes.month,
          today: overviewRes.today,
          cost: {
            totalAmount: (overviewRes.cost as { totalAmount?: number })
              ?.totalAmount,
            byCategory: overviewRes.cost.byCategory,
          },
        })
        setDevices(deviceRes.devices)
        setState("loaded")
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : "Failed to load dashboard data."
        setError(message)
        setState("error")
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

  const monthData = overview?.month ?? []
  const todayData = overview?.today ?? []
  const byCategory = React.useMemo(
    () => overview?.cost?.byCategory ?? [],
    [overview?.cost?.byCategory]
  )

  // Monthly aggregates (In / Out)
  const monthlyOut = monthData.reduce((sum, m) => sum + m.messageOutboxCount, 0)
  const monthlyIn = monthData.reduce((sum, m) => sum + m.messageInboxCount, 0)

  // Daily aggregates (In / Out)
  const dailyOut = todayData.reduce((sum, t) => sum + t.messageOutboxCount, 0)
  const dailyIn = todayData.reduce(
    (sum, t) => sum + (t.messageInboxCount ?? 0),
    0
  )

  // Total PAYG Spend (Ledger totalAmount or sum of category totalCost)
  const totalPaygSpending =
    overview?.cost?.totalAmount ??
    byCategory.reduce((sum, c) => sum + (c.totalCost ?? 0), 0)

  const deviceCount = devices.length
  const categoryTotalCount = byCategory.reduce((sum, c) => sum + c.count, 0)

  // Category lookup map normalized to uppercase
  const categoryCountMap = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const c of byCategory) {
      const normKey = c.category.replace("WHATSAPP_MESSAGE_", "").toUpperCase()
      map.set(normKey, c.count)
    }
    return map
  }, [byCategory])

  // Problematic devices needing admin attention
  const alertDevices = React.useMemo(() => {
    return devices.filter((d) => {
      const h = computeHealth(d)
      return h === "disconnected" || h === "unknown" || d.status !== "ACTIVE"
    })
  }, [devices])

  const hasData =
    deviceCount > 0 ||
    monthlyOut > 0 ||
    monthlyIn > 0 ||
    dailyOut > 0 ||
    dailyIn > 0

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">WhatsApp Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Central mission control for WhatsApp Business devices, traffic, and
            daily operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={localizePathname({
              pathname: "/portal/whatsapp/broadcasts/new",
              locale,
            })}
          >
            <Button variant="outline" size="sm">
              <Megaphone className="mr-1.5 size-4" />
              Broadcast
            </Button>
          </Link>
          <Link
            href={localizePathname({
              pathname: "/portal/whatsapp/devices/new",
              locale,
            })}
          >
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              Add Device
            </Button>
          </Link>
        </div>
      </header>

      {state === "error" && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 4 Symmetric Stat Cards (Top Row) */}
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
            {/* Card 1: Total Device */}
            <Link
              href={localizePathname({
                pathname: "/portal/whatsapp/devices",
                locale,
              })}
              className="group block transition-all"
            >
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Device
                  </CardTitle>
                  <DeviceMobile
                    className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                    weight="fill"
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {deviceCount.toLocaleString()}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                      <span className="mr-1 size-1.5 rounded-full bg-emerald-500" />
                      {health.connected} Online
                    </span>
                    {(health.disconnected > 0 || health.unknown > 0) && (
                      <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
                        • {health.disconnected + health.unknown} Attention
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Card 2: Monthly Message (In / Out) */}
            <Link
              href={localizePathname({
                pathname: "/portal/whatsapp/messages",
                locale,
              })}
              className="group block transition-all"
            >
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Monthly Message (In / Out)
                  </CardTitle>
                  <PaperPlaneTilt
                    className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                    weight="fill"
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {monthlyIn.toLocaleString()}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      In
                    </span>{" "}
                    / {monthlyOut.toLocaleString()}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      Out
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(monthlyIn + monthlyOut).toLocaleString()} Total messages
                    this cycle
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Card 3: Daily Message (In / Out) */}
            <Link
              href={localizePathname({
                pathname: "/portal/whatsapp/messages",
                locale,
              })}
              className="group block transition-all"
            >
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Daily Message (In / Out)
                  </CardTitle>
                  <ChatCircle
                    className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                    weight="fill"
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dailyIn.toLocaleString()}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      In
                    </span>{" "}
                    / {dailyOut.toLocaleString()}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      Out
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(dailyIn + dailyOut).toLocaleString()} Messages today
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Card 4: Total PAYG Spending */}
            <Link
              href={localizePathname({
                pathname: "/portal/whatsapp/ledger",
                locale,
              })}
              className="group block transition-all"
            >
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total PAYG Spending
                  </CardTitle>
                  <CurrencyDollar
                    className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                    weight="fill"
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(totalPaygSpending)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accumulated meter spend
                  </p>
                </CardContent>
              </Card>
            </Link>
          </>
        )}
      </div>

      {/* Messages by Category (All 4 Official Meta Categories) */}
      {state !== "loading" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Messages by Category
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Breakdown across 4 Meta conversation billing types.
                </p>
              </div>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Question className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-xs">
                    Meta classifies conversation traffic into Marketing,
                    Utility, Authentication, and Service with different unit
                    pricing rules.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {META_CATEGORIES.map((cat) => {
                const count = categoryCountMap.get(cat.key) ?? 0
                const percentage =
                  categoryTotalCount > 0
                    ? (count / categoryTotalCount) * 100
                    : 0

                return (
                  <div key={cat.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={cat.badgeVariant}
                          className="text-[11px] font-medium"
                        >
                          {cat.label}
                        </Badge>
                        <span className="text-muted-foreground">
                          {count.toLocaleString()}{" "}
                          {count === 1 ? "message" : "messages"}
                        </span>
                        <span className="hidden text-muted-foreground/70 sm:inline">
                          · {cat.description}
                        </span>
                      </div>
                      <span className="font-semibold text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Driver Workspace: Quick Operations & Device Health Alerts */}
      {state !== "loading" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Operations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Operations</CardTitle>
              <p className="text-xs text-muted-foreground">
                Routine operational tasks and configuration shortcuts.
              </p>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Link
                href={localizePathname({
                  pathname: "/portal/whatsapp/devices/new",
                  locale,
                })}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5">
                  <DeviceMobile className="size-4 text-primary" />
                  <div>
                    <div className="font-medium">Register Device</div>
                    <div className="text-xs text-muted-foreground">
                      Add a new WhatsApp Business phone number
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary">
                  Add &rarr;
                </span>
              </Link>

              <Link
                href={localizePathname({
                  pathname: "/portal/whatsapp/templates",
                  locale,
                })}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5">
                  <ArrowsClockwise className="size-4 text-primary" />
                  <div>
                    <div className="font-medium">Message Templates</div>
                    <div className="text-xs text-muted-foreground">
                      Sync or compose Meta-approved HSM templates
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary">
                  Manage &rarr;
                </span>
              </Link>

              <Link
                href={localizePathname({
                  pathname: "/portal/whatsapp/broadcasts/new",
                  locale,
                })}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5">
                  <Megaphone className="size-4 text-primary" />
                  <div>
                    <div className="font-medium">Launch Broadcast</div>
                    <div className="text-xs text-muted-foreground">
                      Send bulk campaigns to targeted contact groups
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary">
                  Create &rarr;
                </span>
              </Link>

              <Link
                href={localizePathname({
                  pathname: "/portal/whatsapp/api-keys",
                  locale,
                })}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5">
                  <Key className="size-4 text-primary" />
                  <div>
                    <div className="font-medium">API Keys &amp; Webhooks</div>
                    <div className="text-xs text-muted-foreground">
                      Inspect inbound webhooks and organization credentials
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary">
                  Inspect &rarr;
                </span>
              </Link>
            </CardContent>
          </Card>

          {/* Device Health & Attention Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Device Attention</CardTitle>
              <p className="text-xs text-muted-foreground">
                Devices requiring administrator review or reconnection.
              </p>
            </CardHeader>
            <CardContent>
              {alertDevices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CheckCircle className="mb-2 size-8 text-emerald-500" />
                  <p className="text-sm font-medium">All devices healthy</p>
                  <p className="text-xs text-muted-foreground">
                    Every registered WhatsApp phone number is connected and
                    responsive.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {alertDevices.slice(0, 4).map((device) => {
                    const healthState = computeHealth(device)
                    return (
                      <div
                        key={device.id}
                        className="flex items-center justify-between rounded-md border p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <WarningCircle className="size-4 shrink-0 text-amber-500" />
                          <div>
                            <div className="font-medium">
                              {device.verifiedName || device.name}
                            </div>
                            <div className="font-mono text-muted-foreground">
                              {device.phoneNumber}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              healthState === "connected"
                                ? "outline"
                                : "destructive"
                            }
                            className="text-[10px]"
                          >
                            {healthState.toUpperCase()}
                          </Badge>
                          <Link
                            href={localizePathname({
                              pathname: `/portal/whatsapp/devices/${device.id}`,
                              locale,
                            })}
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                            >
                              Fix
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                  {alertDevices.length > 4 && (
                    <Link
                      href={localizePathname({
                        pathname: "/portal/whatsapp/devices",
                        locale,
                      })}
                      className="block pt-1 text-center text-xs text-primary underline-offset-4 hover:underline"
                    >
                      View all {alertDevices.length} flagged devices &rarr;
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {state === "loaded" && !hasData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Plugs className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-medium">No data yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Once your WhatsApp devices are connected and start sending
              messages, dashboard metrics will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
