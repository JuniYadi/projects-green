"use client"

import * as React from "react"
import { useParams } from "next/navigation"

import { Phone } from "@phosphor-icons/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TabsDeviceDetail } from "@/modules/whatsapp/webhooks/ui/tabs-device-detail"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"

type PageState = "loading" | "error" | "loaded"

type DeviceData = {
  id: string
  phoneNumber: string
  name: string
  status: string
  organizationId: string
  balance: number
  quotaBase: number
  quotaBaseOut: number
  dailyLimitMessage: number
  createdAt: string
  updatedAt: string
}

const formatDate = (date: string | null) => {
  if (!date) return "N/A"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

type InfoRowProps = {
  label: string
  value: string | number | React.ReactNode
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

export default function ConsoleWhatsAppDeviceDetailPage() {
  const params = useParams<{ deviceId: string; lang?: string }>()
  const deviceId = params?.deviceId

  const locale = resolveLocaleOrDefault(params?.lang)
  const devicesPath = localizePathname({
    pathname: "/console/whatsapp/devices",
    locale,
  })

  const [device, setDevice] = React.useState<DeviceData | null>(null)
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [errorMessage, setErrorMessage] = React.useState("")

  const loadDevice = React.useCallback(async () => {
    if (!deviceId) {
      setErrorMessage("Device ID is missing")
      setPageState("error")
      return
    }

    setPageState("loading")
    setErrorMessage("")

    try {
      const response = await whatsappClient.devices.get(deviceId)
      if (!response.ok) {
        throw new Error("Device not found")
      }
      setDevice(response.device as unknown as DeviceData)
      setPageState("loaded")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load device"
      setErrorMessage(message)
      setPageState("error")
    }
  }, [deviceId])

  React.useEffect(() => {
    ;(async () => {
      await loadDevice()
    })()
  }, [loadDevice])

  // Loading state
  if (pageState === "loading") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full mb-3" />
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  // Error state
  if (pageState === "error" || !device) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Phone className="mb-3 size-10 text-muted-foreground" weight="fill" />
          <p className="text-sm text-destructive">{errorMessage || "Device not found"}</p>
        </div>
      </main>
    )
  }

  // Overview tab content (basic device info, read-only)
  const overviewContent = (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device Information</CardTitle>
          <CardDescription>
            Basic device details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow label="Phone Number" value={device.phoneNumber} />
            <InfoRow label="Name" value={device.name || "-"} />
            <InfoRow
              label="Status"
              value={
                <Badge
                  variant={device.status === "ACTIVE" ? "success" : "secondary"}
                >
                  {device.status}
                </Badge>
              }
            />
            <InfoRow
              label="Usage"
              value={`${device.quotaBaseOut} / ${device.quotaBase} messages`}
            />
            <InfoRow
              label="Daily Limit"
              value={
                device.dailyLimitMessage > 0
                  ? `${device.dailyLimitMessage} msg/day`
                  : "No limit"
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timestamps</CardTitle>
          <CardDescription>
            Device lifecycle dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow label="Created" value={formatDate(device.createdAt)} />
            <InfoRow
              label="Last Updated"
              value={formatDate(device.updatedAt)}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <TabsDeviceDetail
      device={{
        id: device.id,
        phoneNumber: device.phoneNumber,
        name: device.name,
        status: device.status,
        organizationId: device.organizationId,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      }}
      backHref={devicesPath}
      overviewChildren={overviewContent}
    />
  )
}
