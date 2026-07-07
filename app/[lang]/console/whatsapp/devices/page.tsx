"use client"

import * as React from "react"
import { Phone } from "@phosphor-icons/react"

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
import { useParams } from "next/navigation"
import Link from "next/link"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type {
  DeviceListItem,
  DeviceStatus,
} from "@/modules/whatsapp/devices/devices.schemas"
import { DeviceHealthBadge } from "@/modules/whatsapp/ui/device-health-badge"

// ─── Status badge ───────────────────────────────────────────────────────────

type DeviceStatusBadgeProps = {
  status: DeviceStatus
  messages: ReturnType<typeof getMessages>
}

function DeviceStatusBadge({ status, messages }: DeviceStatusBadgeProps) {
  const variant: Record<DeviceStatus, "success" | "secondary" | "destructive"> = {
    ACTIVE: "success",
    NON_ACTIVE: "secondary",
    DISCONNECTED: "destructive",
    UNKNOWN: "secondary",
  }

  const label: Record<DeviceStatus, string> = {
    ACTIVE: messages.console.whatsapp.devices.active,
    NON_ACTIVE: messages.console.whatsapp.devices.inactive,
    DISCONNECTED: "Disconnected",
    UNKNOWN: "Unknown",
  }

  return <Badge variant={variant[status]}>{label[status]}</Badge>
}


// ─── Page component ─────────────────────────────────────────────────────────

export default function WhatsAppDevicesPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────

  // ponytail: not wrapped in useCallback — stable enough for effect dep
  const loadDevices = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { devices: items } = await whatsappClient.devices.list()
      setDevices(items)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : messages.console.whatsapp.devices.unableToLoad
      )
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    ;(async () => {
      await loadDevices()
    })()
  // ponytail: loadDevices is stable, only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.console.whatsapp.devices.heading}
          </h1>
          <p className="text-muted-foreground">
            {messages.console.whatsapp.devices.description}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{messages.console.whatsapp.devices.cardTitle}</CardTitle>
            <CardDescription>
              {messages.console.whatsapp.devices.cardDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="size-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {messages.console.whatsapp.devices.heading}
          </h1>
          <p className="text-muted-foreground">
            {messages.console.whatsapp.devices.description}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                {messages.console.whatsapp.devices.cardTitle}
              </CardTitle>
              <CardDescription>
                {messages.console.whatsapp.devices.cardDescription}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="mb-2 text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
              <Button variant="outline" onClick={() => void loadDevices()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.console.whatsapp.devices.heading}
        </h1>
        <p className="text-muted-foreground">
          {messages.console.whatsapp.devices.description} Quota and limits are
          managed by your admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.console.whatsapp.devices.cardTitle}</CardTitle>
          <CardDescription>
            {messages.console.whatsapp.devices.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                {messages.console.whatsapp.devices.noDevices}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {messages.console.whatsapp.devices.noDevicesDescription}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <Phone className="size-5 text-primary" weight="fill" />
                    </div>
                    <div>
                      <p className="font-medium">{device.phoneNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.quotaBaseOut} / {device.quotaBase} messages
                        remaining
                        {device.dailyLimitMessage > 0 &&
                          ` · ${device.dailyLimitMessage} msg/day limit`}
                        {Number(device.balance) > 0 &&
                          ` · Balance: Rp${Number(device.balance).toLocaleString("id-ID")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DeviceStatusBadge
                      status={device.status}
                      messages={messages}
                    />
                    <DeviceHealthBadge
                      status={
                        device.lastHeartbeatAt
                          ? // eslint-disable-next-line react-hooks/purity
                            new Date(device.lastHeartbeatAt) > new Date(Date.now() - 15 * 60 * 1000)
                            ? "CONNECTED"
                            : "DISCONNECTED"
                          : device.status === "DISCONNECTED"
                            ? "DISCONNECTED"
                            : "UNKNOWN"
                      }
                      lastHeartbeatAt={device.lastHeartbeatAt}
                    />
                    {device.status === "ACTIVE" && (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={localizePathname({
                            pathname: "/console/whatsapp/devices/" + device.id,
                            locale,
                          })}
                        >
                          Details
                        </Link>
                      </Button>
                    )}
                    {device.status === "NON_ACTIVE" && (
                      <p className="text-xs text-muted-foreground">
                        {messages.console.whatsapp.devices.notifyAdmin}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
