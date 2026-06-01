"use client"

import * as React from "react"
import {
  Phone,
  ChatCircle,
  PaperPlaneTilt,
  ChartLine,
  Lightning,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react"
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

function DeviceStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <Badge variant="success">
        <CheckCircle className="mr-1 size-3" weight="fill" />
        Connected
      </Badge>
    )
  }

  return (
    <Badge variant="warning">
      <Warning className="mr-1 size-3" weight="fill" />
      Disconnected
    </Badge>
  )
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
  const [state, setState] = React.useState<DashboardState>("loading")
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [conversations, setConversations] = React.useState<
    ConversationListItem[]
  >([])
  const [errorMessage, setErrorMessage] = React.useState("")
  const [accessDenied, setAccessDenied] =
    React.useState<AccessDeniedInfo | null>(null)

  const loadData = React.useCallback(() => {
    let cancelled = false

    const run = async () => {
      try {
        const [deviceResponse, conversationResponse] = await Promise.all([
          whatsappClient.devices.list(),
          whatsappClient.conversations.list(),
        ])
        if (cancelled) return
        setDevices(deviceResponse.devices)
        setConversations(
          conversationResponse.conversations as ConversationListItem[]
        )
        setState("loaded")
      } catch (err) {
        if (cancelled) return

        // UNAUTHORIZED → redirect to login (serverFetch already does this,
        // but handle it here as a safety net)
        if (
          err instanceof Error &&
          "error" in err &&
          (err as any).error === "UNAUTHORIZED"
        ) {
          const pathParts = window.location.pathname.split("/")
          const locale = pathParts[1] || "en"
          window.location.href = `/${locale}/login/start?next=${encodeURIComponent(window.location.pathname)}`
          return
        }

        if (
          err instanceof Error &&
          "error" in err &&
          (err as any).error === "FORBIDDEN" &&
          (err as any).required
        ) {
          setAccessDenied({
            required: (err as any).required,
            current: (err as any).current ?? null,
            action: (err as any).action ?? "",
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

  const activeDevices = React.useMemo(
    () => devices.filter((d) => d.status === "ACTIVE"),
    [devices]
  )

  const totalMessagesToday = 0

  const totalBalance = React.useMemo(
    () => devices.reduce((sum, d) => sum + Number(d.balance), 0),
    [devices]
  )

  const totalDailyLimit = React.useMemo(
    () => devices.reduce((sum, d) => sum + d.dailyLimitMessage, 0),
    [devices]
  )

  const quotaUsed = totalDailyLimit > 0 ? totalMessagesToday : 0

  const quotaPercent =
    totalDailyLimit > 0
      ? Math.round((quotaUsed / totalDailyLimit) * 100)
      : 0

  const recentConversations = React.useMemo(
    () => conversations.slice(0, 5),
    [conversations]
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            WhatsApp Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your WhatsApp Business activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/console/whatsapp/devices">
              <Phone className="mr-2 size-4" />
              Manage Devices
            </Link>
          </Button>
          <Button asChild>
            <Link href="/console/whatsapp/messages">
              <PaperPlaneTilt className="mr-2 size-4" />
              Send Message
            </Link>
          </Button>
        </div>
      </div>

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
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {state !== "error" && (
        <>
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
                      Messages Today
                    </CardTitle>
                    <ChatCircle
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {totalMessagesToday}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Inbound + Outbound
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Quota Usage
                    </CardTitle>
                    <ChartLine
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {devices.length > 0 ? `${quotaPercent}%` : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {devices.length > 0
                        ? `${quotaUsed} / ${totalDailyLimit} messages`
                        : "No devices configured"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Active Devices
                    </CardTitle>
                    <Phone
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {activeDevices.length} / {devices.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Connected devices
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Balance
                    </CardTitle>
                    <Lightning
                      className="size-4 text-muted-foreground"
                      weight="fill"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {devices.length > 0
                        ? `$${totalBalance.toFixed(2)}`
                        : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Across all devices
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <Link href="/console/whatsapp/messages" className="block">
                <CardHeader>
                  <PaperPlaneTilt
                    className="mb-2 size-8 text-primary"
                    weight="fill"
                  />
                  <CardTitle>Send a Message</CardTitle>
                  <CardDescription>
                    Send a direct message to a contact
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <Link href="/console/whatsapp/templates" className="block">
                <CardHeader>
                  <Lightning
                    className="mb-2 size-8 text-yellow-600"
                    weight="fill"
                  />
                  <CardTitle>Use a Template</CardTitle>
                  <CardDescription>
                    Send a pre-approved template message
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <Link href="/console/whatsapp/contacts" className="block">
                <CardHeader>
                  <ChartLine
                    className="mb-2 size-8 text-blue-600"
                    weight="fill"
                  />
                  <CardTitle>View Contacts</CardTitle>
                  <CardDescription>
                    Manage your contact list and groups
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Device Status</CardTitle>
              <CardDescription>
                {state === "loading"
                  ? "Loading devices..."
                  : "Your connected WhatsApp Business devices"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state === "loading" ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Phone className="mb-3 size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No devices configured yet
                  </p>
                  <Button className="mt-3" asChild>
                    <Link href="/console/whatsapp/devices">
                      Add your first device
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.slice(0, 10).map((device) => (
                    <Link
                      key={device.id}
                      href="/console/whatsapp/devices"
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                          <Phone
                            className="size-4 text-primary"
                            weight="fill"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {device.phoneNumber}
                          </p>
                          {device.dailyLimitMessage > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Limit: {device.dailyLimitMessage} msg/day
                              {Number(device.balance) > 0 &&
                                ` | Balance: $${Number(device.balance).toFixed(2)}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <DeviceStatusBadge status={device.status} />
                    </Link>
                  ))}
                  {devices.length > 10 && (
                    <Button variant="link" asChild className="w-full">
                      <Link href="/console/whatsapp/devices">
                        View all {devices.length} devices
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
              <CardDescription>
                {state === "loading"
                  ? "Loading conversations..."
                  : "Latest message activity"}
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
                    No recent conversations
                  </p>
                  <Button variant="outline" className="mt-3" asChild>
                    <Link href="/console/whatsapp/messages">
                      View all messages
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
                            {conversation.lastDirection === "INBOX"
                              ? "Inbound"
                              : "Outbound"}
                            {` | ${conversation._count.whatsappMessages} messages`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {conversation.lastDirection === "INBOX" ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Inbound
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Outbound
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
    </div>
  )
}
