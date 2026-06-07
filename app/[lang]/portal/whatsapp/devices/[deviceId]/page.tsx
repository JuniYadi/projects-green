import Link from "next/link"
import { notFound } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "../_components/devices-ui"
import { DeviceActions } from "./device-actions"
import { QuotaBalanceCard } from "./quota-balance-card"

type DeviceDetailPageProps = {
  params: Promise<{
    deviceId: string
    lang: string
  }>
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

export default async function PortalWhatsAppDeviceDetailPage({
  params,
}: DeviceDetailPageProps) {
  const { deviceId, lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  const devicesPath = localizePathname({
    pathname: "/portal/whatsapp/devices",
    locale,
  })

  let device: {
    id: string
    phoneNumber: string
    name: string
    status: string
    environment: string
    balance: number
    quotaBase: number
    quotaBaseOut: number
    dailyLimitMessage: number
    organizationId: string
    businessId: string | null
    callbackUrl: string | null
    expiredAt: string | null
    whatsappBusinessAccountId: string | null
    whatsappPhoneId: string | null
    whatsappProfile: Record<string, unknown> | null
    features: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
  } | null = null

  try {
    const response = await whatsappClient.devices.get(deviceId)
    if (response.ok) {
      device = response.device
    }
  } catch {
    notFound()
  }

  if (!device) {
    notFound()
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={devicesPath}>Back to Devices</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">
                {device.phoneNumber}
              </h1>
              <StatusBadge status={device.status} className="text-sm" />
            </div>
            <p className="text-sm text-muted-foreground">
              Device {device.name && `- ${device.name}`}
            </p>
          </div>
          <DeviceActions deviceId={device.id} deviceStatus={device.status} />
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Device Information</CardTitle>
            <CardDescription>
              Core device details and identifiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <InfoRow label="Phone Number" value={device.phoneNumber} />
              <InfoRow label="Name" value={device.name || "-"} />
              <InfoRow
                label="Environment"
                value={
                  <Badge variant="outline">{device.environment}</Badge>
                }
              />
              <InfoRow
                label="WhatsApp Business Account ID"
                value={device.whatsappBusinessAccountId || "-"}
              />
              <InfoRow
                label="WhatsApp Phone ID"
                value={device.whatsappPhoneId || "-"}
              />
              <InfoRow
                label="Business ID"
                value={device.businessId || "-"}
              />
              <InfoRow
                label="Callback URL"
                value={device.callbackUrl || "-"}
              />
            </dl>
          </CardContent>
        </Card>

        <QuotaBalanceCard
          deviceId={device.id}
          initialBalance={device.balance}
          initialQuotaBase={device.quotaBase}
          initialQuotaBaseOut={device.quotaBaseOut}
          initialDailyLimitMessage={device.dailyLimitMessage}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
            <CardDescription>
              Owner organization mapping
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <InfoRow
                label="Organization ID"
                value={
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {device.organizationId}
                  </code>
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timestamps</CardTitle>
            <CardDescription>
              Creation and activity dates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <InfoRow label="Created" value={formatDate(device.createdAt)} />
              <InfoRow
                label="Last Updated"
                value={formatDate(device.updatedAt)}
              />
              <InfoRow
                label="Expires"
                value={formatDate(device.expiredAt)}
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
