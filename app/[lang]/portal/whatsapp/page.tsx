"use client"

import * as React from "react"
import {
  DeviceMobile,
  PaperPlaneTilt,
  ChartLine,
  ChatCircle,
  Heartbeat,
} from "@phosphor-icons/react"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

type PageState = "loading" | "error" | "loaded"

interface OverviewData {
  month: { messageInboxCount: number; messageOutboxCount: number }[]
  today: { messageOutboxCount: number }[]
  cost: {
    byCategory: { category: string; count: number; totalCost: number }[]
  }
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

export default function PortalWhatsAppDashboardPage() {
  const [state, setState] = React.useState<PageState>("loading")
  const [error, setError] = React.useState("")
  const [overview, setOverview] = React.useState<OverviewData | null>(null)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])

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
          cost: { byCategory: overviewRes.cost.byCategory },
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
  const byCategory = overview?.cost?.byCategory ?? []

  // ponytail: sum all months — overview.month is array of monthly aggregates
  const totalMonthlyOutbound = monthData.reduce(
    (sum, m) => sum + m.messageOutboxCount,
    0
  )
  const totalMonthlyInbound = monthData.reduce(
    (sum, m) => sum + m.messageInboxCount,
    0
  )

  // Total device count from fetched list
  const deviceCount = devices.length

  // ponytail: category message total — computed once, not per-map iteration
  const categoryTotal = byCategory.reduce((sum, c) => sum + c.count, 0)

  const hasData =
    deviceCount > 0 || totalMonthlyOutbound > 0 || totalMonthlyInbound > 0

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WhatsApp Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          At-a-glance overview of your WhatsApp Business devices and messaging.
        </p>
      </header>

      {state === "error" && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {state === "loading" ? (
          <>
            <StatCardSkeleton />
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
                  Total Devices
                </CardTitle>
                <DeviceMobile
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {deviceCount.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Registered devices
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Today&apos;s Outbound
                </CardTitle>
                <PaperPlaneTilt
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(
                    overview?.today?.reduce(
                      (sum, t) => sum + t.messageOutboxCount,
                      0
                    ) ?? 0
                  ).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Messages sent today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Outbound
                </CardTitle>
                <ChartLine
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalMonthlyOutbound.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Outbound messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Inbound
                </CardTitle>
                <ChatCircle
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalMonthlyInbound.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Inbound messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Device Health
                </CardTitle>
                <Heartbeat
                  className="size-4 text-muted-foreground"
                  weight="fill"
                />
              </CardHeader>
              <CardContent>
                {(() => {
                  const connected = devices.filter(
                    (d) => d.status === "ACTIVE" && d.lastHeartbeatAt
                  ).length
                  const disc = devices.filter(
                    (d) => d.status === "DISCONNECTED"
                  ).length
                  const unk = devices.filter(
                    (d) =>
                      d.status === "UNKNOWN" ||
                      (d.status === "ACTIVE" && !d.lastHeartbeatAt)
                  ).length
                  return (
                    <>
                      <div className="text-2xl font-bold">
                        {connected}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          Connected
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[disc > 0 ? `${disc} Disconnected` : null, unk > 0 ? `${unk} Unknown` : null]
                          .filter(Boolean)
                          .join(" · ") || "All devices healthy"}
                      </p>
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Category Breakdown */}
      {state !== "loading" && byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Messages by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {byCategory.map((cat) => {
                const percentage =
                  categoryTotal > 0 ? (cat.count / categoryTotal) * 100 : 0
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
                          {cat.count.toLocaleString()} messages
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </span>
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
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {state === "loaded" && !hasData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <DeviceMobile
              className="mb-4 size-12 text-muted-foreground"
              weight="fill"
            />
            <h3 className="mb-1 text-lg font-medium">No data yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Once your WhatsApp devices are connected and start sending
              messages, dashboard metrics will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
